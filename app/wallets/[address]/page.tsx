"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { getWalletData, getWalletLPPositions, fetchTokenPrices } from "@/lib/blockchain";
import { getChain, fmtAmt, fmtRate, fmtFull, fmtFullUSD } from "@/lib/utils";
import { ArrowLeft, ExternalLink, Loader2, AlertTriangle } from "lucide-react";

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
  const { chainId, wallets, pools, metadata } = useApp();
  const chain = getChain(chainId);

  const [data, setData] = useState<any>(null);
  const [lpPositions, setLpPositions] = useState<{ v2: any[]; v3: any[] }>({ v2: [], v3: [] });
  const [tokenPrices, setTokenPrices] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          ...positions.v2.map((p: any) => p.pool?.address).filter(Boolean),
        ].filter(Boolean).filter((v: string, i: number, a: string[]) =>
          a.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i
        );
        if (allTokenAddrs.length > 0) {
          const priceResults = await fetchTokenPrices(allTokenAddrs, chainId);
          const pMap: Record<string, string> = {};
          priceResults.forEach((r: any) => { if (r.price) pMap[r.address.toLowerCase()] = r.price; });
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

  return (
    <div className="max-w-[1100px]">
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
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 shrink-0">LP</span>
          </div>
        </div>

        {/* Row 2: address (left) + Explorer (right) — always full-width */}
        <div className="flex items-center gap-2">
          <div className="h-9 flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 min-w-0 overflow-hidden">
            <span className="text-[11px] text-gray-400 shrink-0">Address</span>
            <span className="text-[12px] font-mono text-gray-600 truncate">
              {data.address.slice(0, 6)}…{data.address.slice(-6)}
            </span>
          </div>
          <div className="ml-auto shrink-0">
            <a
              href={`${chain.explorer}address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 flex items-center gap-1.5 text-[12px] font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Explorer <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="bg-white border border-gray-100 rounded-xl px-5 py-3.5 flex items-center gap-4">
          <div>
            <div className="text-[10px] text-gray-400 mb-0.5">LP Positions</div>
            <div className="text-xl font-semibold text-gray-900">{totalPositions}</div>
          </div>
          {(lpPositions.v2.length > 0 || lpPositions.v3.length > 0) && (
            <div className="flex items-center gap-2 border-l border-gray-100 pl-4">
              {lpPositions.v3.length > 0 && (
                <div className="text-center">
                  <div className="text-[10px] text-gray-400">V3</div>
                  <div className="text-sm font-semibold text-blue-600">{lpPositions.v3.length}</div>
                </div>
              )}
              {lpPositions.v2.length > 0 && (
                <div className="text-center">
                  <div className="text-[10px] text-gray-400">V2</div>
                  <div className="text-sm font-semibold text-amber-600">{lpPositions.v2.length}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {/* V3 Positions */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-800">V3 Concentrated Liquidity</span>
            <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              NFT · {lpPositions.v3.length}
            </span>
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
                const meta = metadata[pos.pool.address.toLowerCase()];
                return (
                  <div key={pos.pool.address} className="px-5 py-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {meta?.isValid ? `${meta.symbol0} / ${meta.symbol1}` : `V2 LP (${pos.pool.address.slice(0, 8)}…)`}
                      </div>
                      <div className="text-[11px] font-mono text-gray-400 mt-0.5 truncate">{pos.pool.address}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">{fmtAmt(pos.formattedBalance)}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">LP Token</div>
                    </div>
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
