"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { getWalletLPPositions, fetchTokenPrices } from "@/lib/blockchain";
import { downloadCSV, fmtAmt, fmtRate, fmtFullUSD } from "@/lib/utils";
import { Loader2, ChevronDown, ChevronRight, Download, ArrowLeftRight, Trash2 } from "lucide-react";

/** Extreme range boundary → ∞ / 0 */
const fmtPrice = (n: number): string => {
  if (!isFinite(n) || n > 1e15) return "∞";
  if (n <= 0 || n < 1e-10) return "0";
  return fmtRate(n);
};

interface V3PositionDetail {
  tokenId: string;
  sym0: string;
  sym1: string;
  fee: number;
  inRange: boolean | undefined;
  hasAmounts: boolean;
  amount0: number;
  amount1: number;
  fees0: number;
  fees1: number;
  currentPrice: number;
  priceLower: number;
  priceUpper: number;
  tickLower: number;
  tickUpper: number;
  token0Addr: string;
  token1Addr: string;
}

interface V2PositionDetail {
  poolAddress: string;
  label: string;
  sym0: string;
  sym1: string;
  formattedBalance: string;
  amount0: number | null;
  amount1: number | null;
  token0Addr: string;
  token1Addr: string;
}

interface WalletSummary {
  v2Count: number;
  v3Count: number;
  totalValueUSD: number | null;
  hasPrices: boolean;
  v3Positions: V3PositionDetail[];
  v2Positions: V2PositionDetail[];
  tokenPrices: Record<string, number>;
  rawV3: any[];
  rawV2: any[];
  status: "loading" | "done" | "error";
}

export default function WalletsPage() {
  const { wallets, chainId, pools, tokens, metadata, isLoading, removeWallet } = useApp();
  const [summaries, setSummaries] = useState<Record<string, WalletSummary>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // tokenId → true means show reversed price (sym1 per sym0 → sym0 per sym1)
  const [reversedPrices, setReversedPrices] = useState<Record<string, boolean>>({});

  const togglePriceReverse = (tokenId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setReversedPrices(prev => ({ ...prev, [tokenId]: !prev[tokenId] }));
  };

  const currentWallets = wallets.filter(w => w.chain_id === chainId);

  useEffect(() => {
    if (currentWallets.length === 0) return;

    setSummaries(prev => {
      const next = { ...prev };
      currentWallets.forEach(w => {
        if (!next[w.address]) {
          next[w.address] = {
            v2Count: 0, v3Count: 0,
            totalValueUSD: null, hasPrices: false,
            v3Positions: [], v2Positions: [],
            tokenPrices: {},
            rawV3: [], rawV2: [],
            status: "loading",
          };
        }
      });
      return next;
    });

    currentWallets.forEach(async (wallet) => {
      try {
        const positions = await getWalletLPPositions(wallet.address, chainId, pools);

        // Collect unique token addresses for price fetch (V3 tokens + V2 token0/token1)
        const allTokenAddrs = [
          ...positions.v3.flatMap((p: any) => [p.token0?.address, p.token1?.address]),
          ...positions.v2.flatMap((p: any) => [p.token0Addr, p.token1Addr]),
        ].filter(Boolean).filter((v: string, i: number, a: string[]) =>
          a.findIndex((x: string) => x.toLowerCase() === v.toLowerCase()) === i
        );

        let tokenPrices: Record<string, number> = {};
        if (allTokenAddrs.length > 0) {
          try {
            const chainTokens = tokens.filter((t: any) => t.chain_id === chainId);
            const priceResults = await fetchTokenPrices(allTokenAddrs, chainId, pools, chainTokens, metadata);
            priceResults.forEach((r: any) => {
              if (r.price) tokenPrices[r.address.toLowerCase()] = Number(r.price);
            });
          } catch { /* prices optional */ }
        }

        const v3Positions: V3PositionDetail[] = positions.v3.map((p: any) => ({
          tokenId: p.tokenId,
          sym0: p.token0?.symbol || "?",
          sym1: p.token1?.symbol || "?",
          fee: p.fee,
          inRange: p.inRange,
          hasAmounts: p.amount0 !== undefined,
          amount0: p.amount0 || 0,
          amount1: p.amount1 || 0,
          fees0: p.fees0 || 0,
          fees1: p.fees1 || 0,
          currentPrice: p.currentPrice || 0,
          priceLower: p.priceLower || 0,
          priceUpper: p.priceUpper || 0,
          tickLower: p.tickLower || 0,
          tickUpper: p.tickUpper || 0,
          token0Addr: (p.token0?.address || "").toLowerCase(),
          token1Addr: (p.token1?.address || "").toLowerCase(),
        }));

        const v2Positions: V2PositionDetail[] = positions.v2.map((p: any) => {
          const sym0 = p.tokenSymbols?.sym0 || p.pool?.label?.split(" / ")[0] || "?";
          const sym1 = p.tokenSymbols?.sym1 || p.pool?.label?.split(" / ")[1] || "?";
          return {
            poolAddress: p.pool?.address || "",
            label: sym0 && sym1 && sym0 !== "?" ? `${sym0} / ${sym1}` : (p.pool?.label || p.pool?.address?.slice(0, 10) + "…"),
            sym0,
            sym1,
            formattedBalance: p.formattedBalance || "0",
            amount0: p.amount0 ?? null,
            amount1: p.amount1 ?? null,
            token0Addr: (p.token0Addr || p.pool?.token0 || "").toLowerCase(),
            token1Addr: (p.token1Addr || p.pool?.token1 || "").toLowerCase(),
          };
        });

        // Compute total USD value from V3 + V2 positions
        const hasPrices = Object.keys(tokenPrices).length > 0;
        let totalValueUSD: number | null = null;
        if (hasPrices) {
          const v3Total = v3Positions.reduce((sum, pos) => {
            const p0 = tokenPrices[pos.token0Addr] || 0;
            const p1 = tokenPrices[pos.token1Addr] || 0;
            if (!pos.hasAmounts) return sum;
            return sum + pos.amount0 * p0 + pos.amount1 * p1 + pos.fees0 * p0 + pos.fees1 * p1;
          }, 0);
          const v2Total = v2Positions.reduce((sum, pos) => {
            const p0 = tokenPrices[pos.token0Addr] || 0;
            const p1 = tokenPrices[pos.token1Addr] || 0;
            return sum + (pos.amount0 ?? 0) * p0 + (pos.amount1 ?? 0) * p1;
          }, 0);
          totalValueUSD = v3Total + v2Total;
        }

        setSummaries(prev => ({
          ...prev,
          [wallet.address]: {
            v2Count: positions.v2.length,
            v3Count: positions.v3.length,
            totalValueUSD,
            hasPrices,
            v3Positions,
            v2Positions,
            tokenPrices,
            rawV3: positions.v3,
            rawV2: positions.v2,
            status: "done",
          },
        }));
      } catch {
        setSummaries(prev => ({
          ...prev,
          [wallet.address]: {
            v2Count: 0, v3Count: 0,
            totalValueUSD: null, hasPrices: false,
            v3Positions: [], v2Positions: [],
            tokenPrices: {},
            rawV3: [], rawV2: [],
            status: "error",
          },
        }));
      }
    });
  }, [chainId, wallets, pools]);

  const toggleExpand = (address: string) => {
    setExpanded(prev => ({ ...prev, [address]: !prev[address] }));
  };

  const handleExport = (wallet: typeof currentWallets[0], summary: WalletSummary) => {
    const rows: (string | number)[][] = [
      ["Wallet Label", "Wallet Address"],
      [wallet.label || "Tracked Wallet", wallet.address],
      [],
      ["=== V3 Positions ==="],
      ["Token ID", "Pair", "Fee %", "In Range", "Deposit Token0", "Deposit Token1", "Rewards Token0", "Rewards Token1", "Total Value (USD)"],
    ];

    summary.rawV3.forEach((p: any) => {
      rows.push([
        p.tokenId || "",
        `${p.token0?.symbol || "?"}/${p.token1?.symbol || "?"}`,
        p.fee || "",
        p.inRange ? "Yes" : "No",
        p.amount0 ?? "",
        p.amount1 ?? "",
        p.fees0 ?? "",
        p.fees1 ?? "",
        ((p.amount0 || 0) + (p.fees0 || 0) + (p.amount1 || 0) + (p.fees1 || 0)),
      ]);
    });

    rows.push([], ["=== V2 Positions ==="], ["Pool Address", "Pair", "LP Balance"]);
    summary.rawV2.forEach((p: any) => {
      const sym0 = p.tokenSymbols?.sym0 || "?";
      const sym1 = p.tokenSymbols?.sym1 || "?";
      rows.push([p.pool?.address || "", `${sym0}/${sym1}`, p.formattedBalance || "0"]);
    });

    const label = (wallet.label || "wallet").replace(/\s+/g, "_");
    downloadCSV(rows, `${label}_positions.csv`);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Wallet Manager</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track V2/V3 LP positions across registered wallets</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        {currentWallets.length > 0 ? (
          <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ tableLayout: "fixed", minWidth: "600px" }}>
            <colgroup>
              <col style={{ width: "40px" }} />   {/* # */}
              <col />                              {/* label — flex */}
              <col style={{ width: "56px" }} />   {/* V2 */}
              <col style={{ width: "56px" }} />   {/* V3 */}
              <col style={{ width: "80px" }} />   {/* 총 포지션 */}
              <col style={{ width: "136px" }} />  {/* Total Value */}
              <col style={{ width: "76px" }} />   {/* actions */}
            </colgroup>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-3 text-[11px] font-medium text-gray-500 text-center">#</th>
                <th className="px-4 py-3 text-[11px] font-medium text-gray-500">Label / Address</th>
                <th className="px-2 py-3 text-[11px] font-medium text-gray-500 text-center">V2</th>
                <th className="px-2 py-3 text-[11px] font-medium text-gray-500 text-center">V3</th>
                <th className="px-2 py-3 text-[11px] font-medium text-gray-500 text-center">Positions</th>
                <th className="px-4 py-3 text-[11px] font-medium text-gray-500 text-right">Total Value</th>
                <th className="px-3 py-3 text-[11px] font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {currentWallets.map((wallet, idx) => {
                const summary = summaries[wallet.address];
                const isScanning = !summary || summary.status === "loading";
                const total = (summary?.v2Count ?? 0) + (summary?.v3Count ?? 0);
                const isOpen = expanded[wallet.address] ?? false;
                const hasPositions = total > 0;
                const canToggle = hasPositions && !isScanning;

                return (
                  <React.Fragment key={wallet.id}>
                    {/* Main row — click anywhere to toggle */}
                    <tr
                      onClick={() => canToggle && toggleExpand(wallet.address)}
                      className={`border-b border-gray-50 transition-colors ${canToggle ? "cursor-pointer hover:bg-gray-50" : ""} ${isOpen ? "bg-gray-50 border-gray-100" : "last:border-0"}`}
                    >
                      <td className="px-3 py-4 text-[12px] text-gray-400 text-center">{idx + 1}</td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 flex items-center justify-center shrink-0 ${hasPositions && !isScanning ? "text-gray-400" : "text-gray-200"}`}>
                            {isScanning ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : hasPositions ? (
                              isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />
                            ) : (
                              <ChevronRight size={13} className="opacity-20" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{wallet.label}</div>
                            <div className="text-[11px] font-mono text-gray-400 mt-0.5">
                              {wallet.address.slice(0, 8)}…{wallet.address.slice(-6)}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-2 py-4 text-center">
                        {isScanning ? (
                          <Loader2 size={12} className="animate-spin text-gray-300 mx-auto" />
                        ) : (
                          <div className="text-sm font-medium text-gray-900">{summary.v2Count}</div>
                        )}
                      </td>

                      <td className="px-2 py-4 text-center">
                        {isScanning ? (
                          <Loader2 size={12} className="animate-spin text-gray-300 mx-auto" />
                        ) : (
                          <div className="text-sm font-medium text-gray-900">{summary.v3Count}</div>
                        )}
                      </td>

                      <td className="px-2 py-4 text-center">
                        {isScanning ? (
                          <Loader2 size={12} className="animate-spin text-gray-300 mx-auto" />
                        ) : (
                          <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-semibold mx-auto ${
                            total > 0 ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-400"
                          }`}>
                            {total}
                          </div>
                        )}
                      </td>

                      {/* Total Value */}
                      <td className="px-4 py-4 text-right">
                        {isScanning ? (
                          <Loader2 size={12} className="animate-spin text-gray-300 ml-auto" />
                        ) : summary?.hasPrices && summary.totalValueUSD !== null ? (
                          <div className="text-sm font-semibold text-gray-900">{fmtFullUSD(summary.totalValueUSD)}</div>
                        ) : summary?.status === "done" ? (
                          <span className="text-[12px] text-gray-300">—</span>
                        ) : null}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          {!isScanning && summary?.status === "done" && (
                            <button
                              onClick={() => handleExport(wallet, summary)}
                              className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Export CSV"
                            >
                              <Download size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`Remove wallet "${wallet.label}"?`)) {
                                removeWallet(wallet.id);
                              }
                            }}
                            className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete wallet"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isOpen && !isScanning && hasPositions && summary && (
                      <tr className="border-b border-gray-100">
                        <td colSpan={7} className="px-0 py-0 bg-gray-50" style={{ overflow: "hidden" }}>
                          <div className="pl-4 sm:pl-10 pr-4 py-4 space-y-4">

                            {/* ── V3 Positions Table ── */}
                            {summary.v3Positions.length > 0 && (
                              <div>
                                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                  V3 Concentrated Liquidity ({summary.v3Positions.length})
                                </div>
                                <div className="overflow-x-auto rounded-lg border border-gray-100">
                                  <table className="min-w-[1060px] w-full text-[11px] bg-white">
                                    <thead>
                                      <tr className="border-b border-gray-100 bg-gray-50/80">
                                        <th className="px-3 py-2 text-left font-medium text-gray-400 whitespace-nowrap">#</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-400 whitespace-nowrap">Pair</th>
                                        <th className="px-3 py-2 text-center font-medium text-gray-400 whitespace-nowrap">Fee</th>
                                        <th className="px-3 py-2 text-center font-medium text-gray-400 whitespace-nowrap">Status</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-400 whitespace-nowrap">Current Price</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-400 whitespace-nowrap">Price Range</th>
                                        <th className="px-3 py-2 text-right font-medium text-gray-400 whitespace-nowrap">Dep T0</th>
                                        <th className="px-3 py-2 text-right font-medium text-gray-400 whitespace-nowrap">Dep T1</th>
                                        <th className="px-3 py-2 text-right font-medium text-gray-400 whitespace-nowrap">Dep $</th>
                                        <th className="px-3 py-2 text-right font-medium text-amber-500 whitespace-nowrap">Rew T0</th>
                                        <th className="px-3 py-2 text-right font-medium text-amber-500 whitespace-nowrap">Rew T1</th>
                                        <th className="px-3 py-2 text-right font-medium text-amber-500 whitespace-nowrap">Rew $</th>
                                        <th className="px-3 py-2 text-right font-medium text-blue-500 whitespace-nowrap">Total $</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {summary.v3Positions.map((pos, i) => {
                                        const p0 = summary.tokenPrices[pos.token0Addr] || 0;
                                        const p1 = summary.tokenPrices[pos.token1Addr] || 0;
                                        const dep0Val = pos.amount0 * p0;
                                        const dep1Val = pos.amount1 * p1;
                                        const rew0Val = pos.fees0 * p0;
                                        const rew1Val = pos.fees1 * p1;
                                        const totalVal = dep0Val + dep1Val + rew0Val + rew1Val;

                                        return (
                                          <tr key={pos.tokenId} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors`}>
                                            {/* Token ID */}
                                            <td className="px-3 py-2.5 font-mono text-gray-400 whitespace-nowrap">
                                              #{pos.tokenId}
                                            </td>
                                            {/* Pair */}
                                            <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                                              {pos.sym0} / {pos.sym1}
                                            </td>
                                            {/* Fee */}
                                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                              <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                                {pos.fee}%
                                              </span>
                                            </td>
                                            {/* Status */}
                                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                              {pos.hasAmounts ? (
                                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${pos.inRange ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                                                  {pos.inRange ? "In Range" : "Out"}
                                                </span>
                                              ) : (
                                                <span className="text-gray-300">—</span>
                                              )}
                                            </td>
                                            {/* Current Price — click to reverse */}
                                            <td className="px-3 py-2.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                              {pos.hasAmounts && pos.currentPrice > 0 ? (
                                                <button
                                                  type="button"
                                                  onClick={(e) => { e.stopPropagation(); togglePriceReverse(pos.tokenId, e); }}
                                                  className="flex items-center gap-1 font-mono text-gray-600 hover:text-blue-600 transition-colors"
                                                  title="Click to reverse"
                                                >
                                                  <span className="tabular-nums">
                                                    {reversedPrices[pos.tokenId]
                                                      ? fmtRate(1 / pos.currentPrice)
                                                      : fmtRate(pos.currentPrice)
                                                    }
                                                  </span>
                                                  <span className="text-[9px] text-gray-400">
                                                    {reversedPrices[pos.tokenId]
                                                      ? `${pos.sym0}/${pos.sym1}`
                                                      : `${pos.sym1}/${pos.sym0}`
                                                    }
                                                  </span>
                                                  <ArrowLeftRight size={9} className="text-gray-300" />
                                                </button>
                                              ) : (
                                                <span className="text-gray-300">—</span>
                                              )}
                                            </td>
                                            {/* Price Range */}
                                            <td className="px-3 py-2.5 font-mono text-gray-600 whitespace-nowrap">
                                              {pos.hasAmounts
                                                ? `${fmtPrice(pos.priceLower)} ~ ${fmtPrice(pos.priceUpper)}`
                                                : `${pos.tickLower.toLocaleString()} ~ ${pos.tickUpper.toLocaleString()}`
                                              }
                                            </td>
                                            {/* Deposit T0 */}
                                            <td className="px-3 py-2.5 text-right font-mono text-gray-700 whitespace-nowrap">
                                              {pos.hasAmounts ? fmtAmt(pos.amount0) : "—"}
                                            </td>
                                            {/* Deposit T1 */}
                                            <td className="px-3 py-2.5 text-right font-mono text-gray-700 whitespace-nowrap">
                                              {pos.hasAmounts ? fmtAmt(pos.amount1) : "—"}
                                            </td>
                                            {/* Deposit $ */}
                                            <td className="px-3 py-2.5 text-right font-medium text-gray-700 whitespace-nowrap">
                                              {p0 > 0 || p1 > 0 ? fmtFullUSD(dep0Val + dep1Val) : "—"}
                                            </td>
                                            {/* Rewards T0 */}
                                            <td className="px-3 py-2.5 text-right font-mono text-amber-600 whitespace-nowrap">
                                              {pos.hasAmounts ? fmtAmt(pos.fees0) : "—"}
                                            </td>
                                            {/* Rewards T1 */}
                                            <td className="px-3 py-2.5 text-right font-mono text-amber-600 whitespace-nowrap">
                                              {pos.hasAmounts ? fmtAmt(pos.fees1) : "—"}
                                            </td>
                                            {/* Rewards $ */}
                                            <td className="px-3 py-2.5 text-right font-medium text-amber-600 whitespace-nowrap">
                                              {p0 > 0 || p1 > 0 ? fmtFullUSD(rew0Val + rew1Val) : "—"}
                                            </td>
                                            {/* Total $ */}
                                            <td className="px-3 py-2.5 text-right font-semibold text-blue-600 whitespace-nowrap">
                                              {p0 > 0 || p1 > 0 ? fmtFullUSD(totalVal) : "—"}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* ── V2 Positions Table ── */}
                            {summary.v2Positions.length > 0 && (
                              <div>
                                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                  V2 LP Holdings ({summary.v2Positions.length})
                                </div>
                                <div className="overflow-x-auto rounded-lg border border-gray-100">
                                  <table className="min-w-[560px] w-full text-[11px] bg-white">
                                    <thead>
                                      <tr className="border-b border-gray-100 bg-gray-50/80">
                                        <th className="px-3 py-2 text-left font-medium text-gray-400 whitespace-nowrap">Pair</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-400 whitespace-nowrap">Pool</th>
                                        <th className="px-3 py-2 text-right font-medium text-gray-400 whitespace-nowrap">LP Balance</th>
                                        <th className="px-3 py-2 text-right font-medium text-gray-400 whitespace-nowrap">T0 Amount</th>
                                        <th className="px-3 py-2 text-right font-medium text-gray-400 whitespace-nowrap">T1 Amount</th>
                                        <th className="px-3 py-2 text-right font-medium text-blue-500 whitespace-nowrap">Value $</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {summary.v2Positions.map(pos => {
                                        const p0 = summary.tokenPrices[pos.token0Addr] || 0;
                                        const p1 = summary.tokenPrices[pos.token1Addr] || 0;
                                        const val0 = (pos.amount0 ?? 0) * p0;
                                        const val1 = (pos.amount1 ?? 0) * p1;
                                        const totalV = val0 + val1;
                                        return (
                                          <tr key={pos.poolAddress} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                                            {/* Pair */}
                                            <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 px-1 py-0.5 rounded">V2</span>
                                                {pos.label}
                                              </div>
                                            </td>
                                            {/* Pool address */}
                                            <td className="px-3 py-2.5 font-mono text-gray-400 whitespace-nowrap">
                                              {pos.poolAddress.slice(0, 8)}…{pos.poolAddress.slice(-6)}
                                            </td>
                                            {/* LP Balance */}
                                            <td className="px-3 py-2.5 text-right font-mono text-gray-600 whitespace-nowrap">
                                              {Number(pos.formattedBalance).toFixed(6)}
                                              <span className="text-gray-400 ml-0.5">LP</span>
                                            </td>
                                            {/* Token0 amount */}
                                            <td className="px-3 py-2.5 text-right font-mono text-gray-700 whitespace-nowrap">
                                              {pos.amount0 !== null
                                                ? <>{fmtAmt(pos.amount0)} <span className="text-gray-400">{pos.sym0}</span></>
                                                : <span className="text-gray-300">—</span>
                                              }
                                            </td>
                                            {/* Token1 amount */}
                                            <td className="px-3 py-2.5 text-right font-mono text-gray-700 whitespace-nowrap">
                                              {pos.amount1 !== null
                                                ? <>{fmtAmt(pos.amount1)} <span className="text-gray-400">{pos.sym1}</span></>
                                                : <span className="text-gray-300">—</span>
                                              }
                                            </td>
                                            {/* Total value */}
                                            <td className="px-3 py-2.5 text-right font-semibold text-blue-600 whitespace-nowrap">
                                              {(p0 > 0 || p1 > 0) && pos.amount0 !== null
                                                ? fmtFullUSD(totalV)
                                                : <span className="text-gray-300">—</span>
                                              }
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-sm text-gray-400">
            {isLoading ? "Loading…" : "No wallets registered"}
          </div>
        )}
      </div>
    </div>
  );
}
