export default function TokensPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Token Registry</h1>
        <p className="text-sm text-gray-400 mt-1">Map contract addresses to symbols for pool name resolution</p>
      </div>
      <div className="flex items-center justify-center h-64 bg-white border border-gray-200 rounded-2xl text-sm text-gray-400 shadow-card">
        Connect Supabase to manage tokens
      </div>
    </div>
  );
}
