"use client";

import React from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { fmtFullUSD, fmtUSD } from "@/lib/utils";
import { Layers, Wallet, DollarSign, TrendingUp, ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

// 값이 길면 자동 축약, 짧으면 풀 표기 (숫자 기반 분기)
function smartFmtUSD(n: number): { short: string; full: string } {
  return { short: fmtUSD(n), full: fmtFullUSD(n) };
}

export default function DashboardPage() {
  const { pools, wallets, chainId, isLoading, summary, metadata, tokenPrices } = useApp();

  const getEffectiveTVL = (meta: any): number => {
    const gwTVL = Number(meta?.tvl || 0);
    if (gwTVL > 0) return gwTVL;
    if (!meta?.isValid) return 0;
    const t0Price = tokenPrices[meta.token0?.toLowerCase()] || 0;
    const t1Price = tokenPrices[meta.token1?.toLowerCase()] || 0;
    return Number(meta.t0Amt || 0) * t0Price + Number(meta.t1Amt || 0) * t1Price;
  };

  const currentPools = pools.filter(p => p.chain_id === chainId && (p.status === "a" || !p.status));
  const currentWallets = wallets.filter(w => w.chain_id === chainId);

  const stats = [
    {
      label: "Active Pools",
      value: isLoading ? "—" : summary.totalPools,
      fullValue: undefined,
      icon: Layers,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Estimated TVL",
      value: isLoading ? "—" : smartFmtUSD(summary.tvl).short,
      fullValue: isLoading ? undefined : smartFmtUSD(summary.tvl).full,
      icon: DollarSign,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Tracked Wallets",
      value: isLoading ? "—" : summary.totalWallets,
      fullValue: undefined,
      icon: Wallet,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      label: "Portfolio Value",
      value: isLoading ? "—" : smartFmtUSD(summary.walletValue).short,
      fullValue: isLoading ? undefined : smartFmtUSD(summary.walletValue).full,
      icon: TrendingUp,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-5 flex items-center gap-4 min-w-0">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                <Icon size={18} className={s.color} />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="text-xl font-semibold text-gray-900 leading-none truncate"
                  title={(s as any).fullValue ?? String(s.value)}
                >
                  {s.value}
                </div>
                <div className="text-xs text-gray-500 mt-1 truncate">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Active Pools */}
        <div className="col-span-1 lg:col-span-3 bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-800">Active Pools</span>
            <div className="flex items-center gap-3">
              {currentPools.length > 10 && (
                <span className="text-[11px] text-gray-400">Showing 10 of {currentPools.length}</span>
              )}
              <Link href="/pools" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                View all <ArrowRight size={11} />
              </Link>
            </div>
          </div>
          {currentPools.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {currentPools.slice(0, 10).map((pool) => {
                const meta = metadata[pool.address.toLowerCase()];
                const tvl = getEffectiveTVL(meta);
                return (
                  <Link
                    key={pool.id}
                    href={`/pools/${pool.address}`}
                    className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors group"
                  >
                    {/* 이름 + 배지 */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900 whitespace-nowrap truncate">
                        {meta?.isValid ? `${meta.symbol0} / ${meta.symbol1}` : pool.address.slice(0, 10) + "…"}
                      </span>
                      {meta?.isValid && (
                        <>
                          <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${meta.type === "v3" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-700"}`}>
                            {meta.type?.toUpperCase()}
                          </span>
                          <span className="shrink-0 text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{meta.fee}%</span>
                        </>
                      )}
                    </div>
                    {/* TVL */}
                    <div className="shrink-0 text-[12px] font-medium text-gray-700 tabular-nums">
                      {tvl > 0 ? fmtFullUSD(tvl) : <span className="text-gray-300">—</span>}
                    </div>
                    <ArrowRight size={11} className="shrink-0 text-gray-300 group-hover:text-blue-500 transition-colors" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState message="No pools registered" height="h-48" />
          )}
        </div>

        {/* Wallets */}
        <div className="col-span-1 lg:col-span-2 bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-800">Tracked Wallets</span>
            <div className="flex items-center gap-3">
              {currentWallets.length > 10 && (
                <span className="text-[11px] text-gray-400">Showing 10 of {currentWallets.length}</span>
              )}
              <Link href="/wallets" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                View all <ArrowRight size={11} />
              </Link>
            </div>
          </div>
          {currentWallets.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {currentWallets.slice(0, 10).map((wallet) => (
                <Link
                  key={wallet.id}
                  href={`/wallets/${wallet.address}`}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors group"
                >
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                      {wallet.label}
                    </span>
                    <span className="text-[11px] text-gray-400 font-mono shrink-0">
                      {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
                    </span>
                  </div>
                  <ArrowRight size={11} className="shrink-0 text-gray-300 group-hover:text-blue-500 transition-colors" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">
              No wallets registered
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
