"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { DBPool, DBWallet, DBToken, TokenMeta, ChainId } from "@/lib/types";
import { getPools, getWallets, getTokens, getPoolsSync, getWalletsSync, getTokensSync, updatePoolStatus as dbUpdatePoolStatus, deletePool as dbDeletePool, deleteWallet as dbDeleteWallet, upsertToken, migrateStorage } from "@/lib/db";
import { analyzeAddress, fetchPoolsMetadata, fetchTokenPrices } from "@/lib/blockchain";
import { CHAINS } from "@/lib/utils";
import { HARDCODED_STABLE_TOKENS, getStableAddressSet } from "@/lib/stableTokens";

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
  tokenPrices: Record<string, number>;
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
  const [tokenPrices, setTokenPricesState] = useState<Record<string, number>>({});
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
    // 스테이블 토큰 pre-seed (체인 전환 시에도)
    Promise.allSettled(
      HARDCODED_STABLE_TOKENS
        .filter(t => t.chain_id === id)
        .map(t => upsertToken({ address: t.address, chain_id: id, price: "1" }))
    ).then(() => getTokens(id)).then(updated => {
      setTokens(updated);
      setTokenMetadata(prev => {
        const next = { ...prev };
        HARDCODED_STABLE_TOKENS.filter(t => t.chain_id === id).forEach(st => {
          if (!next[st.address.toLowerCase()]) {
            next[st.address.toLowerCase()] = { symbol: st.symbol, name: st.symbol, decimals: st.decimals };
          }
        });
        return next;
      });
      setIsLoading(false);
    });
    pendingRefreshRef.current = true;
  }, [loadFromCache]);

  // 초기 마운트: 캐시 로드 + 스테이블 토큰 pre-seed (온체인 요청 없음)
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;

      // 0. 구버전 localStorage 데이터 정리 (type/fee/token0 등 온체인 필드 제거)
      migrateStorage();

      // 1. 캐시 / DB 로드
      loadFromCache(chainId);

      // 2. 스테이블 토큰 항상 DB에 보장 (동기 localStorage 연산)
      async function seedStables() {
        const id = chainIdRef.current;
        await Promise.allSettled(
          HARDCODED_STABLE_TOKENS
            .filter(t => t.chain_id === id)
            .map(t => upsertToken({ address: t.address, chain_id: id, price: "1" }))
        );
        // 재로드해서 스테이블이 Token 목록에 반영되게
        const updated = await getTokens(id);
        setTokens(updated);
        // tokenMetadata에도 심볼 추가
        setTokenMetadata(prev => {
          const next = { ...prev };
          HARDCODED_STABLE_TOKENS.filter(t => t.chain_id === id).forEach(st => {
            if (!next[st.address.toLowerCase()]) {
              next[st.address.toLowerCase()] = { symbol: st.symbol, name: st.symbol, decimals: st.decimals };
            }
          });
          return next;
        });
      }
      seedStables().finally(() => setIsLoading(false));
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

      // 5. Pool metadata → 토큰 자동 등록 + tokenMeta 보충
      const enrichedTokenMeta = { ...scannedMeta };
      const stableAddrs = getStableAddressSet(id);

      // 5a. 풀에서 발견된 토큰 주소 수집 및 메타 보충
      // fetchSinglePoolMeta 반환: { token0: "0x...", symbol0: "WEMIX", dec0: 18, ... }
      const discoveredTokenAddrs = new Set<string>();
      for (const r of activeMetaResults) {
        if (!r?.isValid) continue;
        // token0
        const t0addr = r.token0 as string | undefined;
        const t0sym  = r.symbol0 as string | undefined;
        const t0dec  = (r.dec0 as number | undefined) ?? 18;
        if (t0addr && t0sym && t0sym !== "?") {
          discoveredTokenAddrs.add(t0addr.toLowerCase());
          if (!enrichedTokenMeta[t0addr.toLowerCase()]) {
            enrichedTokenMeta[t0addr.toLowerCase()] = { symbol: t0sym, name: t0sym, decimals: t0dec };
          }
        }
        // token1
        const t1addr = r.token1 as string | undefined;
        const t1sym  = r.symbol1 as string | undefined;
        const t1dec  = (r.dec1 as number | undefined) ?? 18;
        if (t1addr && t1sym && t1sym !== "?") {
          discoveredTokenAddrs.add(t1addr.toLowerCase());
          if (!enrichedTokenMeta[t1addr.toLowerCase()]) {
            enrichedTokenMeta[t1addr.toLowerCase()] = { symbol: t1sym, name: t1sym, decimals: t1dec };
          }
        }
      }

      // 5b. 발견된 토큰 자동 DB 등록 (price: null → oracle 사용)
      const existingTokenAddrs = new Set(dbTokens.map(t => t.address.toLowerCase()));
      const newTokenAddrs = [...discoveredTokenAddrs].filter(a => !existingTokenAddrs.has(a));
      if (newTokenAddrs.length > 0) {
        await Promise.allSettled(
          newTokenAddrs.map(addr =>
            upsertToken({ address: addr, chain_id: id, price: null })
          )
        );
      }

      // 5c. 하드코딩 스테이블 토큰 항상 $1.00 으로 upsert
      await Promise.allSettled(
        HARDCODED_STABLE_TOKENS
          .filter(t => t.chain_id === id)
          .map(t => upsertToken({ address: t.address, chain_id: id, price: "1" }))
      );

      // 5d. 스테이블 토큰도 enrichedTokenMeta에 심볼 보충
      for (const st of HARDCODED_STABLE_TOKENS.filter(t => t.chain_id === id)) {
        if (!enrichedTokenMeta[st.address.toLowerCase()]) {
          enrichedTokenMeta[st.address.toLowerCase()] = { symbol: st.symbol, name: st.symbol, decimals: st.decimals };
        }
      }

      // 5e. 토큰 DB 재로드 (신규 등록된 것 포함)
      const finalTokens = await getTokens(id);
      setRefreshPercent(85);

      const now = new Date();
      setPools(dbPools);
      setWallets(dbWallets);
      setTokens(finalTokens);
      setMetadata(metaMap);
      setTokenMetadata(enrichedTokenMeta);
      setLastUpdated(now);

      // 6. 캐시 저장
      saveCache(id, {
        pools: dbPools, wallets: dbWallets, tokens: finalTokens,
        metadata: metaMap, tokenMetadata: enrichedTokenMeta, lastUpdated: now.toISOString()
      });

      setRefreshPercent(100);
      setRefreshProgress("Done!");

      // 7. Inactive 풀 백그라운드 조회 + 토큰 자동 등록
      if (inactivePools.length > 0) {
        setRefreshProgress(`비활성 풀 백그라운드 조회 중… (${inactivePools.length}개)`);
        fetchPoolsMetadata(inactivePools.map(p => p.address), id).then(async inactiveResults => {
          // 7a. inactive 풀에서 토큰 주소 수집
          const inactiveTokenAddrs = new Set<string>();
          const inactiveTokenMeta: Record<string, TokenMeta> = {};
          for (const r of inactiveResults) {
            if (!r?.isValid) continue;
            const t0addr = r.token0 as string | undefined;
            const t0sym  = r.symbol0 as string | undefined;
            const t0dec  = (r.dec0 as number | undefined) ?? 18;
            if (t0addr && t0sym && t0sym !== "?") {
              inactiveTokenAddrs.add(t0addr.toLowerCase());
              inactiveTokenMeta[t0addr.toLowerCase()] = { symbol: t0sym, name: t0sym, decimals: t0dec };
            }
            const t1addr = r.token1 as string | undefined;
            const t1sym  = r.symbol1 as string | undefined;
            const t1dec  = (r.dec1 as number | undefined) ?? 18;
            if (t1addr && t1sym && t1sym !== "?") {
              inactiveTokenAddrs.add(t1addr.toLowerCase());
              inactiveTokenMeta[t1addr.toLowerCase()] = { symbol: t1sym, name: t1sym, decimals: t1dec };
            }
          }

          // 7b. 아직 DB에 없는 토큰만 등록
          const currentTokenAddrs = new Set((await getTokens(id)).map(t => t.address.toLowerCase()));
          const newInactiveTokenAddrs = [...inactiveTokenAddrs].filter(a => !currentTokenAddrs.has(a));
          if (newInactiveTokenAddrs.length > 0) {
            await Promise.allSettled(
              newInactiveTokenAddrs.map(addr => upsertToken({ address: addr, chain_id: id, price: null }))
            );
          }

          // 7c. 토큰 DB 재로드 + tokenMetadata 보충
          const finalTokensWithInactive = await getTokens(id);
          const updatedTokenMeta = { ...enrichedTokenMeta };
          for (const [addr, meta] of Object.entries(inactiveTokenMeta)) {
            if (!updatedTokenMeta[addr]) updatedTokenMeta[addr] = meta;
          }
          setTokens(finalTokensWithInactive);
          setTokenMetadata(updatedTokenMeta);

          // 7d. 메타데이터 + 캐시 업데이트
          setMetadata(prev => {
            const updated = { ...prev };
            inactiveResults.forEach(r => { updated[r.address.toLowerCase()] = r; });
            saveCache(id, {
              pools: dbPools, wallets: dbWallets, tokens: finalTokensWithInactive,
              metadata: updated, tokenMetadata: updatedTokenMeta, lastUpdated: now.toISOString()
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

  // metadata가 바뀌면 token prices 백그라운드 fetch
  useEffect(() => {
    const allTokens = new Set<string>();
    Object.values(metadata).forEach((m: any) => {
      if (m?.isValid) {
        if (m.token0) allTokens.add(m.token0.toLowerCase());
        if (m.token1) allTokens.add(m.token1.toLowerCase());
      }
    });
    if (allTokens.size === 0) return;
    const id = chainIdRef.current;
    const currentPools = pools.filter(p => p.chain_id === id);
    const regTokens = Object.entries(tokenMetadata).map(([addr, m]) => ({ address: addr, symbol: (m as any).symbol }));
    fetchTokenPrices(Array.from(allTokens), id, currentPools, regTokens, metadata)
      .then(results => {
        const pMap: Record<string, number> = {};
        results.forEach(r => { if (Number(r.price) > 0) pMap[r.address.toLowerCase()] = Number(r.price); });
        setTokenPricesState(pMap);
      })
      .catch(() => {});
  }, [metadata, chainId, tokenMetadata]);

  const activePools = pools.filter(p => (p.status === "a" || !p.status) && p.chain_id === chainId);

  const getEffectiveTVL = (meta: any): number => {
    if (!meta?.isValid) return 0;
    const t0Price = tokenPrices[meta.token0?.toLowerCase()] || 0;
    const t1Price = tokenPrices[meta.token1?.toLowerCase()] || 0;
    const computed = Number(meta.t0Amt || 0) * t0Price + Number(meta.t1Amt || 0) * t1Price;
    if (computed > 0) return computed;
    return Number(meta?.tvl || 0);
  };

  const totalTVL = activePools.reduce((acc, p) => {
    const meta = metadata[p.address.toLowerCase()];
    return acc + getEffectiveTVL(meta);
  }, 0);

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
      refreshData, metadata, tokenPrices, summary, togglePoolStatus, removePool, removeWallet,
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
