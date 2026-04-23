"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { getPoolData, fetchTokenPrices, getPoolRateAtBlock } from "@/lib/blockchain";
import { getChain, fmtAmt, fmtRate, fmtFullUSD } from "@/lib/utils";
import { ArrowLeft, ExternalLink, Loader2, AlertTriangle, Trash2, Copy, Check, History, Search } from "lucide-react";

export default function PoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const address = params.address as string;
  const { chainId, pools, removePool, togglePoolStatus, metadata, tokenPrices: ctxPrices } = useApp();
  const chain = getChain(chainId);

  const [data, setData] = useState<any>(null);
  const [tokenPrices, setTokenPrices] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Historical rate at block
  const [blockInput, setBlockInput] = useState("");
  const [histResult, setHistResult] = useState<{ block: string; rate: number; r0?: number; r1?: number } | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState<string | null>(null);

  const handleHistoricalRate = async () => {
    const blockNum = blockInput.trim().replace(/,/g, "");
    if (!blockNum || isNaN(Number(blockNum))) return;
    setHistLoading(true);
    setHistError(null);
    setHistResult(null);
    try {
      const dec0 = data?.token0?.decimals ?? 18;
      const dec1 = data?.token1?.decimals ?? 18;
      const result = await getPoolRateAtBlock(
        address, chainId, BigInt(blockNum),
        data?.type ?? "v3", dec0, dec1,
      );
      setHistResult({ block: blockNum, ...result });
    } catch (e: any) {
      setHistError(e?.shortMessage || e?.message || "조회 실패");
    } finally {
      setHistLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const dbPool = pools.find(p => p.address.toLowerCase() === address.toLowerCase());

  const handleDelete = async () => {
    if (!dbPool) return;
    setIsDeleting(true);
    await removePool(dbPool.id);
    router.push("/pools");
  };

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        // type is determined on-chain by getPoolData; DB no longer stores it
        const enriched = await getPoolData(address, chainId, "v3");
        setData(enriched);
        const pResults = await fetchTokenPrices(
          [enriched.token0.address, enriched.token1.address],
          chainId,
          pools,
          [],
          metadata
        );
        const pMap: Record<string, string> = {};
        // context prices as base (stablecoin 포함), 온체인 결과로 덮어쓰기
        Object.entries(ctxPrices).forEach(([addr, price]) => { if (price > 0) pMap[addr] = String(price); });
        pResults.forEach((r: any) => { if (Number(r.price) > 0) pMap[r.address.toLowerCase()] = r.price; });
        setTokenPrices(pMap);
      } catch (e: any) {
        const msg: string = e?.message || e?.shortMessage || "";
        const isNotDeployed =
          msg.includes("returned no data") ||
          msg.includes("does not have the function") ||
          msg.includes("is not a contract");
        setError(isNotDeployed ? "__NOT_DEPLOYED__" : msg || "Failed to load on-chain data");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [address, chainId, dbPool]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 size={28} className="animate-spin text-blue-500" />
        <p className="text-sm text-gray-400">Loading on-chain data…</p>
      </div>
    );
  }

  if (error || !data) {
    const isNotDeployed = error === "__NOT_DEPLOYED__";
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 max-w-sm mx-auto text-center">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isNotDeployed ? "bg-amber-50" : "bg-red-50"}`}>
          <AlertTriangle size={22} className={isNotDeployed ? "text-amber-500" : "text-red-500"} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-1">
            {isNotDeployed ? "Contract Not Yet Deployed" : "Failed to Load Data"}
          </h2>
          <p className="text-sm text-gray-500">
            {isNotDeployed
              ? "This contract has not been deployed on-chain yet."
              : error}
          </p>
          <p className="text-[11px] text-gray-400 font-mono mt-1">{address}</p>
        </div>
        <div className="flex gap-2">
          {!isNotDeployed && (
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-black transition-colors">
              Retry
            </button>
          )}
          <button onClick={() => router.back()} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // 로컬 fetch → ctxPrices 순서로 가격 조회 (metadata 업데이트 후 ctxPrices 먼저 반영됨)
  const getPrice = (addr: string): number => {
    const local = Number(tokenPrices[addr.toLowerCase()] || 0);
    if (local > 0) return local;
    return ctxPrices[addr.toLowerCase()] || 0;
  };

  const t0Value = Number(data.token0.balance) * getPrice(data.token0.address);
  const t1Value = Number(data.token1.balance) * getPrice(data.token1.address);
  // 직접 계산값 우선 사용 (게이트웨이 TVL은 V2에서 한쪽만 반환하는 버그 있음)
  const computedTVL = t0Value + t1Value;
  const effectiveTVL = computedTVL > 0 ? computedTVL : Number(data.tvl);

  return (
    <div>
      {/* 삭제 확인 다이얼로그 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-[360px] mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
                <Trash2 size={16} className="text-red-500" />
              </div>
              <h2 className="text-base font-semibold text-gray-900">Delete Pool</h2>
            </div>
            <p className="text-sm text-gray-500 mb-1">
              Remove <span className="font-medium text-gray-700">{data.token0.symbol} / {data.token1.symbol}</span> from your pool list?
            </p>
            <p className="text-[12px] text-gray-400 mb-5">This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                {isDeleting && <Loader2 size={13} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header — 2-row layout: always predictable on mobile & desktop */}
      <div className="mb-7 space-y-2">
        {/* Row 1: back ← + pool title + badges */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="h-9 w-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shrink-0"
          >
            <ArrowLeft size={15} className="text-gray-500" />
          </button>

          <div className="h-9 flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 flex-1 min-w-0 overflow-hidden">
            <span className="text-sm font-semibold text-gray-900 whitespace-nowrap truncate">
              {data.token0.symbol} / {data.token1.symbol}
            </span>
            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0 ${data.type === "v3" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-700"}`}>
              {data.type?.toUpperCase()}
            </span>
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">
              {data.fee}%
            </span>
            {dbPool && (
              <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0 ${dbPool.status === "i" ? "bg-gray-100 text-gray-400" : "bg-emerald-50 text-emerald-700"}`}>
                {dbPool.status === "i" ? "Inactive" : "Active"}
              </span>
            )}
          </div>
        </div>

        {/* Row 2: address pill (copy+explorer 포함) + Set Inactive/Delete 그룹 */}
        <div className="flex items-center gap-2">
          {/* 주소 + 복사 + Explorer — 하나의 pill */}
          <div className="h-9 flex items-center min-w-0 overflow-hidden flex-1 bg-white border border-gray-200 rounded-lg divide-x divide-gray-200">
            <div className="flex items-center gap-1.5 px-3 min-w-0 overflow-hidden flex-1">
              <span className="text-[11px] text-gray-400 shrink-0">Contract</span>
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

          {/* Set Inactive + Delete — 붙어있는 버튼 그룹 */}
          {dbPool && (
            <div className="flex items-center h-9 bg-white border border-gray-200 rounded-lg overflow-hidden divide-x divide-gray-200 shrink-0">
              <button
                onClick={() => togglePoolStatus(dbPool.id, dbPool.status)}
                className="h-full px-3 text-[12px] font-medium text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                {dbPool.status === "i" ? "Activate" : "Set Inactive"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="h-full px-2.5 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Delete pool"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        {/* Exchange Rates */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-4">Exchange Rate</div>
          <div className="space-y-4">
            <div>
              <div className="text-[11px] text-gray-400 mb-1">1 {data.token0.symbol} =</div>
              <div className="text-lg font-semibold text-gray-900 truncate">
                {fmtRate(data.price)} <span className="text-sm font-normal text-gray-400">{data.token1.symbol}</span>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-100">
              <div className="text-[11px] text-gray-400 mb-1">1 {data.token1.symbol} =</div>
              <div className="text-lg font-semibold text-gray-900 truncate">
                {data.price > 0 ? fmtRate(1 / data.price) : "—"} <span className="text-sm font-normal text-gray-400">{data.token0.symbol}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Liquidity Amounts */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-4">Liquidity Balance</div>
          <div className="space-y-4">
            <div>
              <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{data.token0.symbol}</span>
              <div className="text-lg font-semibold text-gray-900 truncate mt-1">{fmtAmt(data.token0.balance)}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{fmtFullUSD(t0Value)}</div>
            </div>
            <div className="pt-4 border-t border-gray-100">
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{data.token1.symbol}</span>
              <div className="text-lg font-semibold text-gray-900 truncate mt-1">{fmtAmt(data.token1.balance)}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{fmtFullUSD(t1Value)}</div>
            </div>
          </div>
        </div>

        {/* TVL + Info */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-4">TVL</div>
          <div className="text-[11px] text-gray-400 mb-1">Total Value Locked</div>
          <div className="text-xl font-semibold text-gray-900 truncate">{fmtFullUSD(effectiveTVL)}</div>
          {data.type === "v3" && (
            <div className="border-t border-gray-100 mt-4 pt-4">
              <div className="text-[11px] text-gray-400 mb-1">Current Tick</div>
              <div className="text-lg font-semibold text-gray-900 font-mono">{data.tick}</div>
            </div>
          )}
        </div>
      </div>

      {/* Historical Rate Lookup */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <History size={14} className="text-gray-400" />
          <span className="text-xs text-gray-500 font-medium">Historical Exchange Rate</span>
          <span className="text-[11px] text-gray-300">— 특정 블록 시점의 교환비 조회</span>
        </div>

        {/* Input row */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg focus-within:border-blue-400 focus-within:bg-white transition-colors">
            <span className="text-[11px] text-gray-400 shrink-0">Block #</span>
            <input
              type="text"
              inputMode="numeric"
              value={blockInput}
              onChange={e => {
                setBlockInput(e.target.value);
                setHistResult(null);
                setHistError(null);
              }}
              onKeyDown={e => e.key === "Enter" && handleHistoricalRate()}
              placeholder="e.g. 12345678"
              className="flex-1 bg-transparent text-sm font-mono text-gray-800 placeholder:text-gray-300 outline-none min-w-0"
            />
          </div>
          <button
            onClick={handleHistoricalRate}
            disabled={histLoading || !blockInput.trim()}
            className="h-9 px-4 flex items-center gap-1.5 bg-gray-900 hover:bg-black disabled:opacity-40 text-white text-[13px] font-medium rounded-lg transition-colors shrink-0"
          >
            {histLoading
              ? <Loader2 size={13} className="animate-spin" />
              : <Search size={13} />
            }
            {histLoading ? "조회 중…" : "조회"}
          </button>
        </div>

        {/* Result */}
        {histError && (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <AlertTriangle size={12} />
            {histError}
          </div>
        )}

        {histResult && !histError && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Rate A→B */}
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <div className="text-[11px] text-gray-400 mb-1">
                1 {data.token0.symbol} = &nbsp;
                <span className="font-mono text-[10px] text-gray-300">block #{histResult.block}</span>
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {fmtRate(histResult.rate)}{" "}
                <span className="text-sm font-normal text-gray-400">{data.token1.symbol}</span>
              </div>
              {/* 현재 대비 변화율 */}
              {data.price > 0 && (() => {
                const diff = ((histResult.rate - data.price) / data.price) * 100;
                const isPos = diff > 0;
                return (
                  <div className={`text-[11px] mt-1 font-medium ${isPos ? "text-emerald-600" : "text-red-500"}`}>
                    {isPos ? "▲" : "▼"} {Math.abs(diff).toFixed(2)}% vs 현재
                  </div>
                );
              })()}
            </div>

            {/* Rate B→A */}
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <div className="text-[11px] text-gray-400 mb-1">
                1 {data.token1.symbol} = &nbsp;
                <span className="font-mono text-[10px] text-gray-300">block #{histResult.block}</span>
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {histResult.rate > 0 ? fmtRate(1 / histResult.rate) : "—"}{" "}
                <span className="text-sm font-normal text-gray-400">{data.token0.symbol}</span>
              </div>
              {/* V2: reserve 수량도 표시 */}
              {histResult.r0 !== undefined && (
                <div className="text-[11px] text-gray-400 mt-1">
                  Reserve {fmtAmt(histResult.r0)} / {fmtAmt(histResult.r1 ?? 0)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
