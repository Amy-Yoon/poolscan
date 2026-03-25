"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { RefreshBar } from "./RefreshBar";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // 페이지 이동 시 모바일 사이드바 닫기
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Topbar onMenuToggle={() => setSidebarOpen((v) => !v)} />
      <RefreshBar />

      <main className="lg:ml-[220px] pt-[56px] min-h-screen">
        <div className="px-4 py-5 md:px-8 md:py-7">{children}</div>
      </main>
    </>
  );
}
