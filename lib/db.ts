/**
 * Local storage-based persistence (no backend required).
 * DB stores only the minimum needed to identify each entity:
 *   Pool   → address, chain_id, status
 *   Wallet → address, chain_id, label
 *   Token  → address, chain_id, price (fixed price override; null = use oracle)
 *
 * All metadata (symbol, name, decimals, fee, type, token0/token1…)
 * is fetched on-chain at runtime and never persisted here.
 *
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

// ── Sync reads ────────────────────────────────────────────────

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
    address:    pool.address,
    chain_id:   pool.chain_id,
    status:     pool.status,
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
    const updated: DBToken = { ...all[idx], price: token.price ?? all[idx].price };
    all[idx] = updated;
    setItem("tokens", all);
    return updated;
  }
  const newToken: DBToken = {
    address:    token.address,
    chain_id:   token.chain_id,
    price:      token.price ?? null,
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

/** Download current config as a JSON file — only minimal identifiers */
export function exportConfig(): void {
  const allPools   = getItem<DBPool[]>("pools", []);
  const allWallets = getItem<DBWallet[]>("wallets", []);
  const allTokens  = getItem<DBToken[]>("tokens", []);

  const config = {
    version: 2,
    exportedAt: new Date().toISOString(),
    pools: allPools.map(p => ({
      address:  p.address,
      chain_id: p.chain_id,
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
      price:    t.price,
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

/** Restore config from a JSON file.
 *  Handles v1 (with type/fee/token0/token1/symbol/decimals) and v2 (minimal) formats. */
export function importConfig(json: string): { pools: number; wallets: number; tokens: number } {
  const config = JSON.parse(json);
  if (config.version !== 1 && config.version !== 2) throw new Error("Unsupported config version");

  const now = new Date().toISOString();
  const uid = () => Math.random().toString(36).slice(2, 9);

  // Pools — accept both v1 (with extra fields) and v2 (address+chain_id+status only)
  const existingPools = getItem<DBPool[]>("pools", []);
  const newPools = (config.pools ?? [])
    .filter((p: any) => !existingPools.some((e: DBPool) =>
      e.address.toLowerCase() === p.address.toLowerCase() && e.chain_id === p.chain_id
    ))
    .map((p: any): DBPool => ({
      id:         uid(),
      created_at: now,
      address:    p.address,
      chain_id:   p.chain_id,
      status:     p.status ?? "a",
    }));
  setItem("pools", [...newPools, ...existingPools]);

  // Wallets
  const existingWallets = getItem<DBWallet[]>("wallets", []);
  const newWallets = (config.wallets ?? [])
    .filter((w: any) => !existingWallets.some((e: DBWallet) =>
      e.address.toLowerCase() === w.address.toLowerCase() && e.chain_id === w.chain_id
    ))
    .map((w: any): DBWallet => ({
      id:         uid(),
      created_at: now,
      address:    w.address,
      chain_id:   w.chain_id,
      label:      w.label ?? null,
    }));
  setItem("wallets", [...newWallets, ...existingWallets]);

  // Tokens — v1 had symbol/name/decimals (ignored now); v2 has price only
  const existingTokens = getItem<DBToken[]>("tokens", []);
  const newTokens = (config.tokens ?? [])
    .filter((t: any) => !existingTokens.some((e: DBToken) =>
      e.address.toLowerCase() === t.address.toLowerCase() && e.chain_id === t.chain_id
    ))
    .map((t: any): DBToken => ({
      id:         uid(),
      created_at: now,
      address:    t.address,
      chain_id:   t.chain_id,
      price:      t.price ?? null,
    }));
  setItem("tokens", [...newTokens, ...existingTokens]);

  return { pools: newPools.length, wallets: newWallets.length, tokens: newTokens.length };
}
