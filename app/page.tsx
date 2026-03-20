export default function DashboardPage() {
  return (
    <div>
      <div className="mb-7">
        <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Overview of your tracked pools and wallets</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-7">
        {[
          { label: "Tracked Pools",   value: "—", sub: "Connect Supabase",  icon: "◈", bg: "bg-blue-50",   ic: "text-blue-500"   },
          { label: "Total TVL",       value: "—", sub: "Fetch on-chain",    icon: "$", bg: "bg-green-50",  ic: "text-green-600"  },
          { label: "Tracked Wallets", value: "—", sub: "Connect Supabase",  icon: "◎", bg: "bg-amber-50",  ic: "text-amber-500"  },
          { label: "Wallet Value",    value: "—", sub: "Fetch on-chain",    icon: "$", bg: "bg-green-50",  ic: "text-green-600"  },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-card">
            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${s.bg} mb-3`}>
              <span className={`text-sm ${s.ic}`}>{s.icon}</span>
            </div>
            <div className="text-2xl font-extrabold text-gray-900 tracking-tight mb-1">{s.value}</div>
            <div className="text-[13px] font-semibold text-gray-700 mb-0.5">{s.label}</div>
            <div className="text-xs text-gray-400">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Empty state placeholder */}
      <div className="grid grid-cols-2 gap-4">
        {["Top Pools by TVL", "Wallet Positions"].map((title) => (
          <div key={title} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-card">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
              <span className="text-[13px] font-bold text-gray-900">{title}</span>
            </div>
            <div className="flex items-center justify-center h-40 text-sm text-gray-400">
              No data yet — add pools or wallets to get started
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
