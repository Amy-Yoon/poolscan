"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { DBPool, DBWallet, DBToken, ChainId } from "@/lib/types";
import { getPools, getWallets, getTokens, getPoolsSync, getWalletsSync, getTokensSync, updatePoolStatus as dbUpdatePoolStatus, deletePool as dbDeletePool, deleteWallet as dbDeleteWallet, syncPools } from "@/lib/db";
import { analyzeAddress, fetchPoolsMetadata } from "@/lib/blockchain";
import { CHAINS } from "@/lib/utils";

interface AppContextType {
  chainId: ChainId;
  setChainId: (id: ChainId) => void;
  pools: DBPool[];
  wallets: DBWallet[];
  tokens: DBToken[];
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ── Cache helpers ─────────────────────────────────────────────
const CACHE_VERSION = "v2";
function cacheKey(chainId: number) { return `poolscan-cache-${CACHE_VERSION}-${chainId}`; }

function saveCache(chainId: number, data: { pools: DBPool[]; wallets: DBWallet[]; tokens: DBToken[]; metadata: Record<string, any>; lastUpdated: string }) {
  try { localStorage.setItem(cacheKey(chainId), JSON.stringify(data)); } catch {}
}

function loadCache(chainId: number): { pools: DBPool[]; wallets: DBWallet[]; tokens: DBToken[]; metadata: Record<string, any>; lastUpdated: string } | null {
  try {
    const raw = localStorage.getItem(cacheKey(chainId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── Token lists ───────────────────────────────────────────────
const TESTNET_TOKENS: string[] = [];
const MAINNET_TOKENS: string[] = [];

const generateInitialPools = (chainId: number): DBPool[] => {
  const chain = CHAINS.find(c => c.id === chainId);
  const list = chain?.knownPoolAddresses || [];
  return list.map((item, idx) => ({
    id: `init-${chainId}-${idx}`,
    created_at: new Date().toISOString(),
    address: item.address,
    chain_id: chainId,
    type: "v3" as const,
    fee: null,
    token0: "",
    token1: "",
    label: null,
    status: item.status,
  }));
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [chainId, setChainIdState] = useState<ChainId>(1111);
  const [pools, setPools] = useState<DBPool[]>([]);
  const [wallets, setWallets] = useState<DBWallet[]>([]);
  const [tokens, setTokens] = useState<DBToken[]>([]);
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
      setLastUpdated(new Date(cached.lastUpdated));
      // 캐시에서 로드된 풀을 poolscan_pools에도 동기화 (export 시 누락 방지)
      syncPools(cached.pools);
      return true;
    }
    // 캐시 없으면 localStorage DB에서 직접 로드 (가져오기 후 체인 전환 시 대응)
    const dbPools = getPoolsSync(id);
    const dbWallets = getWalletsSync(id);
    const dbTokens = getTokensSync(id);
    const initialPools = generateInitialPools(id);
    // initialPools + dbPools 병합
    const merged = [...dbPools];
    initialPools.forEach(ip => {
      if (!merged.find(mp => mp.address.toLowerCase() === ip.address.toLowerCase())) {
        merged.push(ip);
      }
    });
    setPools(merged);
    setWallets(dbWallets);
    setTokens(dbTokens);
    setMetadata({});
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
    // refreshData는 chainIdRef.current를 참조하므로 setState 반영 후 실행
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
      // 짧은 지연 후 실행 (state 업데이트 완료 대기)
      const t = setTimeout(() => refreshData(), 50);
      return () => clearTimeout(t);
    }
  }, [chainId]); // eslint-disable-line react-hooks/exhaustive-deps

  const scanTokens = useCallback(async (addresses: string[], id: ChainId) => {
    const results: DBToken[] = [];
    const batchSize = 8;
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(async (addr) => {
        try {
          const res = await analyzeAddress(addr, id);
          if (res.type === "token") return {
            id: `token-${id}-${addr}`, address: addr, chain_id: id,
            symbol: res.data.symbol, name: res.data.name, decimals: res.data.decimals,
            created_at: new Date().toISOString()
          } as DBToken;
        } catch {}
        return null;
      }));
      results.push(...(batchResults.filter(Boolean) as DBToken[]));
    }
    return results;
  }, []);

  // 온체인 데이터 전체 갱신 (Refresh 버튼 전용)
  const refreshData = useCallback(async () => {
    if (isRefreshing) return;
    const id = chainIdRef.current;
    setIsRefreshing(true);
    setRefreshPercent(0);
    setRefreshProgress("DB 데이터 불러오는 중…");
    try {
      // 1. DB + 초기 풀 목록 병합
      const [dbPools, dbWallets, dbTokens] = await Promise.all([
        getPools(id), getWallets(id), getTokens(id)
      ]);
      const initialPools = generateInitialPools(id);
      const mergedPools = [...dbPools];
      initialPools.forEach(ip => {
        if (!mergedPools.find(mp => mp.address.toLowerCase() === ip.address.toLowerCase())) {
          mergedPools.push(ip);
        }
      });
      // 신규 초기 풀을 localStorage에도 동기화 (export 시 누락 방지)
      syncPools(mergedPools);
      setRefreshPercent(10);

      // 2. 토큰 스캔 — symbol이 비어있는 등록 토큰들의 메타데이터를 온체인에서 채움
      setRefreshProgress("토큰 정보 조회 중…");
      setRefreshPercent(20);
      const emptyTokenAddrs = dbTokens
        .filter(t => !t.symbol || t.symbol.trim() === "")
        .map(t => t.address);
      const scannedTokens = emptyTokenAddrs.length > 0 ? await scanTokens(emptyTokenAddrs, id) : [];
      // scanned 결과로 기존 레코드 업데이트 (symbol/name/decimals 덮어쓰기)
      const mergedTokens = dbTokens.map(t => {
        const fetched = scannedTokens.find(s => s.address.toLowerCase() === t.address.toLowerCase());
        return fetched ? { ...t, symbol: fetched.symbol, name: fetched.name, decimals: fetched.decimals } : t;
      });
      // 업데이트된 토큰을 localStorage에도 반영
      if (scannedTokens.length > 0) {
        const { upsertToken } = await import("@/lib/db");
        await Promise.all(mergedTokens.filter(t => t.symbol).map(t => upsertToken(t)));
      }
      setRefreshPercent(35);

      // 3. Active 풀 메타데이터 먼저 (UI 빠르게 업데이트)
      const activePools = mergedPools.filter(p => p.status === "a" || !p.status);
      const inactivePools = mergedPools.filter(p => p.status === "i");

      setRefreshProgress(`풀 데이터 조회 중… (${activePools.length}개)`);
      setRefreshPercent(40);
      const activeMetaResults = await fetchPoolsMetadata(activePools.map(p => p.address), id);
      const metaMap: Record<string, any> = {};
      activeMetaResults.forEach(r => { metaMap[r.address.toLowerCase()] = r; });
      setRefreshPercent(85);

      const now = new Date();
      setPools(mergedPools);
      setWallets(dbWallets);
      setTokens(mergedTokens);
      setMetadata(metaMap);
      setLastUpdated(now);

      // 4. 캐시 저장
      saveCache(id, {
        pools: mergedPools, wallets: dbWallets, tokens: mergedTokens,
        metadata: metaMap, lastUpdated: now.toISOString()
      });

      setRefreshPercent(100);
      setRefreshProgress("완료!");

      // 5. Inactive 풀 백그라운드 조회
      if (inactivePools.length > 0) {
        setRefreshProgress(`비활성 풀 백그라운드 조회 중… (${inactivePools.length}개)`);
        fetchPoolsMetadata(inactivePools.map(p => p.address), id).then(inactiveResults => {
          setMetadata(prev => {
            const updated = { ...prev };
            inactiveResults.forEach(r => { updated[r.address.toLowerCase()] = r; });
            saveCache(id, {
              pools: mergedPools, wallets: dbWallets, tokens: mergedTokens,
              metadata: updated, lastUpdated: now.toISOString()
            });
            return updated;
          });
        }).catch(() => {});
      }
    } catch (e: any) {
      console.error("Refresh failed:", e);
      setRefreshProgress(`오류: ${e?.message ?? "알 수 없는 오류"}`);
      setRefreshPercent(-1);
    } finally {
      setIsRefreshing(false);
      // 완료 후 잠시 뒤 percent 초기화
      setTimeout(() => setRefreshPercent(-1), 800);
    }
  }, [isRefreshing, scanTokens]);

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
      chainId, setChainId, pools, wallets, tokens,
      isLoading, isRefreshing, refreshProgress, refreshPercent, lastUpdated,
      refreshData, metadata, summary, togglePoolStatus, removePool, removeWallet,
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
