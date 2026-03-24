"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { CHAINS } from "@/lib/utils";
import type { ChainId } from "@/lib/types";
import {
  LayoutDashboard,
  Layers,
  Wallet,
  Coins,
  ChevronDown,
  Check,
  ScanSearch,
  RefreshCw,
} from "lucide-react";

const NAV = [
  { href: "/",        label: "Dashboard",      icon: LayoutDashboard },
  { href: "/pools",   label: "Pool Manager",   icon: Layers },
  { href: "/wallets", label: "Wallet Manager", icon: Wallet },
  { href: "/tokens",  label: "Token Manager",  icon: Coins },
];

function useRelativeTime(date: Date | null) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!date) { setLabel(""); return; }
    const update = () => {
      const diff = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diff < 60) setLabel(`${diff}초 전`);
      else if (diff < 3600) setLabel(`${Math.floor(diff / 60)}분 전`);
      else setLabel(date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [date]);
  return label;
}

export function Sidebar() {
  const pathname = usePathname();
  const { chainId, setChainId, refreshData, isRefreshing, refreshProgress, lastUpdated } = useApp();
  const [chainOpen, setChainOpen] = useState(false);
  const current = CHAINS.find((c) => c.id === chainId)!;
  const relTime = useRelativeTime(lastUpdated);

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-white border-r border-gray-100 flex flex-col z-50">
      {/* Logo */}
      <div className="px-5 h-[56px] flex items-center border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <ScanSearch size={14} className="text-white" />
          </div>
          <div>
            <div className="text-[15px] font-semibold text-gray-900 leading-tight">
              Pool<span className="text-blue-600">Scan</span>
            </div>
            <div className="text-[10px] text-gray-400 tracking-wide">DeFi Explorer</div>
          </div>
        </Link>
      </div>

      {/* Chain Selector */}
      <div className="px-3 py-3 border-b border-gray-50 relative">
        <button
          onClick={() => setChainOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: current.color }} />
          <span className="text-[13px] font-medium flex-1 text-left text-gray-800">{current.name}</span>
          <ChevronDown size={13} className={"text-gray-400 transition-transform " + (chainOpen ? "rotate-180" : "")} />
        </button>

        {chainOpen && (
          <div className="absolute top-[calc(100%-4px)] left-3 right-3 bg-white border border-gray-100 rounded-lg overflow-hidden shadow-lg z-20 py-1">
            {CHAINS.map((c) => (
              <button
                key={c.id}
                onClick={() => { setChainId(c.id as ChainId); setChainOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors text-left"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="flex-1 font-medium">{c.name}</span>
                {c.id === chainId && <Check size={12} className="text-blue-600" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="px-3 pt-3 flex-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-[13px] transition-colors",
                active
                  ? "bg-blue-50 text-blue-600 font-medium"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800",
              ].join(" ")}
            >
              <Icon size={15} className={active ? "text-blue-600" : "text-gray-400"} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Refresh + 마지막 업데이트 */}
      <div className="px-3 pb-3 border-t border-gray-100 pt-3 space-y-2">
        <button
          onClick={refreshData}
          disabled={isRefreshing}
          className={[
            "w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-all",
            isRefreshing
              ? "bg-blue-50 text-blue-400 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
          ].join(" ")}
        >
          <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
          {isRefreshing ? "업데이트 중…" : "데이터 새로고침"}
        </button>

        {/* 프로그레스 바 */}
        {isRefreshing && (
          <div className="space-y-1">
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full animate-pulse w-full" />
            </div>
            <p className="text-[10px] text-blue-500 text-center truncate">{refreshProgress}</p>
          </div>
        )}

        {/* 오류 메시지 */}
        {!isRefreshing && refreshProgress.startsWith("오류") && (
          <p className="text-[10px] text-red-400 text-center truncate">{refreshProgress}</p>
        )}

        <div className="text-center text-[11px] text-gray-400">
          {lastUpdated
            ? <>마지막 업데이트: <span className="text-gray-500 font-medium">{relTime}</span></>
            : <span className="text-gray-400">캐시 없음 — 새로고침 필요</span>
          }
        </div>
      </div>
    </aside>
  );
}
