"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CHAINS } from "@/lib/utils";
import type { ChainId } from "@/lib/types";

const NAV = [
  { href: "/",        label: "Dashboard",      icon: "▦" },
  { href: "/pools",   label: "Pool Manager",   icon: "◈" },
  { href: "/wallets", label: "Wallet Manager", icon: "◎" },
  { href: "/tokens",  label: "Token Registry", icon: "⬡" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [chainId, setChainId] = useState<ChainId>(1);
  const [chainOpen, setChainOpen] = useState(false);
  const current = CHAINS.find((c) => c.id === chainId)!;

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[210px] bg-white border-r border-gray-200 flex flex-col z-50">
      {/* Logo */}
      <div className="px-[18px] py-[18px] border-b border-gray-100">
        <div className="flex items-center gap-[9px]">
          <div className="w-[30px] h-[30px] rounded-lg bg-blue-500 flex items-center justify-center text-white font-extrabold text-sm shrink-0">
            ⌕
          </div>
          <div>
            <div className="text-[15px] font-extrabold text-gray-900 tracking-tight">
              Pool<span className="text-blue-500">Scan</span>
            </div>
            <div className="text-[8px] text-gray-400 tracking-[1.8px] uppercase">DeFi Explorer</div>
          </div>
        </div>
      </div>

      {/* Chain selector */}
      <div className="px-[10px] pt-[10px] pb-1 relative">
        <button
          onClick={() => setChainOpen((v) => !v)}
          className="w-full flex items-center gap-[7px] bg-gray-50 border border-gray-200 rounded-lg px-[9px] py-[7px] cursor-pointer text-gray-900 shadow-card hover:bg-gray-100 transition-colors"
        >
          <span className="text-[14px] w-4 text-center" style={{ color: current.color }}>
            {current.icon}
          </span>
          <span className="text-[11px] font-semibold flex-1 text-left">{current.name}</span>
          <span className="text-[9px] text-gray-400">{chainOpen ? "▲" : "▼"}</span>
        </button>

        {chainOpen && (
          <div className="absolute top-full left-[10px] right-[10px] mt-1 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-dropdown z-10">
            {CHAINS.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setChainId(c.id as ChainId);
                  setChainOpen(false);
                }}
                className="w-full flex items-center gap-2 px-[10px] py-[7px] border-none cursor-pointer text-gray-900 hover:bg-gray-50 transition-colors text-left"
              >
                <span className="text-[13px] w-4 text-center" style={{ color: c.color }}>
                  {c.icon}
                </span>
                <span className="text-[11px] flex-1">{c.name}</span>
                {c.id === chainId && <span className="text-[9px] text-blue-500">●</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="px-[10px] pt-1 flex-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-[9px] px-[10px] py-2 rounded-lg mb-0.5 transition-colors",
                active
                  ? "bg-blue-50 text-blue-500"
                  : "text-gray-400 hover:bg-gray-50 hover:text-gray-700",
              ].join(" ")}
            >
              <span className="text-[14px] w-4 text-center">{item.icon}</span>
              <span className={`text-[12px] ${active ? "font-semibold" : "font-normal"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-[18px] pb-3 border-t border-gray-100 pt-3">
        <div className="inline-flex items-center gap-1 bg-amber-50 rounded px-2 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span className="text-[9px] text-amber-600 font-semibold tracking-wide">DEV MODE</span>
        </div>
      </div>
    </aside>
  );
}
