"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { getWalletData, getWalletLPPositions, fetchTokenPrices } from "@/lib/blockchain";
import { getChain, fmtAmt, fmtRate, fmtFull, fmtFullUSD } from "@/lib/utils";
import { ArrowLeft, ExternalLink, Loader2, AlertTriangle, Copy, Check } from "lucide-react";

/** Extreme range boundaries → ∞ / 0, otherwise smart rate formatting */
const fmtPrice = (n: number): string => {
  if (!isFinite(n) || n > 1e15) return "∞";
  if (n <= 0 || n < 1e-10) return "0";
  return fmtRate(n);
};

export default function WalletDetailPage() {
  const params = useParams();
  const router = useRouter();
  const address = params.address as string;
  const { chainId, wallets, pools, metadata, tokens, tokenMetadata } = useApp();
  const chain = getChain(chainId);

  const [data, setData] = useState<any>(null);
  const [lpPositions, setLpPositions] = useState<{ v2: any[]; v3: any[] }>({ v2: [], v3: [] });
  const [tokenPrices, setTokenPrices] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const dbWallet = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [enriched, positions] = await Promise.all([
          getWalletData(address, chainId),
          getWalletLPPositions(address, chainId, pools),
        ]);
        setData(enriched);
        setLpPositions(positions);

        // 포지션에 포함된 토큰 가격 조회
        const allTokenAddrs = [
          ...positions.v3.flatMap((p: any) => [p.token0?.address, p.token1?.address]),
          ...positions.v2.flatMap((p: any) => [p.token0Addr, p.token1Addr]),
        ].filter(Boolean).filter((v: string, i: number, a: string[]) =>
          a.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i
        );
        if (allTokenAddrs.length > 0) {
          const chainTokens = tokens.filter((t: any) => t.chain_id === chainId);
          const regTokens = Object.entries(tokenMetadata).map(([addr, m]: [string, any]) => ({ address: addr, symbol: m.symbol }));
          const priceResults = await fetchTokenPrices(allTokenAddrs, chainId, pools, [...chainTokens, ...regTokens], metadata);
          const pMap: Record<string, string> = {};
          priceResults.forEach((r: any) => { if (r.price) pMap[r.address.toLowerCase()] = r.price; });

          // V2 교환비 역산: 한쪽 가격만 알아도 반대편 토큰 가격 추론
          // V2는 x*y=k 구조 → price0 * reserve0 = price1 * reserve1
          // 사용자 보유 amount 비율 = reserve 비율이므로 역산 가능
          positions.v2.forEach((pos: any) => {
            const addr0 = (pos.token0Addr || "").toLowerCase();
            const addr1 = (pos.token1Addr || "").toLowerCase();
            const a0 = pos.amount0 || 0;
            const a1 = pos.amount1 || 0;
            if (a0 > 0 && a1 > 0) {
              const p0 = Number(pMap[addr0] || 0);
              const p1 = Number(pMap[addr1] || 0);
              if (p0 > 0 && !p1) {
                pMap[addr1] = String(p0 * (a0 / a1));
              } else if (p1 > 0 && !p0) {
                pMap[addr0] = String(p1 * (a1 / a0));
              }
            }
          });

          setTokenPrices(pMap);
        }
      } catch (e) {
        setError("Failed to load data");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [address, chainId, pools]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 size={28} className="animate-spin text-blue-500" />
        <p className="text-sm text-gray-400">Scanning on-chain liquidity…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
          <AlertTriangle size={20} className="text-red-500" />
        </div>
        <p className="text-sm text-gray-500">{error || "Wallet not found"}</p>
        <button onClick={() => router.back()} className="text-sm text-blue-600 hover:underline">
          Go Back
        </button>
      </div>
    );
  }

  const walletLabel = dbWallet?.label || "Tracked Wallet";
  const totalPositions = lpPositions.v2.length + lpPositions.v3.length;

  // V3 포지션 총 가치 (deposit + rewards)
  const v3TotalValue = lpPositions.v3.reduce((sum: number, pos: any) => {
    const p0 = Number(tokenPrices[(pos.token0?.address || "").toLowerCase()] || 0);
    const p1 = Number(tokenPrices[(pos.token1?.address || "").toLowerCase()] || 0);
    return sum + (pos.amount0 || 0) * p0 + (pos.amount1 || 0) * p1
                + (pos.fees0 || 0) * p0 + (pos.fees1 || 0) * p1;
  }, 0);

  // V2 포지션 총 가치
  const v2TotalValue = lpPositions.v2.reduce((sum: number, pos: any) => {
    const p0 = Number(tokenPrices[(pos.token0Addr || "").toLowerCase()] || 0);
    const p1 = Number(tokenPrices[(pos.token1Addr || "").toLowerCase()] || 0);
    return sum + (pos.amount0 || 0) * p0 + (pos.amount1 || 0) * p1;
  }, 0);

  const totalLPValue = v3TotalValue + v2TotalValue;

  return (
    <div>
      {/* Header — 2-row layout (same structure as pool detail) */}
      <div className="mb-7 space-y-2">
        {/* Row 1: back ← + wallet label + LP badge */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="h-9 w-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shrink-0"
          >
            <ArrowLeft size={15} className="text-gray-500" />
          </button>
          <div className="h-9 flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 flex-1 min-w-0 overflow-hidden">
            <span className="text-sm font-semibold text-gray-900 whitespace-nowrap truncate">{walletLabel}</span>
          </div>
        </div>

        {/* Row 2: address pill (copy+explorer 포함) */}
        <div className="flex items-center gap-2">
          <div className="h-9 flex items-center min-w-0 overflow-hidden flex-1 bg-white border border-gray-200 rounded-lg divide-x divide-gray-200">
            <div className="flex items-center gap-1.5 px-3 min-w-0 overflow-hidden flex-1">
              <span className="text-[11px] text-gray-400 shrink-0">Address</span>
              <span className="text-[12px] font-mono text-gray-600 truncate">{data.address}</span>
            </div>
            <button
              onClick={handleCopy}
              className="h-full px-2.5 flex items-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
              title="Copy address"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>
            <a
              href={`${chain.explorer}address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-full px-2.5 flex items-center gap-1 text-[12px] font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
              title="Explorer"
            >
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* LP Positions 카운트 — total only */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-4">LP Positions</div>
          <div className="text-xl font-semibold text-gray-900">{totalPositions}</div>
        </div>

        {/* Total Value (V2 + V3) */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-4">Total Value</div>
          {isLoading || Object.keys(tokenPrices).length === 0 ? (
            <div className="flex items-center gap-1.5 text-sm text-gray-400">
              <Loader2 size={13} className="animate-spin" /> Loading…
            </div>
          ) : (
            <div className="text-xl font-semibold text-gray-900">{fmtFullUSD(totalLPValue)}</div>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {/* V3 Positions */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-800">V3 Concentrated Liquidity</span>
            <div className="flex items-center gap-2">
              {v3TotalValue > 0 && (
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  {fmtFullUSD(v3TotalValue)}
                </span>
              )}
              <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                NFT · {lpPositions.v3.length}
              </span>
            </div>
          </div>

          {lpPositions.v3.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
              {lpPositions.v3.map((pos: any) => {
                const p0 = Number(tokenPrices[(pos.token0?.address || "").toLowerCase()] || 0);
                const p1 = Number(tokenPrices[(pos.token1?.address || "").toLowerCase()] || 0);
                const dep0Val = (pos.amount0 || 0) * p0;
                const dep1Val = (pos.amount1 || 0) * p1;
                const rew0Val = (pos.fees0 || 0) * p0;
                const rew1Val = (pos.fees1 || 0) * p1;
                const total0 = (pos.amount0 || 0) + (pos.fees0 || 0);
                const total1 = (pos.amount1 || 0) + (pos.fees1 || 0);
                const totalVal = dep0Val + dep1Val + rew0Val + rew1Val;
                const sym0 = pos.token0?.symbol || "?";
                const sym1 = pos.token1?.symbol || "?";
                const hasAmounts = pos.amount0 !== undefined;

                const blocks = [
                  {
                    label: "Deposit",
                    amt0: pos.amount0 || 0,
                    amt1: pos.amount1 || 0,
                    value: dep0Val + dep1Val,
                    bg: "bg-white border-gray-100",
                    labelCls: "text-gray-500",
                    valueCls: "text-gray-700",
                  },
                  {
                    label: "Rewards",
                    amt0: pos.fees0 || 0,
                    amt1: pos.fees1 || 0,
                    value: rew0Val + rew1Val,
                    bg: "bg-amber-50 border-amber-100",
                    labelCls: "text-amber-600",
                    valueCls: "text-amber-700",
                  },
                  {
                    label: "Total",
                    amt0: total0,
                    amt1: total1,
                    value: totalVal,
                    bg: "bg-blue-50 border-blue-100",
                    labelCls: "text-blue-600",
                    valueCls: "text-blue-600",
                  },
                ];

                return (
                  <div key={pos.tokenId} className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex flex-col gap-3">

                    {/* 헤더: 페어 + 배지 + NFT ID */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800">{sym0} / {sym1}</span>
                        <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          V3 {pos.fee}%
                        </span>
                        {hasAmounts && (
                          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${pos.inRange ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                            {pos.inRange ? "In Range" : "Out"}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-400 font-mono shrink-0 bg-white border border-gray-100 rounded px-1.5 py-0.5">
                        #{pos.tokenId}
                      </span>
                    </div>

                    {/* 가격 범위 */}
                    <div className="px-3 py-2.5 bg-white rounded-lg border border-gray-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-gray-400 font-medium">Price Range</span>
                        {hasAmounts && pos.currentPrice > 0 && (
                          <span className="text-[10px] text-gray-400">
                            1 {sym0} = <span className="font-mono font-medium text-gray-600">{fmtRate(pos.currentPrice)}</span> {sym1}
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] font-mono font-medium text-gray-800">
                        {hasAmounts
                          ? `${fmtPrice(pos.priceLower)} ~ ${fmtPrice(pos.priceUpper)}`
                          : `Tick ${Number(pos.tickLower).toLocaleString()} ~ ${Number(pos.tickUpper).toLocaleString()}`
                        }
                      </div>
                    </div>

                    {/* 수량 블록 (3열) */}
                    {hasAmounts ? (
                      <div className="grid grid-cols-3 gap-2">
                        {blocks.map(b => (
                          <div key={b.label} className={`${b.bg} border rounded-xl p-2.5 flex flex-col gap-1`}>
                            <span className={`text-[10px] font-semibold ${b.labelCls}`}>{b.label}</span>
                            <div>
                              <div className="text-[11px] font-mono font-medium text-gray-800 truncate">{fmtAmt(b.amt0)}</div>
                              <div className="text-[9px] text-gray-400">{sym0}</div>
                            </div>
                            <div>
                              <div className="text-[11px] font-mono font-medium text-gray-800 truncate">{fmtAmt(b.amt1)}</div>
                              <div className="text-[9px] text-gray-400">{sym1}</div>
                            </div>
                            <div className={`text-[11px] font-semibold ${b.valueCls} mt-auto pt-1 border-t border-black/5`}>
                              {fmtFullUSD(b.value)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-400 text-center py-1">
                        Liquidity: {pos.liquidity.slice(0, 16)}…
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400">
              No V3 positions
            </div>
          )}
        </div>

        {/* V2 Positions */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-800">V2 LP Holdings</span>
            <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
              ERC20 · {lpPositions.v2.length}
            </span>
          </div>

          {lpPositions.v2.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {lpPositions.v2.map((pos: any) => {
                // 이름: pos.pool.label (blockchain.ts에서 sym0/sym1로 세팅됨) > fallback
                const sym0 = pos.tokenSymbols?.sym0 || pos.pool?.label?.split(" / ")[0] || "?";
                const sym1 = pos.tokenSymbols?.sym1 || pos.pool?.label?.split(" / ")[1] || "?";
                const pairName = (sym0 && sym0 !== "?") ? `${sym0} / ${sym1}` : `V2 LP (${pos.pool.address.slice(0, 8)}…)`;
                const p0 = Number(tokenPrices[(pos.token0Addr || "").toLowerCase()] || 0);
                const p1 = Number(tokenPrices[(pos.token1Addr || "").toLowerCase()] || 0);
                const val0 = (pos.amount0 || 0) * p0;
                const val1 = (pos.amount1 || 0) * p1;
                const totalV = val0 + val1;
                const hasValue = (p0 > 0 || p1 > 0) && pos.amount0 !== null;

                return (
                  <div key={pos.pool.address} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1 py-0.5 rounded">V2</span>
                          <span className="text-sm font-semibold text-gray-900">{pairName}</span>
                        </div>
                        <div className="text-[11px] font-mono text-gray-400">{pos.pool.address.slice(0, 10)}…{pos.pool.address.slice(-8)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        {hasValue ? (
                          <div className="text-sm font-semibold text-blue-600">{fmtFullUSD(totalV)}</div>
                        ) : (
                          <div className="text-sm text-gray-400">—</div>
                        )}
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {Number(pos.formattedBalance).toFixed(6)} LP
                        </div>
                      </div>
                    </div>
                    {pos.amount0 !== null && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                          <div className="text-[10px] text-gray-400 mb-0.5">{sym0}</div>
                          <div className="text-[12px] font-mono font-medium text-gray-800">{fmtAmt(pos.amount0)}</div>
                          {p0 > 0 && <div className="text-[10px] text-gray-400">{fmtFullUSD(val0)}</div>}
                        </div>
                        <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                          <div className="text-[10px] text-gray-400 mb-0.5">{sym1}</div>
                          <div className="text-[12px] font-mono font-medium text-gray-800">{fmtAmt(pos.amount1)}</div>
                          {p1 > 0 && <div className="text-[10px] text-gray-400">{fmtFullUSD(val1)}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400">
              No V2 LP tokens
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
