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

// ── Supabase DB rows ────────────────────────────────────────

export interface DBToken {
  id:         string;
  created_at: string;
  address:    string;
  chain_id:   number;
  symbol:     string;
  name:       string;
  decimals:   number;
}

export interface DBPool {
  id:         string;
  created_at: string;
  address:    string;
  chain_id:   number;
  type:       "v2" | "v3";
  fee:        number | null;
  token0:     string;
  token1:     string;
  label:      string | null;
  status:     "a" | "i";
}

export interface DBWallet {
  id:         string;
  created_at: string;
  address:    string;
  chain_id:   number;
  label:      string | null;
}

// ── On-chain / computed data ────────────────────────────────

export interface TokenMeta {
  symbol:   string;
  name:     string;
  decimals: number;
}

/** Pool with live on-chain data merged in */
export interface EnrichedPool extends DBPool {
  token0Meta:   TokenMeta | null;
  token1Meta:   TokenMeta | null;
  // on-chain
  sqrtPriceX96: string | null;
  currentTick:  number | null;
  exchangeRate: number | null;
  token0Price:  number | null;
  token1Price:  number | null;
  token0Amount: number | null;
  token1Amount: number | null;
  tvl:          number | null;
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
