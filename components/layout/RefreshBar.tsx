"use client";

import { useApp } from "@/context/AppContext";

export function RefreshBar() {
  const { isRefreshing, refreshPercent } = useApp();

  // Visible only while refreshing (or briefly at 100%)
  if (!isRefreshing && refreshPercent === -1) return null;

  const pct = refreshPercent < 0 ? 0 : Math.min(refreshPercent, 100);

  return (
    <div className="fixed top-[56px] left-[220px] right-0 h-[3px] z-50 bg-gray-100 overflow-hidden">
      <div
        className="h-full bg-blue-500 transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
