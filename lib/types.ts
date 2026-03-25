// ============================================================
// PoolScan — Core Types
// ============================================================

export type ChainId = 1 | 137 | 42161 | 10 | 8453 | 1111 | 1112;

export interface Chain {
  id:    ChainId;
  name:  string;
  color: string;
  icon:  string;
  rpcUrl: string;
  explorer: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  gateways: string[];
  nfpm?: string;
  nfph?: string;
  knownPoolAddresses?: { address: string; status: "a" | "i" }[];
}

// ── DB rows (minimal — only what we persist) ────────────────

export interface DBToken {
  id:         string;
  created_at: string;
  address:    string;
  chain_id:   number;
  /** Fixed price override in USD (null = use on-chain oracle). Only set for stable tokens. */
  price:      string | null;
}

export interface DBPool {
  id:         string;
  created_at: string;
  address:    string;
  chain_id:   number;
  status:     "a" | "i";
}

export interface DBWallet {
  id:         string;
  created_at: string;
  address:    string;
  chain_id:   number;
  label:      string | null;
}

// ── On-chain / computed data (in-memory only) ───────────────

export interface TokenMeta {
  symbol:   string;
  name:     string;
  decimals: number;
}

export interface LPPosition {
  poolAddress:   string;
  token0:        string;
  token1:        string;
  type:          "v2" | "v3";
  fee:           number;
  // V3 only
  priceLower:    number | null;
  priceUpper:    number | null;
  currentPrice:  number;
  // amounts
  token0Amount:  number;
  token1Amount:  number;
  totalValue:    number;
  claimableFee0: number;
  claimableFee1: number;
  il:            number;
  inRange:       boolean;
}

export interface EnrichedWallet extends DBWallet {
  positions: LPPosition[];
}

// ── Token registry map ──────────────────────────────────────
export type TokenMap = Record<string, TokenMeta>;
