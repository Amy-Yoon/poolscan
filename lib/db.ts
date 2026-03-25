/**
 * Local storage-based persistence (no backend required).
 * All data is stored in the browser's localStorage under "poolscan_*" keys.
 * Use exportConfig / importConfig for cross-device backup/restore.
 */
import type { DBPool, DBWallet, DBToken } from "./types";

// ── Storage helpers ───────────────────────────────────────────

function getItem<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(`poolscan_${key}`);
    return raw ? (JSON.parse(raw) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`poolscan_${key}`, JSON.stringify(value));
}

// ── Sync reads (for use where async is not available) ─────────

export function getPoolsSync(chainId: number): DBPool[] {
  return getItem<DBPool[]>("pools", []).filter(p => p.chain_id === chainId);
}
export function getWalletsSync(chainId: number): DBWallet[] {
  return getItem<DBWallet[]>("wallets", []).filter(w => w.chain_id === chainId);
}
export function getTokensSync(chainId: number): DBToken[] {
  return getItem<DBToken[]>("tokens", []).filter(t => t.chain_id === chainId);
}

// ── Pools ─────────────────────────────────────────────────────

export async function getPools(chainId: number): Promise<DBPool[]> {
  return getPoolsSync(chainId);
}

export async function insertPool(pool: Omit<DBPool, "id" | "created_at">): Promise<DBPool> {
  const all = getItem<DBPool[]>("pools", []);
  const newPool: DBPool = {
    ...pool,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
  };
  setItem("pools", [newPool, ...all]);
  return newPool;
}

export async function updatePoolStatus(id: string, status: "a" | "i"): Promise<void> {
  const all = getItem<DBPool[]>("pools", []);
  setItem("pools", all.map(p => p.id === id ? { ...p, status } : p));
}

export async function deletePool(id: string): Promise<void> {
  setItem("pools", getItem<DBPool[]>("pools", []).filter(p => p.id !== id));
}

/**
 * Sync the full merged pool list back to localStorage.
 * Called after refreshData merges DB pools + initial pools,
 * so that exportConfig always captures the complete list.
 */
export function syncPools(pools: DBPool[]): void {
  const existing = getItem<DBPool[]>("pools", []);
  // Add any pool not yet in storage (dedup by address+chain_id)
  const toAdd = pools.filter(
    p => !existing.some(e => e.address.toLowerCase() === p.address.toLowerCase() && e.chain_id === p.chain_id)
  );
  if (toAdd.length > 0) {
    setItem("pools", [...existing, ...toAdd]);
  }
}

// ── Wallets ───────────────────────────────────────────────────

export async function getWallets(chainId: number): Promise<DBWallet[]> {
  return getWalletsSync(chainId);
}

export async function insertWallet(wallet: Omit<DBWallet, "id" | "created_at">): Promise<DBWallet> {
  const all = getItem<DBWallet[]>("wallets", []);
  const newWallet: DBWallet = {
    ...wallet,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
  };
  setItem("wallets", [newWallet, ...all]);
  return newWallet;
}

export async function deleteWallet(id: string): Promise<void> {
  setItem("wallets", getItem<DBWallet[]>("wallets", []).filter(w => w.id !== id));
}

// ── Tokens ────────────────────────────────────────────────────

export async function getTokens(chainId: number): Promise<DBToken[]> {
  return getTokensSync(chainId);
}

export async function upsertToken(token: Omit<DBToken, "id" | "created_at">): Promise<DBToken> {
  const all = getItem<DBToken[]>("tokens", []);
  const idx = all.findIndex(
    t => t.address.toLowerCase() === token.address.toLowerCase() && t.chain_id === token.chain_id
  );
  if (idx >= 0) {
    const updated = { ...all[idx], ...token };
    all[idx] = updated;
    setItem("tokens", all);
    return updated;
  }
  const newToken: DBToken = {
    ...token,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
  };
  setItem("tokens", [newToken, ...all]);
  return newToken;
}

export async function deleteToken(id: string): Promise<void> {
  setItem("tokens", getItem<DBToken[]>("tokens", []).filter(t => t.id !== id));
}

// ── Config export / import ────────────────────────────────────

export interface PoolscanConfig {
  version: 1;
  exportedAt: string;
  pools: DBPool[];
  wallets: DBWallet[];
  tokens: DBToken[];
}

/** Download current config as a JSON file */
export function exportConfig(): void {
  const allPools   = getItem<DBPool[]>("pools", []);
  const allWallets = getItem<DBWallet[]>("wallets", []);
  const allTokens  = getItem<DBToken[]>("tokens", []);

  // Slim format — strip internal fields (id, created_at) not needed for restore
  const config = {
    version: 1,
    exportedAt: new Date().toISOString(),
    pools: allPools.map(p => ({
      address:  p.address,
      chain_id: p.chain_id,
      type:     p.type,
      fee:      p.fee,
      token0:   p.token0,
      token1:   p.token1,
      label:    p.label,
      status:   p.status,
    })),
    wallets: allWallets.map(w => ({
      address:  w.address,
      chain_id: w.chain_id,
      label:    w.label,
    })),
    tokens: allTokens.map(t => ({
      address:  t.address,
      chain_id: t.chain_id,
      symbol:   t.symbol,
      name:     t.name,
      decimals: t.decimals,
    })),
  };
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `poolscan-config-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Restore config from a JSON file (merges, deduplicates by address+chain_id).
 *  Handles both full records and slim records (address + chain_id only). */
export function importConfig(json: string): { pools: number; wallets: number; tokens: number } {
  const config = JSON.parse(json) as PoolscanConfig;
  if (config.version !== 1) throw new Error("Unsupported config version");

  const now = new Date().toISOString();
  const uid = () => Math.random().toString(36).slice(2, 9);

  // Pools — normalise slim format (address + chain_id + status) to full DBPool
  const existingPools = getItem<DBPool[]>("pools", []);
  const newPools = (config.pools ?? [])
    .filter(p => !existingPools.some(e => e.address.toLowerCase() === p.address.toLowerCase() && e.chain_id === p.chain_id))
    .map(p => ({
      id: (p as any).id ?? uid(),
      created_at: (p as any).created_at ?? now,
      address: p.address,
      chain_id: p.chain_id,
      type: (p as any).type ?? null,
      fee: (p as any).fee ?? null,
      token0: (p as any).token0 ?? "",
      token1: (p as any).token1 ?? "",
      label: (p as any).label ?? null,
      status: (p as any).status ?? "a",
    } as DBPool));
  setItem("pools", [...newPools, ...existingPools]);

  // Wallets — normalise slim format (address + chain_id + label)
  const existingWallets = getItem<DBWallet[]>("wallets", []);
  const newWallets = (config.wallets ?? [])
    .filter(w => !existingWallets.some(e => e.address.toLowerCase() === w.address.toLowerCase() && e.chain_id === w.chain_id))
    .map(w => ({
      id: (w as any).id ?? uid(),
      created_at: (w as any).created_at ?? now,
      address: w.address,
      chain_id: w.chain_id,
      label: (w as any).label ?? null,
    } as DBWallet));
  setItem("wallets", [...newWallets, ...existingWallets]);

  // Tokens — normalise slim format (address + chain_id only)
  const existingTokens = getItem<DBToken[]>("tokens", []);
  const newTokens = (config.tokens ?? [])
    .filter(t => !existingTokens.some(e => e.address.toLowerCase() === t.address.toLowerCase() && e.chain_id === t.chain_id))
    .map(t => ({
      id: (t as any).id ?? uid(),
      created_at: (t as any).created_at ?? now,
      address: t.address,
      chain_id: t.chain_id,
      symbol: (t as any).symbol ?? "",
      name: (t as any).name ?? "",
      decimals: (t as any).decimals ?? 18,
    } as DBToken));
  setItem("tokens", [...newTokens, ...existingTokens]);

  return { pools: newPools.length, wallets: newWallets.length, tokens: newTokens.length };
}
