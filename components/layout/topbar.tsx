"use client";

export function Topbar() {
  return (
    <header className="fixed top-0 left-[210px] right-0 h-[52px] z-40 bg-white/90 border-b border-gray-200 backdrop-blur-md flex items-center px-7">
      {/* Search bar */}
      <div className="relative w-full max-w-[440px]">
        <span className="absolute left-[11px] top-1/2 -translate-y-1/2 text-gray-400 text-[15px] pointer-events-none">
          ⌕
        </span>
        <input
          placeholder="Search pools, wallets, addresses…"
          className="w-full bg-white border border-gray-200 rounded-xl py-2 pl-8 pr-3 text-[13px] text-gray-900 placeholder:text-gray-400 outline-none shadow-card focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
        />
      </div>
    </header>
  );
}
