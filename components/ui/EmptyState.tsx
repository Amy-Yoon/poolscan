"use client";

import { DatabaseZap, Loader2 } from "lucide-react";
import { useApp } from "@/context/AppContext";

interface EmptyStateProps {
  /** 메인 안내 문구 (예: "등록된 풀이 없습니다") */
  message: string;
  /** 로딩 중일 때 대신 보여줄 문구 */
  loadingMessage?: string;
  /** 컨테이너 높이 Tailwind 클래스 (기본 h-52) */
  height?: string;
}

export function EmptyState({ message, loadingMessage = "로딩 중…", height = "h-52" }: EmptyStateProps) {
  const { isLoading, isRefreshing, importDefaultData, isImportingDefault } = useApp();

  if (isLoading || isRefreshing) {
    return (
      <div className={`flex items-center justify-center ${height} text-sm text-gray-400 gap-2`}>
        <Loader2 size={14} className="animate-spin" />
        {loadingMessage}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center ${height} gap-4`}>
      <p className="text-sm text-gray-400">{message}</p>
      <button
        onClick={importDefaultData}
        disabled={isImportingDefault}
        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-[13px] font-medium transition-all shadow-sm shadow-blue-200"
      >
        {isImportingDefault
          ? <Loader2 size={13} className="animate-spin" />
          : <DatabaseZap size={13} />
        }
        {isImportingDefault ? "가져오는 중…" : "기본 데이터 가져오기"}
      </button>
    </div>
  );
}
