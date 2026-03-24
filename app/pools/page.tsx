"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { fetchTokenPrices } from "@/lib/blockchain";
import { fmtFull, fmtFullUSD, downloadCSV, getChain } from "@/lib/utils";
import { Download, ChevronDown, ExternalLink, Trash2, Power, ArrowLeftRight } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function PoolsPage() {
  const { pools, tokens, chainId, isLoading, togglePoolStatus, removePool, metadata } = useApp();
  const chain = getChain(chainId);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [tokenPrices, setTokenPrices] = useState<Record<string, string>>({});
  const [showInactive, setShowInactive] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  // pool.id → true이면 reverse (Token1 기준)
  const [reversedRates, setReversedRates] = useState<Set<string>>(new Set());
  const toggleRate = (id: string) =>
    setReversedRates(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const currentPools = pools.filter(p => p.chain_id === chainId);
  const activePools = currentPools.filter(p => p.status === "a" || !p.status);
  const inactivePools = currentPools.filter(p => p.status === "i");

  React.useEffect(() => {
    async function loadPrices() {
      const allTokens = new Set<string>();
      Object.values(metadata).forEach((m: any) => {
        if (m.isValid) {
          allTokens.add(m.token0.toLowerCase());
          allTokens.add(m.token1.toLowerCase());
        }
      });
      if (allTokens.size === 0) return;
      try {
        const chainTokens = tokens.filter((t: any) => t.chain_id === chainId);
        const prices = await fetchTokenPrices(Array.from(allTokens), chainId, pools, chainTokens, metadata);
        const pMap: any = {};
        prices.forEach((p: any) => (pMap[p.address.toLowerCase()] = p.price));
        setTokenPrices(pMap);
      } catch (e) {
        console.error("Failed to load prices", e);
      }
    }
    loadPrices();
  }, [chainId, metadata]);

  const aggregates = useMemo(() => {
    const tokenMap: Record<string, { symbol: string; amount: number; value: number }> = {};
    let totalTVL = 0;
    const SANE = 1e13;
    activePools.forEach(pool => {
      const meta = metadata[pool.address.toLowerCase()];
      if (!meta?.isValid) return;
      const tvl = Number(meta.tvl || 0);
      if (isFinite(tvl) && tvl < SANE) totalTVL += tvl;
      const t0Addr = meta.token0.toLowerCase();
      const t0Amt = Number(meta.t0Amt); const t0Price = Number(tokenPrices[t0Addr] || 0);
      if (!tokenMap[t0Addr]) tokenMap[t0Addr] = { symbol: meta.symbol0, amount: 0, value: 0 };
      if (isFinite(t0Amt) && t0Amt < SANE) { tokenMap[t0Addr].amount += t0Amt; tokenMap[t0Addr].value += t0Amt * t0Price; }
      const t1Addr = meta.token1.toLowerCase();
      const t1Amt = Number(meta.t1Amt); const t1Price = Number(tokenPrices[t1Addr] || 0);
      if (!tokenMap[t1Addr]) tokenMap[t1Addr] = { symbol: meta.symbol1, amount: 0, value: 0 };
      if (isFinite(t1Amt) && t1Amt < SANE) { tokenMap[t1Addr].amount += t1Amt; tokenMap[t1Addr].value += t1Amt * t1Price; }
    });
    return { tokenTotals: Object.values(tokenMap).sort((a, b) => b.value - a.value).slice(0, 6), totalTVL };
  }, [activePools, metadata, tokenPrices]);

  const handleExport = (list: typeof pools, fileName: string) => {
    const rows = [["Type", "Pair", "Fee", "Exchange Rate", "T0 Amount", "T0 Symbol", "T0 Value", "T1 Amount", "T1 Symbol", "T1 Value", "TVL", "Address"]];
    list.forEach(p => {
      const meta = metadata[p.address.toLowerCase()];
      if (meta?.isValid) {
        const v0 = Number(meta.t0Amt) * Number(tokenPrices[meta.token0.toLowerCase()] || 0);
        const v1 = Number(meta.t1Amt) * Number(tokenPrices[meta.token1.toLowerCase()] || 0);
        rows.push([meta.type, `${meta.symbol0}/${meta.symbol1}`, `${meta.fee}%`, meta.price, meta.t0Amt, meta.symbol0, v0, meta.t1Amt, meta.symbol1, v1, meta.tvl, p.address]);
      }
    });
    downloadCSV(rows, `${fileName}.csv`);
    setShowExportMenu(false);
  };

  const displayedPools = showInactive ? currentPools : activePools;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Pool Manager</h1>
          <p className="text-sm text-gray-500 mt-0.5">온체인 유동성 풀 목록 및 현황 관리</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black text-white text-[13px] font-medium rounded-lg transition-colors"
          >
            <Download size={13} />
            Export
            <ChevronDown size={12} className={"transition-transform " + (showExportMenu ? "rotate-180" : "")} />
          </button>
          {showExportMenu && (
            <div className="absolute right-0 mt-1.5 w-44 bg-white border border-gray-100 rounded-lg shadow-lg z-50 overflow-hidden py-1">
              <button onClick={() => handleExport(activePools, "active_pools")} className="w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50 text-gray-700">
                Active Pools
              </button>
              <button onClick={() => handleExport(inactivePools, "inactive_pools")} className="w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50 text-gray-700">
                Inactive Pools
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button onClick={() => handleExport(currentPools, "all_pools")} className="w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50 text-gray-700">
                전체 내보내기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {!isLoading && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-xs text-gray-500 mb-2">Total TVL (Active)</div>
            <div className="text-2xl font-semibold text-gray-900">{fmtFullUSD(aggregates.totalTVL)}</div>
          </div>
          <div className="col-span-3 bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-xs text-gray-500 mb-3">Token 별 집계 (Active 풀 기준)</div>
            <div className="flex gap-8 overflow-x-auto scrollbar-none">
              {aggregates.tokenTotals.map(t => (
                <div key={t.symbol} className="shrink-0 pr-8 border-r border-gray-100 last:border-0 last:pr-0">
                  <div className="text-[13px] font-medium text-gray-700">{t.symbol}</div>
                  <div className="text-base font-semibold text-gray-900 mt-0.5">{fmtFull(t.amount, 2)}</div>
                  <div className="text-xs text-gray-400">{fmtFullUSD(t.value)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pool Table */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        {/* Table Header Controls */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-800">풀 목록</span>
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
              {displayedPools.length}개
            </span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-[13px] text-gray-500">비활성 포함</span>
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${showInactive ? "bg-blue-600" : "bg-gray-200"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${showInactive ? "left-[18px]" : "left-0.5"}`} />
            </button>
          </label>
        </div>

        {/* 스크롤 엣지 페이드 래퍼 */}
        <div className="relative">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[820px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="pl-5 pr-3 py-3 text-[11px] font-medium text-gray-500 w-8 text-center">#</th>
                  <th className="px-3 py-3 text-[11px] font-medium text-gray-500">Pool</th>
                  <th className="px-3 py-3 text-[11px] font-medium text-gray-500 text-right">Exchange Rate</th>
                  <th className="px-3 py-3 text-[11px] font-medium text-gray-500 text-right">Token 0</th>
                  <th className="px-3 py-3 text-[11px] font-medium text-gray-500 text-right">Token 1</th>
                  <th className="px-3 py-3 text-[11px] font-medium text-gray-500 text-right">TVL</th>
                  <th className="pl-3 pr-5 py-3 text-[11px] font-medium text-gray-500 w-24 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {displayedPools.map((pool, idx) => {
                  const meta = metadata[pool.address.toLowerCase()];
                  const prices0 = Number(tokenPrices[meta?.token0?.toLowerCase()] || 0);
                  const prices1 = Number(tokenPrices[meta?.token1?.toLowerCase()] || 0);
                  const a0 = Number(meta?.t0Amt || 0);
                  const a1 = Number(meta?.t1Amt || 0);
                  const isInactive = pool.status === "i";

                  return (
                    <tr key={pool.id} className={"border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors " + (isInactive ? "opacity-40" : "")}>
                      <td className="pl-5 pr-3 py-3.5 text-[12px] text-gray-400 text-center">{idx + 1}</td>
                      <td className="px-3 py-3.5">
                        {meta?.isValid ? (
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">
                              {meta.symbol0} / {meta.symbol1}
                            </span>
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0 ${meta.type === "v3" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-700"}`}>
                              {meta.type?.toUpperCase()}
                            </span>
                            <span className="text-[11px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded shrink-0">{meta.fee}%</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 font-mono">{pool.address.slice(0, 10)}…</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        {meta?.isValid ? (() => {
                          const isReversed = reversedRates.has(pool.id);
                          const rate = isReversed
                            ? (Number(meta.price) !== 0 ? fmtFull(1 / Number(meta.price), 4) : "—")
                            : fmtFull(meta.price, 4);
                          const base = isReversed ? meta.symbol1 : meta.symbol0;
                          return (
                            <button
                              onClick={() => toggleRate(pool.id)}
                              className="flex items-center justify-end gap-1.5 w-full group"
                              title="클릭해서 반전"
                            >
                              <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{rate}</span>
                              <span className="text-[11px] text-gray-400 whitespace-nowrap">/ 1 {base}</span>
                              <ArrowLeftRight size={11} className="text-gray-300 group-hover:text-blue-400 transition-colors shrink-0" />
                            </button>
                          );
                        })() : (
                          <div className="text-sm text-gray-300 text-right">—</div>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{fmtFull(a0, 2)}</span>
                          <span className="text-[11px] text-gray-400 whitespace-nowrap">{fmtFullUSD(a0 * prices0)}</span>
                          <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">{meta?.symbol0}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{fmtFull(a1, 2)}</span>
                          <span className="text-[11px] text-gray-400 whitespace-nowrap">{fmtFullUSD(a1 * prices1)}</span>
                          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">{meta?.symbol1}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <span className="text-sm font-semibold text-gray-900">{meta?.isValid ? fmtFullUSD(meta.tvl) : "—"}</span>
                      </td>
                      {/* Power(toggle) + Explorer + Delete */}
                      <td className="pl-3 pr-5 py-3.5">
                        <div className="flex items-center justify-end gap-0.5">
                          {/* 활성/비활성 토글 */}
                          <button
                            onClick={() => togglePoolStatus(pool.id, pool.status)}
                            title={isInactive ? "활성화" : "비활성화"}
                            className={[
                              "w-7 h-7 flex items-center justify-center rounded-lg transition-colors",
                              isInactive
                                ? "text-gray-300 hover:text-emerald-500 hover:bg-emerald-50"
                                : "text-emerald-500 hover:text-gray-400 hover:bg-gray-100",
                            ].join(" ")}
                          >
                            <Power size={13} />
                          </button>

                          {/* Explorer */}
                          <a
                            href={`${chain.explorer.replace(/\/$/, "")}/address/${pool.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Explorer"
                          >
                            <ExternalLink size={13} />
                          </a>

                          {/* Delete */}
                          {confirmDelete === pool.id ? (
                            <div className="flex items-center gap-1 ml-0.5">
                              <button
                                onClick={() => { removePool(pool.id); setConfirmDelete(null); }}
                                className="text-[11px] font-medium px-2 py-0.5 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                              >
                                삭제
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="text-[11px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(pool.id)}
                              className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="삭제"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {displayedPools.length === 0 && (
              <EmptyState message="등록된 풀이 없습니다" height="h-40" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
