"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { analyzeAddress, SearchResult } from "@/lib/blockchain";
import { SearchModal } from "@/components/search/SearchModal";
import { exportConfig, importConfig } from "@/lib/db";
import { Search, Loader2, Download, Upload, DatabaseZap, FolderOpen, ChevronDown, CheckCircle2, XCircle } from "lucide-react";

export function Topbar() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const { chainId, pools, wallets, tokens, refreshData } = useApp();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importMenuRef = useRef<HTMLDivElement>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) {
        setImportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleExport = () => {
    try {
      exportConfig();
      showToast("success", "내보내기 완료!");
    } catch (e) {
      showToast("error", "내보내기 실패: " + (e as Error).message);
    }
  };

  const applyImport = async (json: string) => {
    setIsImporting(true);
    try {
      const { pools: p, wallets: w, tokens: t } = importConfig(json);
      showToast("success", `가져오기 완료 — 풀 +${p} / 지갑 +${w} / 토큰 +${t}`);
      await refreshData();
    } catch (err) {
      showToast("error", "가져오기 실패: " + (err as Error).message);
    } finally {
      setIsImporting(false);
    }
  };

  // 기본 데이터 가져오기 (public/wemix-default-config.json)
  const handleImportDefault = async () => {
    setImportMenuOpen(false);
    setIsImporting(true);
    try {
      const res = await fetch("/wemix-default-config.json");
      if (!res.ok) throw new Error("기본 데이터 파일을 불러올 수 없습니다.");
      const json = await res.text();
      await applyImport(json);
    } catch (err) {
      showToast("error", "기본 데이터 가져오기 실패: " + (err as Error).message);
      setIsImporting(false);
    }
  };

  // 파일에서 가져오기
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await applyImport(text);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSearch = async () => {
    if (!query.trim() || isSearching) return;

    const lowerQuery = query.toLowerCase();
    const existingPool = pools.find(p => p.address.toLowerCase() === lowerQuery && p.chain_id === chainId);
    if (existingPool) { router.push(`/pools/${existingPool.address}`); setQuery(""); return; }

    const existingWallet = wallets.find(w => w.address.toLowerCase() === lowerQuery && w.chain_id === chainId);
    if (existingWallet) { router.push(`/wallets/${existingWallet.address}`); setQuery(""); return; }

    const existingToken = tokens.find(t => t.address.toLowerCase() === lowerQuery && t.chain_id === chainId);
    if (existingToken) { router.push(`/tokens`); setQuery(""); return; }

    setIsSearching(true);
    try {
      const result = await analyzeAddress(query, chainId);
      setSearchResult(result);
    } catch (e) {
      console.error(e);
      showToast("error", "주소 분석 중 오류가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <>
      <header className="fixed top-0 left-[220px] right-0 h-[56px] z-40 bg-white border-b border-gray-100 flex items-center px-6 gap-3">

        {/* 검색 영역 — flex-1로 남은 공간 전부 차지 */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {isSearching
                ? <Loader2 size={14} className="animate-spin text-blue-500" />
                : <Search size={14} />
              }
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              disabled={isSearching}
              placeholder="풀, 지갑, 토큰 주소 검색…"
              className="w-full bg-gray-50 border border-gray-100 rounded-lg py-2 pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-60"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-lg text-[13px] font-medium transition-all shrink-0"
          >
            {isSearching ? "검색 중…" : "검색"}
          </button>
        </div>

        {/* 우측 고정 영역 */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-px h-5 bg-gray-200 mx-1" />

          <button
            onClick={handleExport}
            className="h-9 flex items-center gap-1.5 px-3 rounded-lg text-[13px] text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all"
          >
            <Download size={13} />
            내보내기
          </button>

          {/* 가져오기 드롭다운 */}
          <div className="relative" ref={importMenuRef}>
            <button
              onClick={() => setImportMenuOpen(v => !v)}
              disabled={isImporting}
              className="h-9 flex items-center gap-1.5 px-3 rounded-lg text-[13px] text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all disabled:opacity-50"
            >
              {isImporting
                ? <Loader2 size={13} className="animate-spin" />
                : <Upload size={13} />
              }
              가져오기
              <ChevronDown size={11} className={`transition-transform ${importMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {importMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl border border-gray-200 shadow-lg shadow-gray-100/80 overflow-hidden z-50 py-1">
                {/* 기본 데이터 */}
                <button
                  onClick={handleImportDefault}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors group"
                >
                  <DatabaseZap size={15} className="mt-0.5 text-blue-500 shrink-0" />
                  <div>
                    <div className="text-[13px] font-medium text-gray-800">기본 데이터</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">WEMIX 풀·토큰 기본 목록</div>
                  </div>
                </button>

                <div className="h-px bg-gray-100 mx-2" />

                {/* 파일에서 */}
                <button
                  onClick={() => { setImportMenuOpen(false); fileInputRef.current?.click(); }}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <FolderOpen size={15} className="mt-0.5 text-gray-400 shrink-0" />
                  <div>
                    <div className="text-[13px] font-medium text-gray-800">파일에서 가져오기</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">백업 JSON 파일 선택</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
      </header>

      {searchResult && (
        <SearchModal
          result={searchResult}
          onClose={() => { setSearchResult(null); setQuery(""); }}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div className={[
          "fixed bottom-5 right-5 z-[200] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-[13px] font-medium",
          "transition-all duration-300 animate-in fade-in slide-in-from-bottom-2",
          toast.type === "success"
            ? "bg-white border border-green-200 text-green-700"
            : "bg-white border border-red-200 text-red-600",
        ].join(" ")}>
          {toast.type === "success"
            ? <CheckCircle2 size={15} className="text-green-500 shrink-0" />
            : <XCircle size={15} className="text-red-400 shrink-0" />
          }
          {toast.msg}
        </div>
      )}
    </>
  );
}
