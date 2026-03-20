import { createClient } from "@supabase/supabase-js";
import type { DBPool, DBWallet, DBToken } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

// ── Pools ────────────────────────────────────────────────────

export async function getPools(chainId: number): Promise<DBPool[]> {
  const { data, error } = await supabase
    .from("pools")
    .select("*")
    .eq("chain_id", chainId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function insertPool(
  pool: Omit<DBPool, "id" | "created_at">
): Promise<DBPool> {
  const { data, error } = await supabase
    .from("pools")
    .insert(pool)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePool(id: string): Promise<void> {
  const { error } = await supabase.from("pools").delete().eq("id", id);
  if (error) throw error;
}

// ── Wallets ──────────────────────────────────────────────────

export async function getWallets(chainId: number): Promise<DBWallet[]> {
  const { data, error } = await supabase
    .from("wallets")
    .select("*")
    .eq("chain_id", chainId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function insertWallet(
  wallet: Omit<DBWallet, "id" | "created_at">
): Promise<DBWallet> {
  const { data, error } = await supabase
    .from("wallets")
    .insert(wallet)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWallet(id: string): Promise<void> {
  const { error } = await supabase.from("wallets").delete().eq("id", id);
  if (error) throw error;
}

// ── Tokens ───────────────────────────────────────────────────

export async function getTokens(chainId: number): Promise<DBToken[]> {
  const { data, error } = await supabase
    .from("tokens")
    .select("*")
    .eq("chain_id", chainId)
    .order("symbol");
  if (error) throw error;
  return data ?? [];
}

export async function upsertToken(
  token: Omit<DBToken, "id" | "created_at">
): Promise<DBToken> {
  const { data, error } = await supabase
    .from("tokens")
    .upsert(token, { onConflict: "address,chain_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteToken(id: string): Promise<void> {
  const { error } = await supabase.from("tokens").delete().eq("id", id);
  if (error) throw error;
}
