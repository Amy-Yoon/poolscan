/**
 * Local storage-based persistence (no backend required).
 * DB stores only the minimum needed to identify each entity:
 *   Pool   → address, chain_id, status
 *   Wallet → address, chain_id, label
 *   Token  → address, chain_id, price (fixed price override; null = use oracle)
 *
 * All metadata (symbol, name, decimals, fee, type, token0/token1…)
 * is fetched on-chain at runtime and NEVER persisted here.
 *
 * export/import format (version 3):
 *   - pools:   [{ address, chain_id, status }]
 *   - wallets: [{ address, chain_id, label }]
 *   - tokens:  NOT included (auto-discovered from pool metadata at runtime)
 *
 * Use exportConfig / importConfig for cross-device backup/restore.
 */
import type { DBPool, DBWallet, DBToken } from "./types";

// ── Storage helpers ───────────────────────────────────────────

/** 앱 시작 시 1회 실행 — 구버전 localStorage 데이터 정리 */
export function migrateStorage(): void {
  if (typeof window === "undefined") return;
  try {
    // Pool: 구버전에 type/fee/token0/token1/label 등이 남아있으면 제거
    const rawPools = localStorage.getItem("poolscan_pools");
    if (rawPools) {
      const pools = JSON.parse(rawPools) as any[];
      const cleaned = pools.map((p: any) => ({
        id:         p.id,
        created_at: p.created_at,
        address:    p.address,
        chain_id:   p.chain_id,
        status:     p.status ?? "a",
      }));
      localStorage.setItem("poolscan_pools", JSON.stringify(cleaned));
    }
    // Token: 구버전에 symbol/name/decimals가 있으면 제거
    const rawTokens = localStorage.getItem("poolscan_tokens");
    if (rawTokens) {
      const tokens = JSON.parse(rawTokens) as any[];
      const cleaned = tokens.map((t: any) => ({
        id:         t.id,
        created_at: t.created_at,
        address:    t.address,
        chain_id:   t.chain_id,
        price:      t.price ?? null,
      }));
      localStorage.setItem("poolscan_tokens", JSON.stringify(cleaned));
    }
  } catch { /* 무시 */ }
}

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

/** Download current config as a JSON file — pools + wallets only.
 *  Tokens are NOT exported — they are auto-discovered from pool metadata at runtime. */
export function exportConfig(): void {
  const allPools   = getItem<any[]>("pools", []);
  const allWallets = getItem<DBWallet[]>("wallets", []);

  const config = {
    version: 3,
    exportedAt: new Date().toISOString(),
    pools: allPools.map((p: any) => ({
      address:  p.address,
      chain_id: p.chain_id,
      status:   p.status ?? "a",
    })),
    wallets: allWallets.map(w => ({
      address:  w.address,
      chain_id: w.chain_id,
      label:    w.label,
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
 *  Handles v1/v2 (legacy with extra fields) and v3 (clean — pools+wallets only). */
export function importConfig(json: string): { pools: number; wallets: number } {
  const config = JSON.parse(json);
  if (![1, 2, 3].includes(config.version)) throw new Error("Unsupported config version");

  const now = new Date().toISOString();
  const uid = () => Math.random().toString(36).slice(2, 9);

  // Pools — strip all extra fields, only keep address/chain_id/status
  const existingPools = getItem<any[]>("pools", []);
  const newPools = (config.pools ?? [])
    .filter((p: any) => !existingPools.some((e: any) =>
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

  // Tokens: NOT imported — auto-discovered from pool metadata via refreshData()

  return { pools: newPools.length, wallets: newWallets.length };
}
