"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { DBPool, DBWallet, DBToken, TokenMeta, ChainId } from "@/lib/types";
import { getPools, getWallets, getTokens, getPoolsSync, getWalletsSync, getTokensSync, updatePoolStatus as dbUpdatePoolStatus, deletePool as dbDeletePool, deleteWallet as dbDeleteWallet } from "@/lib/db";
import { analyzeAddress, fetchPoolsMetadata } from "@/lib/blockchain";
import { CHAINS } from "@/lib/utils";

interface AppContextType {
  chainId: ChainId;
  setChainId: (id: ChainId) => void;
  pools: DBPool[];
  wallets: DBWallet[];
  tokens: DBToken[];
  /** In-memory token metadata (symbol/name/decimals) fetched on-chain. Never persisted in DB. */
  tokenMetadata: Record<string, TokenMeta>;
  isLoading: boolean;
  isRefreshing: boolean;
  refreshProgress: string;
  refreshPercent: number;   // 0–100, -1 = idle
  lastUpdated: Date | null;
  refreshData: () => Promise<void>;
  metadata: Record<string, any>;
  summary: {
    totalPools: number;
    totalWallets: number;
    tvl: number;
    walletValue: number;
  };
  togglePoolStatus: (id: string, currentStatus?: string) => Promise<void>;
  removePool: (id: string) => Promise<void>;
  removeWallet: (id: string) => Promise<void>;
  importDefaultData: () => Promise<void>;
  isImportingDefault: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ── Cache helpers ─────────────────────────────────────────────
const CACHE_VERSION = "v3";
function cacheKey(chainId: number) { return `poolscan-cache-${CACHE_VERSION}-${chainId}`; }

function saveCache(chainId: number, data: { pools: DBPool[]; wallets: DBWallet[]; tokens: DBToken[]; metadata: Record<string, any>; tokenMetadata: Record<string, TokenMeta>; lastUpdated: string }) {
  try { localStorage.setItem(cacheKey(chainId), JSON.stringify(data)); } catch {}
}

function loadCache(chainId: number): { pools: DBPool[]; wallets: DBWallet[]; tokens: DBToken[]; metadata: Record<string, any>; tokenMetadata: Record<string, TokenMeta>; lastUpdated: string } | null {
  try {
    const raw = localStorage.getItem(cacheKey(chainId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [chainId, setChainIdState] = useState<ChainId>(1111);
  const [pools, setPools] = useState<DBPool[]>([]);
  const [wallets, setWallets] = useState<DBWallet[]>([]);
  const [tokens, setTokens] = useState<DBToken[]>([]);
  const [tokenMetadata, setTokenMetadata] = useState<Record<string, TokenMeta>>({});
  const [metadata, setMetadata] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState("");
  const [refreshPercent, setRefreshPercent] = useState(-1);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const chainIdRef = useRef<ChainId>(1111);

  // 캐시에서 데이터 로드
  const loadFromCache = useCallback((id: ChainId) => {
    const cached = loadCache(id);
    if (cached) {
      setPools(cached.pools);
      setWallets(cached.wallets);
      setTokens(cached.tokens);
      setMetadata(cached.metadata);
      setTokenMetadata(cached.tokenMetadata ?? {});
      setLastUpdated(new Date(cached.lastUpdated));
      return true;
    }
    // 캐시 없으면 localStorage DB에서 직접 로드
    const dbPools = getPoolsSync(id);
    const dbWallets = getWalletsSync(id);
    const dbTokens = getTokensSync(id);
    setPools(dbPools);
    setWallets(dbWallets);
    setTokens(dbTokens);
    setMetadata({});
    setTokenMetadata({});
    setLastUpdated(null);
    return false;
  }, []);

  // 체인 변경 — 캐시 즉시 로드 후 자동 refresh 트리거
  const pendingRefreshRef = useRef(false);
  const setChainId = useCallback((id: ChainId) => {
    chainIdRef.current = id;
    setChainIdState(id);
    setIsLoading(true);
    loadFromCache(id);
    setIsLoading(false);
    pendingRefreshRef.current = true;
  }, [loadFromCache]);

  // 초기 마운트: 캐시 로드 (온체인 요청 없음)
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      loadFromCache(chainId);
      setIsLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 체인 전환 후 자동 refresh
  useEffect(() => {
    if (pendingRefreshRef.current && isMountedRef.current) {
      pendingRefreshRef.current = false;
      const t = setTimeout(() => refreshData(), 50);
      return () => clearTimeout(t);
    }
  }, [chainId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Scan token addresses on-chain for symbol/name/decimals.
   *  Returns a metadata map — nothing is persisted in DB. */
  const scanTokenMetadata = useCallback(async (addresses: string[], id: ChainId): Promise<Record<string, TokenMeta>> => {
    const result: Record<string, TokenMeta> = {};
    const batchSize = 8;
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(async (addr) => {
        try {
          const res = await analyzeAddress(addr, id);
          if (res.type === "token") {
            result[addr.toLowerCase()] = {
              symbol:   res.data.symbol,
              name:     res.data.name,
              decimals: res.data.decimals,
            };
          }
        } catch {}
      }));
    }
    return result;
  }, []);

  // 온체인 데이터 전체 갱신 (Refresh 버튼 전용)
  const refreshData = useCallback(async () => {
    if (isRefreshing) return;
    const id = chainIdRef.current;
    setIsRefreshing(true);
    setRefreshPercent(0);
    setRefreshProgress("Loading DB data…");
    try {
      // 1. DB 로드 (minimal: address + chain_id + status/label/price)
      const [dbPools, dbWallets, dbTokens] = await Promise.all([
        getPools(id), getWallets(id), getTokens(id)
      ]);
      setRefreshPercent(10);

      // 2. 토큰 메타데이터 온체인 스캔 (DB에는 저장 안 함)
      setRefreshProgress("Fetching token metadata…");
      setRefreshPercent(20);
      const scannedMeta = dbTokens.length > 0 ? await scanTokenMetadata(dbTokens.map(t => t.address), id) : {};

      // 3. Pool metadata에서도 토큰 심볼 보충 (pools/page.tsx 계산용)
      //    → 아직 pool meta가 없으면 빈 map, 이후 poolMeta 수집 후 보충
      setRefreshPercent(35);

      // 4. Active 풀 메타데이터
      const activePools = dbPools.filter(p => p.status === "a" || !p.status);
      const inactivePools = dbPools.filter(p => p.status === "i");

      setRefreshProgress(`풀 데이터 조회 중… (${activePools.length}개)`);
      setRefreshPercent(40);
      const activeMetaResults = await fetchPoolsMetadata(activePools.map(p => p.address), id);
      const metaMap: Record<string, any> = {};
      activeMetaResults.forEach(r => { metaMap[r.address.toLowerCase()] = r; });

      // 5. Pool metadata에서 토큰 심볼/decimals 보충 (scanned에 없는 토큰 커버)
      const enrichedTokenMeta = { ...scannedMeta };
      for (const r of activeMetaResults) {
        if (!r.isValid) continue;
        if (r.token0 && !enrichedTokenMeta[r.token0.toLowerCase()]) {
          enrichedTokenMeta[r.token0.toLowerCase()] = { symbol: r.symbol0 ?? "?", name: r.symbol0 ?? "?", decimals: 18 };
        }
        if (r.token1 && !enrichedTokenMeta[r.token1.toLowerCase()]) {
          enrichedTokenMeta[r.token1.toLowerCase()] = { symbol: r.symbol1 ?? "?", name: r.symbol1 ?? "?", decimals: 18 };
        }
      }
      setRefreshPercent(85);

      const now = new Date();
      setPools(dbPools);
      setWallets(dbWallets);
      setTokens(dbTokens);
      setMetadata(metaMap);
      setTokenMetadata(enrichedTokenMeta);
      setLastUpdated(now);

      // 6. 캐시 저장
      saveCache(id, {
        pools: dbPools, wallets: dbWallets, tokens: dbTokens,
        metadata: metaMap, tokenMetadata: enrichedTokenMeta, lastUpdated: now.toISOString()
      });

      setRefreshPercent(100);
      setRefreshProgress("Done!");

      // 7. Inactive 풀 백그라운드 조회
      if (inactivePools.length > 0) {
        setRefreshProgress(`비활성 풀 백그라운드 조회 중… (${inactivePools.length}개)`);
        fetchPoolsMetadata(inactivePools.map(p => p.address), id).then(inactiveResults => {
          setMetadata(prev => {
            const updated = { ...prev };
            inactiveResults.forEach(r => { updated[r.address.toLowerCase()] = r; });
            saveCache(id, {
              pools: dbPools, wallets: dbWallets, tokens: dbTokens,
              metadata: updated, tokenMetadata: enrichedTokenMeta, lastUpdated: now.toISOString()
            });
            return updated;
          });
        }).catch(() => {});
      }
    } catch (e: any) {
      console.error("Refresh failed:", e);
      setRefreshProgress(`Error: ${e?.message ?? "알 수 없는 오류"}`);
      setRefreshPercent(-1);
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshPercent(-1), 800);
    }
  }, [isRefreshing, scanTokenMetadata]);

  const togglePoolStatus = async (id: string, currentStatus?: string) => {
    const newStatus = currentStatus === "i" ? "a" : "i";
    try {
      await dbUpdatePoolStatus(id, newStatus);
      setPools(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    } catch (e) { console.error("Failed to update status", e); }
  };

  const removePool = async (id: string) => {
    try {
      await dbDeletePool(id);
      setPools(prev => prev.filter(p => p.id !== id));
    } catch (e) { console.error("Failed to delete pool", e); }
  };

  const removeWallet = async (id: string) => {
    try {
      await dbDeleteWallet(id);
      setWallets(prev => prev.filter(w => w.id !== id));
    } catch (e) { console.error("Failed to delete wallet", e); }
  };

  // 기본 데이터 가져오기
  const [isImportingDefault, setIsImportingDefault] = useState(false);
  const importDefaultData = useCallback(async () => {
    if (isImportingDefault || isRefreshing) return;
    setIsImportingDefault(true);
    try {
      const res = await fetch("/wemix-default-config.json");
      if (!res.ok) throw new Error("Failed to load default data.");
      const json = await res.text();
      const { importConfig } = await import("@/lib/db");
      importConfig(json);
      await refreshData();
    } catch (e) {
      console.error("importDefaultData failed:", e);
    } finally {
      setIsImportingDefault(false);
    }
  }, [isImportingDefault, isRefreshing, refreshData]);

  const activePools = pools.filter(p => (p.status === "a" || !p.status) && p.chain_id === chainId);
  const totalTVL = activePools.reduce((acc, p) => acc + (metadata[p.address.toLowerCase()]?.tvl || 0), 0);

  const summary = {
    totalPools: activePools.length,
    totalWallets: wallets.filter(w => w.chain_id === chainId).length,
    tvl: totalTVL,
    walletValue: wallets.filter(w => w.chain_id === chainId).length * 45000,
  };

  return (
    <AppContext.Provider value={{
      chainId, setChainId, pools, wallets, tokens, tokenMetadata,
      isLoading, isRefreshing, refreshProgress, refreshPercent, lastUpdated,
      refreshData, metadata, summary, togglePoolStatus, removePool, removeWallet,
      importDefaultData, isImportingDefault,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
