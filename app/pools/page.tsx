"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { fetchTokenPrices } from "@/lib/blockchain";
import { fmtAmt, fmtRate, fmtFullUSD, downloadCSV, getChain } from "@/lib/utils";
import {
  Download, ChevronDown, ExternalLink, Trash2, Power,
  ArrowLeftRight, ChevronUp, ChevronsUpDown, X, GripVertical,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useRouter } from "next/navigation";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type SortKey = "pool" | "rate" | "token0" | "token1" | "tvl";
type SortDir = "asc" | "desc";

// ────────────────────────────────────────────────────────────
// Sortable row wrapper
// ────────────────────────────────────────────────────────────
function SortableRow({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: (
    dragHandleProps: React.HTMLAttributes<HTMLElement>,
    isDragging: boolean
  ) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative",
    zIndex: isDragging ? 1 : "auto",
  };

  return (
    <tr ref={setNodeRef} style={style}>
      {children({ ...attributes, ...listeners }, isDragging)}
    </tr>
  );
}

// ────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────
export default function PoolsPage() {
  const { pools, chainId, isLoading, togglePoolStatus, removePool, metadata, tokenMetadata } = useApp();
  const chain = getChain(chainId);
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [tokenPrices, setTokenPrices] = useState<Record<string, string>>({});
  const [showInactive, setShowInactive] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [reversedRates, setReversedRates] = useState<Set<string>>(new Set());
  const toggleRate = (id: string) =>
    setReversedRates(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // ── Filters
  const [filterType, setFilterType] = useState<"all" | "v2" | "v3">("all");
  const [filterToken, setFilterToken] = useState<string>("");
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);

  // ── Column sort
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Manual order
  const [poolOrder, setPoolOrder] = useState<string[]>([]);

  // ── Drag overlay (active drag id)
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const currentPools = pools.filter(p => p.chain_id === chainId);
  const activePools  = currentPools.filter(p => p.status === "a" || !p.status);
  const inactivePools = currentPools.filter(p => p.status === "i");

  // poolOrder 동기화 — 새 풀 추가/삭제 시 active 먼저
  React.useEffect(() => {
    setPoolOrder(prev => {
      const allIds = currentPools.map(p => p.id);
      const existing = prev.filter(id => allIds.includes(id));
      const newActive   = currentPools.filter(p => (p.status === "a" || !p.status) && !prev.includes(p.id)).map(p => p.id);
      const newInactive = currentPools.filter(p => p.status === "i"                 && !prev.includes(p.id)).map(p => p.id);
      return [...existing, ...newActive, ...newInactive];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, pools.length]);

  React.useEffect(() => {
    async function loadPrices() {
      const allTokens = new Set<string>();
      Object.values(metadata).forEach((m: any) => {
        if (m.isValid) { allTokens.add(m.token0.toLowerCase()); allTokens.add(m.token1.toLowerCase()); }
      });
      if (allTokens.size === 0) return;
      try {
        const regTokens = Object.entries(tokenMetadata).map(([addr, m]: [string, any]) => ({ address: addr, symbol: m.symbol || "" }));
        const prices = await fetchTokenPrices(Array.from(allTokens), chainId, pools, regTokens, metadata);
        const pMap: any = {};
        prices.forEach((p: any) => (pMap[p.address.toLowerCase()] = p.price));
        setTokenPrices(pMap);
      } catch (e) { console.error("Failed to load prices", e); }
    }
    loadPrices();
  }, [chainId, metadata, tokenMetadata, pools]);

  const getEffectiveTVL = (meta: any): number => {
    if (!meta?.isValid) return 0;
    const t0Price = Number(tokenPrices[meta.token0?.toLowerCase()] || 0);
    const t1Price = Number(tokenPrices[meta.token1?.toLowerCase()] || 0);
    const computed = Number(meta.t0Amt || 0) * t0Price + Number(meta.t1Amt || 0) * t1Price;
    return computed > 0 ? computed : Number(meta?.tvl || 0);
  };

  const aggregates = useMemo(() => {
    const tokenMap: Record<string, { symbol: string; amount: number; value: number }> = {};
    let totalTVL = 0;
    const SANE = 1e13;
    activePools.forEach(pool => {
      const meta = metadata[pool.address.toLowerCase()];
      if (!meta?.isValid) return;
      const tvl = getEffectiveTVL(meta);
      if (isFinite(tvl) && tvl < SANE) totalTVL += tvl;
      const t0Addr = meta.token0.toLowerCase(); const t0Amt = Number(meta.t0Amt); const t0Price = Number(tokenPrices[t0Addr] || 0);
      if (!tokenMap[t0Addr]) tokenMap[t0Addr] = { symbol: meta.symbol0, amount: 0, value: 0 };
      if (isFinite(t0Amt) && t0Amt < SANE) { tokenMap[t0Addr].amount += t0Amt; tokenMap[t0Addr].value += t0Amt * t0Price; }
      const t1Addr = meta.token1.toLowerCase(); const t1Amt = Number(meta.t1Amt); const t1Price = Number(tokenPrices[t1Addr] || 0);
      if (!tokenMap[t1Addr]) tokenMap[t1Addr] = { symbol: meta.symbol1, amount: 0, value: 0 };
      if (isFinite(t1Amt) && t1Amt < SANE) { tokenMap[t1Addr].amount += t1Amt; tokenMap[t1Addr].value += t1Amt * t1Price; }
    });
    return { tokenTotals: Object.values(tokenMap).sort((a, b) => b.value - a.value).slice(0, 6), totalTVL };
  }, [activePools, metadata, tokenPrices]);

  const allTokenSymbols = useMemo(() => {
    const set = new Set<string>();
    currentPools.forEach(pool => {
      const meta = metadata[pool.address.toLowerCase()];
      if (meta?.isValid) { set.add(meta.symbol0); set.add(meta.symbol1); }
    });
    return Array.from(set).sort();
  }, [currentPools, metadata]);

  const handleExport = (list: typeof pools, fileName: string) => {
    const rows: (string | number)[][] = [[
      "chain_id", "address", "type", "fee",
      "token0_symbol", "token0_address", "token0_amount", "token0_value_usd",
      "token1_symbol", "token1_address", "token1_amount", "token1_value_usd",
      "exchange_rate_t0_per_t1", "exchange_rate_t1_per_t0", "tvl_usd", "status",
    ]];
    list.forEach(p => {
      const meta = metadata[p.address.toLowerCase()];
      const t0Addr = meta?.token0 ?? ""; const t1Addr = meta?.token1 ?? "";
      const t0Price = Number(tokenPrices[t0Addr.toLowerCase()] || 0);
      const t1Price = Number(tokenPrices[t1Addr.toLowerCase()] || 0);
      const a0 = Number(meta?.t0Amt || 0); const a1 = Number(meta?.t1Amt || 0);
      const rate = meta?.isValid && meta.price ? Number(meta.price) : null;
      rows.push([
        p.chain_id, p.address, meta?.type ?? "", meta?.fee ?? "",
        meta?.symbol0 ?? "", t0Addr, meta?.isValid ? a0 : "", meta?.isValid && t0Price ? a0 * t0Price : "",
        meta?.symbol1 ?? "", t1Addr, meta?.isValid ? a1 : "", meta?.isValid && t1Price ? a1 * t1Price : "",
        rate !== null ? rate : "", rate !== null && rate !== 0 ? 1 / rate : "",
        meta?.isValid ? getEffectiveTVL(meta) : "", p.status === "i" ? "inactive" : "active",
      ]);
    });
    downloadCSV(rows, `${fileName}.csv`);
    setShowExportMenu(false);
  };

  // ── Filter → Sort pipeline
  const displayedPools = useMemo(() => {
    let list = showInactive ? currentPools : activePools;

    if (filterType !== "all")
      list = list.filter(p => metadata[p.address.toLowerCase()]?.type === filterType);
    if (filterToken) {
      const q = filterToken.toLowerCase();
      list = list.filter(p => {
        const meta = metadata[p.address.toLowerCase()];
        return meta?.isValid && (meta.symbol0.toLowerCase() === q || meta.symbol1.toLowerCase() === q);
      });
    }

    if (sortKey) {
      list = [...list].sort((a, b) => {
        const ma = metadata[a.address.toLowerCase()]; const mb = metadata[b.address.toLowerCase()];
        if (sortKey === "pool") {
          const na = ma?.isValid ? `${ma.symbol0}/${ma.symbol1}` : a.address;
          const nb = mb?.isValid ? `${mb.symbol0}/${mb.symbol1}` : b.address;
          return sortDir === "asc" ? na.localeCompare(nb) : nb.localeCompare(na);
        }
        let va = 0, vb = 0;
        if (sortKey === "tvl")    { va = getEffectiveTVL(ma); vb = getEffectiveTVL(mb); }
        if (sortKey === "rate")   { va = Number(ma?.price || 0); vb = Number(mb?.price || 0); }
        if (sortKey === "token0") { va = Number(ma?.t0Amt || 0); vb = Number(mb?.t0Amt || 0); }
        if (sortKey === "token1") { va = Number(ma?.t1Amt || 0); vb = Number(mb?.t1Amt || 0); }
        return sortDir === "asc" ? va - vb : vb - va;
      });
    } else {
      // 수동 순서: active 먼저, inactive 나중, 각 그룹 내 poolOrder 기준
      list = [...list].sort((a, b) => {
        const aActive = a.status !== "i"; const bActive = b.status !== "i";
        if (aActive !== bActive) return aActive ? -1 : 1;
        const aIdx = poolOrder.indexOf(a.id); const bIdx = poolOrder.indexOf(b.id);
        if (aIdx === -1 && bIdx === -1) return 0;
        if (aIdx === -1) return 1; if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });
    }
    return list;
  }, [showInactive, currentPools, activePools, filterType, filterToken, metadata, sortKey, sortDir, poolOrder]);

  // DnD sensors — 5px 이동 후 드래그 시작 (클릭과 구분)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedPool = displayedPools.find(p => p.id === active.id);
    const overPool    = displayedPools.find(p => p.id === over.id);
    if (!draggedPool || !overPool) return;

    // active ↔ inactive 경계 넘기 금지
    const draggedActive = draggedPool.status !== "i";
    const overActive    = overPool.status !== "i";
    if (draggedActive !== overActive) return;

    // poolOrder 에서 두 항목 위치 교환
    setPoolOrder(prev => {
      const next = [...prev];
      const fromIdx = next.indexOf(active.id as string);
      const toIdx   = next.indexOf(over.id as string);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, active.id as string);
      return next;
    });
    setSortKey(null); // 드래그하면 컬럼 정렬 해제
  };

  // ── Sort icon helper
  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown size={12} className="text-gray-300 ml-0.5" />;
    return sortDir === "asc"
      ? <ChevronUp size={12} className="text-blue-500 ml-0.5" />
      : <ChevronDown size={12} className="text-blue-500 ml-0.5" />;
  };

  const SortTh = ({ col, label, className = "" }: { col: SortKey; label: string; className?: string }) => (
    <th
      className={`px-3 py-3 text-[11px] font-medium text-gray-500 cursor-pointer select-none hover:text-gray-800 ${className}`}
      onClick={() => handleSort(col)}
    >
      <span className="inline-flex items-center gap-0.5">{label}<SortIcon col={col} /></span>
    </th>
  );

  const activeDragPool = activeId ? displayedPools.find(p => p.id === activeId) : null;
  const isDndMode = !sortKey;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-900">Pool Manager</h1>
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 bg-gray-900 hover:bg-black text-white text-[13px] font-medium rounded-lg transition-colors"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown size={12} className={"transition-transform " + (showExportMenu ? "rotate-180" : "")} />
          </button>
          {showExportMenu && (
            <div className="absolute right-0 mt-1.5 w-44 bg-white border border-gray-100 rounded-lg shadow-lg z-50 overflow-hidden py-1">
              <button onClick={() => handleExport(activePools, "active_pools")} className="w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50 text-gray-700">Active Pools</button>
              <button onClick={() => handleExport(inactivePools, "inactive_pools")} className="w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50 text-gray-700">Inactive Pools</button>
              <div className="border-t border-gray-100 my-1" />
              <button onClick={() => handleExport(currentPools, "all_pools")} className="w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50 text-gray-700">Export All</button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {!isLoading && (
        <div className="grid grid-cols-2 md:flex md:flex-row gap-3 mb-6">
          <div className="col-span-2 md:flex-1 md:min-w-[110px] bg-white border border-gray-100 rounded-xl p-4 flex flex-col justify-between min-w-0">
            <div className="text-xs text-gray-400 mb-2">Total TVL</div>
            <div className="text-lg font-semibold text-gray-900 truncate">{fmtFullUSD(aggregates.totalTVL)}</div>
            <div className="text-[10px] text-gray-300 mt-1">Active pools</div>
          </div>
          {aggregates.tokenTotals.map(t => (
            <div key={t.symbol} className="md:flex-1 md:min-w-[90px] bg-white border border-gray-100 rounded-xl p-4 flex flex-col justify-between min-w-0 overflow-hidden">
              <div className="text-[11px] font-semibold text-gray-400 mb-2">{t.symbol}</div>
              <div className="text-[14px] font-semibold text-gray-900 truncate" title={String(t.amount)}>{fmtAmt(t.amount)}</div>
              <div className="text-[11px] text-gray-400 mt-0.5 truncate">{fmtFullUSD(t.value)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Pool Table */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        {/* Controls bar */}
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-800">Pool List</span>
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{displayedPools.length}</span>
            <div className="flex items-center gap-1 ml-1">
              {(["all", "v2", "v3"] as const).map(t => (
                <button key={t} onClick={() => setFilterType(t)}
                  className={`text-[12px] px-2.5 py-0.5 rounded-full font-medium transition-colors ${
                    filterType === t
                      ? t === "v2" ? "bg-amber-100 text-amber-700" : t === "v3" ? "bg-blue-100 text-blue-600" : "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >{t === "all" ? "All" : t.toUpperCase()}</button>
              ))}
            </div>
            <div className="relative">
              <button onClick={() => setShowTokenDropdown(v => !v)}
                className={`flex items-center gap-1 text-[12px] px-2.5 py-0.5 rounded-full font-medium transition-colors border ${
                  filterToken ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
              >
                {filterToken || "Token"}
                <ChevronDown size={11} className={`transition-transform ${showTokenDropdown ? "rotate-180" : ""}`} />
                {filterToken && (
                  <span onClick={e => { e.stopPropagation(); setFilterToken(""); setShowTokenDropdown(false); }} className="ml-0.5 hover:text-red-500">
                    <X size={11} />
                  </span>
                )}
              </button>
              {showTokenDropdown && (
                <div className="absolute left-0 top-full mt-1 w-40 bg-white border border-gray-100 rounded-lg shadow-lg z-50 py-1 max-h-52 overflow-y-auto">
                  {allTokenSymbols.length === 0 && <div className="px-3 py-2 text-[12px] text-gray-400">No tokens</div>}
                  {allTokenSymbols.map(sym => (
                    <button key={sym} onClick={() => { setFilterToken(sym === filterToken ? "" : sym); setShowTokenDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-50 transition-colors ${filterToken === sym ? "font-semibold text-violet-700" : "text-gray-700"}`}
                    >{sym}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-[13px] text-gray-500">Show Inactive</span>
            <button onClick={() => setShowInactive(!showInactive)}
              className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${showInactive ? "bg-blue-600" : "bg-gray-200"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${showInactive ? "left-[18px]" : "left-0.5"}`} />
            </button>
          </label>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <table className="w-full text-left min-w-[820px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {/* Drag handle col */}
                  <th className="pl-4 pr-1 py-3 w-8" />
                  <SortTh col="pool" label="Pool" />
                  <SortTh col="rate" label="Exchange Rate" className="text-right" />
                  <SortTh col="token0" label="Token 0" className="text-right" />
                  <SortTh col="token1" label="Token 1" className="text-right" />
                  <SortTh col="tvl" label="TVL" className="text-right" />
                  <th className="pl-3 pr-5 py-3 w-24" />
                </tr>
              </thead>
              <SortableContext items={displayedPools.map(p => p.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {displayedPools.map((pool) => {
                    const meta    = metadata[pool.address.toLowerCase()];
                    const prices0 = Number(tokenPrices[meta?.token0?.toLowerCase()] || 0);
                    const prices1 = Number(tokenPrices[meta?.token1?.toLowerCase()] || 0);
                    const a0 = Number(meta?.t0Amt || 0);
                    const a1 = Number(meta?.t1Amt || 0);
                    const isInactive = pool.status === "i";

                    return (
                      <SortableRow key={pool.id} id={pool.id} disabled={!isDndMode}>
                        {(dragHandleProps, isDragging) => (
                          <>
                            {/* Drag handle */}
                            <td className="pl-4 pr-1 py-3.5 w-8" onClick={e => e.stopPropagation()}>
                              <div
                                {...dragHandleProps}
                                className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                                  isDndMode
                                    ? "text-gray-300 hover:text-gray-500 hover:bg-gray-100 cursor-grab active:cursor-grabbing"
                                    : "text-gray-200 cursor-default"
                                }`}
                                title={isDndMode ? "Drag to reorder" : "Clear column sort to reorder"}
                              >
                                <GripVertical size={14} />
                              </div>
                            </td>

                            <td
                              className="px-3 py-3.5 cursor-pointer"
                              onClick={() => !isDragging && router.push(`/pools/${pool.address}`)}
                            >
                              {meta?.isValid ? (
                                <div className={"flex items-center gap-2 whitespace-nowrap" + (isInactive ? " opacity-40" : "")}>
                                  <span className="text-sm font-medium text-gray-900">{meta.symbol0} / {meta.symbol1}</span>
                                  <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0 ${meta.type === "v3" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-700"}`}>
                                    {meta.type?.toUpperCase()}
                                  </span>
                                  <span className="text-[11px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded shrink-0">{meta.fee}%</span>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400 font-mono">{pool.address.slice(0, 10)}…</span>
                              )}
                            </td>

                            <td className={"px-3 py-3.5" + (isInactive ? " opacity-40" : "")} onClick={() => !isDragging && router.push(`/pools/${pool.address}`)}>
                              {meta?.isValid ? (() => {
                                const isReversed = reversedRates.has(pool.id);
                                const rate = isReversed ? (Number(meta.price) !== 0 ? fmtRate(1 / Number(meta.price)) : "—") : fmtRate(meta.price);
                                const base = isReversed ? meta.symbol1 : meta.symbol0;
                                return (
                                  <button onClick={e => { e.stopPropagation(); toggleRate(pool.id); }}
                                    className="flex items-center justify-end gap-1.5 w-full group" title="Click to reverse"
                                  >
                                    <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{rate}</span>
                                    <span className="text-[11px] text-gray-400 whitespace-nowrap">/ 1 {base}</span>
                                    <ArrowLeftRight size={11} className="text-gray-300 group-hover:text-blue-400 transition-colors shrink-0" />
                                  </button>
                                );
                              })() : <div className="text-sm text-gray-300 text-right">—</div>}
                            </td>

                            <td className={"px-3 py-3.5" + (isInactive ? " opacity-40" : "")} onClick={() => !isDragging && router.push(`/pools/${pool.address}`)}>
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{fmtAmt(a0)}</span>
                                <span className="text-[11px] text-gray-400 whitespace-nowrap">{fmtFullUSD(a0 * prices0)}</span>
                                <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">{meta?.symbol0}</span>
                              </div>
                            </td>

                            <td className={"px-3 py-3.5" + (isInactive ? " opacity-40" : "")} onClick={() => !isDragging && router.push(`/pools/${pool.address}`)}>
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{fmtAmt(a1)}</span>
                                <span className="text-[11px] text-gray-400 whitespace-nowrap">{fmtFullUSD(a1 * prices1)}</span>
                                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">{meta?.symbol1}</span>
                              </div>
                            </td>

                            <td className={"px-3 py-3.5 text-right" + (isInactive ? " opacity-40" : "")} onClick={() => !isDragging && router.push(`/pools/${pool.address}`)}>
                              <span className="text-sm font-semibold text-gray-900">{meta?.isValid ? fmtFullUSD(getEffectiveTVL(meta)) : "—"}</span>
                            </td>

                            <td className="pl-3 pr-5 py-3.5" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-0.5">
                                <button onClick={e => { e.stopPropagation(); togglePoolStatus(pool.id, pool.status); }}
                                  title={isInactive ? "Activate" : "Deactivate"}
                                  className={["w-7 h-7 flex items-center justify-center rounded-lg transition-colors",
                                    isInactive ? "text-gray-300 hover:text-emerald-500 hover:bg-emerald-50" : "text-emerald-500 hover:text-gray-400 hover:bg-gray-100",
                                  ].join(" ")}
                                ><Power size={13} /></button>
                                <a href={`${chain.explorer.replace(/\/$/, "")}/address/${pool.address}`}
                                  target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                  className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Explorer"
                                ><ExternalLink size={13} /></a>
                                {confirmDelete === pool.id ? (
                                  <div className="flex items-center gap-1 ml-0.5">
                                    <button onClick={e => { e.stopPropagation(); removePool(pool.id); setConfirmDelete(null); }}
                                      className="text-[11px] font-medium px-2 py-0.5 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                                    >Delete</button>
                                    <button onClick={e => { e.stopPropagation(); setConfirmDelete(null); }}
                                      className="text-[11px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                    >Cancel</button>
                                  </div>
                                ) : (
                                  <button onClick={e => { e.stopPropagation(); setConfirmDelete(pool.id); }}
                                    className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete"
                                  ><Trash2 size={13} /></button>
                                )}
                              </div>
                            </td>
                          </>
                        )}
                      </SortableRow>
                    );
                  })}
                </tbody>
              </SortableContext>
            </table>

            {/* 드래그 중인 행 오버레이 (반투명 미리보기) */}
            <DragOverlay>
              {activeDragPool ? (
                <table className="w-full min-w-[820px] shadow-xl rounded-xl overflow-hidden opacity-95">
                  <tbody>
                    <tr className="bg-white border border-blue-200">
                      <td className="pl-4 pr-1 py-3.5 w-8">
                        <div className="w-6 h-6 flex items-center justify-center text-blue-400">
                          <GripVertical size={14} />
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        {(() => {
                          const meta = metadata[activeDragPool.address.toLowerCase()];
                          return meta?.isValid ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{meta.symbol0} / {meta.symbol1}</span>
                              <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${meta.type === "v3" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-700"}`}>
                                {meta.type?.toUpperCase()}
                              </span>
                            </div>
                          ) : <span className="text-sm text-gray-400 font-mono">{activeDragPool.address.slice(0, 10)}…</span>;
                        })()}
                      </td>
                      <td colSpan={5} />
                    </tr>
                  </tbody>
                </table>
              ) : null}
            </DragOverlay>

            {displayedPools.length === 0 && (
              <EmptyState message="No pools found" height="h-40" />
            )}
          </DndContext>
        </div>
      </div>
    </div>
  );
}
