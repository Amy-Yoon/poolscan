import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { RefreshBar } from "@/components/layout/RefreshBar";
import { AppProvider } from "@/context/AppContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PoolScan — DeFi Explorer",
  description: "Real-time Uniswap V2/V3 pool and wallet liquidity analytics",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AppProvider>
          {/* Sidebar — fixed left */}
          <Sidebar />

          {/* Topbar — fixed top, offset by sidebar */}
          <Topbar />

          {/* Refresh progress bar — thin line just below topbar */}
          <RefreshBar />

          {/* Main content */}
          <main className="ml-[220px] pt-[56px] min-h-screen">
            <div className="px-8 py-7">{children}</div>
          </main>
        </AppProvider>
      </body>
    </html>
  );
}
