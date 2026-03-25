"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { getPoolData, fetchTokenPrices } from "@/lib/blockchain";
import { getChain, fmtAmt, fmtRate, fmtFullUSD } from "@/lib/utils";
import { ArrowLeft, ExternalLink, Loader2, AlertTriangle, Trash2 } from "lucide-react";

export default function PoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const address = params.address as string;
  const { chainId, pools, removePool, togglePoolStatus } = useApp();
  const chain = getChain(chainId);

  const [data, setData] = useState<any>(null);
  const [tokenPrices, setTokenPrices] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
        const type = dbPool?.type || "v3";
        const enriched = await getPoolData(address, chainId, type);
        setData(enriched);
        const pResults = await fetchTokenPrices([enriched.token0.address, enriched.token1.address], chainId);
        const pMap: Record<string, string> = {};
        pResults.forEach((r: any) => (pMap[r.address.toLowerCase()] = r.price));
        setTokenPrices(pMap);
      } catch (e: any) {
        setError(e.message || "Failed to load on-chain data");
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
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 max-w-sm mx-auto text-center">
        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
          <AlertTriangle size={22} className="text-red-500" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Failed to Load Data</h2>
          <p className="text-sm text-gray-500">{error}</p>
          <p className="text-[11px] text-gray-400 font-mono mt-1">{address}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-black transition-colors">
            Retry
          </button>
          <button onClick={() => router.back()} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const t0Value = Number(data.token0.balance) * Number(tokenPrices[data.token0.address.toLowerCase()] || 0);
  const t1Value = Number(data.token1.balance) * Number(tokenPrices[data.token1.address.toLowerCase()] || 0);

  return (
    <div className="max-w-[1100px]">
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

      {/* Header */}
      <div className="flex items-start sm:items-center gap-2 mb-7 flex-wrap">
        {/* 뒤로가기 */}
        <button
          onClick={() => router.back()}
          className="h-9 w-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shrink-0"
        >
          <ArrowLeft size={15} className="text-gray-500" />
        </button>

        {/* 풀 제목 + 배지 */}
        <div className="h-9 flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 shrink-0">
          <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
            {data.token0.symbol} / {data.token1.symbol}
          </span>
          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${data.type === "v3" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-700"}`}>
            {data.type?.toUpperCase()}
          </span>
          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
            {data.fee}%
          </span>
          {dbPool && (
            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${dbPool.status === "i" ? "bg-gray-100 text-gray-400" : "bg-emerald-50 text-emerald-700"}`}>
              {dbPool.status === "i" ? "Inactive" : "Active"}
            </span>
          )}
        </div>

        {/* 컨트랙트 주소 */}
        <div className="h-9 flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 shrink-0">
          <span className="text-[11px] text-gray-400">Contract</span>
          <span className="text-[12px] font-mono text-gray-600 whitespace-nowrap">
            {data.address.slice(0, 6)}…{data.address.slice(-6)}
          </span>
        </div>

        {/* 우측 액션 버튼들 */}
        <div className="ml-auto flex items-center gap-2 shrink-0 flex-wrap">
          {dbPool && (
            <button
              onClick={() => togglePoolStatus(dbPool.id, dbPool.status)}
              className="h-9 px-3 text-[12px] font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors whitespace-nowrap"
            >
              {dbPool.status === "i" ? "Activate" : "Set Inactive"}
            </button>
          )}
          <a
            href={`${chain.explorer}address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-3 flex items-center gap-1.5 text-[12px] font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
          >
            Explorer <ExternalLink size={12} />
          </a>
          {dbPool && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="h-9 w-9 flex items-center justify-center bg-white border border-gray-200 hover:border-red-200 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete pool"
            >
              <Trash2 size={14} className="text-gray-400 hover:text-red-500" />
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Exchange Rates */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-4">Exchange Rate</div>
          <div className="space-y-4">
            <div>
              <div className="text-lg font-semibold text-gray-900 truncate">{fmtRate(data.price)}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">1 {data.token0.symbol} = {data.token1.symbol}</div>
            </div>
            <div className="pt-4 border-t border-gray-100">
              <div className="text-lg font-semibold text-gray-900 truncate">
                {data.price > 0 ? fmtRate(1 / data.price) : "—"}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">1 {data.token1.symbol} = {data.token0.symbol}</div>
            </div>
          </div>
        </div>

        {/* Liquidity Amounts */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-4">Liquidity Balance</div>
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between">
                <div className="text-lg font-semibold text-gray-900 truncate">{fmtAmt(data.token0.balance)}</div>
                <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded shrink-0">{data.token0.symbol}</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">{fmtFullUSD(t0Value)}</div>
            </div>
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-baseline justify-between">
                <div className="text-lg font-semibold text-gray-900 truncate">{fmtAmt(data.token1.balance)}</div>
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">{data.token1.symbol}</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">{fmtFullUSD(t1Value)}</div>
            </div>
          </div>
        </div>

        {/* TVL + Info */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-4">TVL</div>
          <div className="text-xl font-semibold text-blue-600 mb-1 truncate">{fmtFullUSD(data.tvl)}</div>
          <div className="text-[11px] text-gray-400 mb-5">Total Value Locked</div>
          {data.type === "v3" && (
            <div className="border-t border-gray-100 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-gray-500">Current Tick</span>
                <span className="text-[12px] font-mono font-medium text-gray-800">{data.tick}</span>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
