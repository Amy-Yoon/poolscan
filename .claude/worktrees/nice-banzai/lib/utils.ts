import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Chain, ChainId, TokenMap } from "./types";

// ── Tailwind class merging ───────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Chain config ─────────────────────────────────────────────
export const CHAINS: Chain[] = [
  { id: 1,     name: "Ethereum", color: "#627EEA", icon: "Ξ",  rpcEnvKey: "NEXT_PUBLIC_RPC_ETHEREUM" },
  { id: 137,   name: "Polygon",  color: "#8247E5", icon: "⬡", rpcEnvKey: "NEXT_PUBLIC_RPC_POLYGON"  },
  { id: 42161, name: "Arbitrum", color: "#28A0F0", icon: "◈", rpcEnvKey: "NEXT_PUBLIC_RPC_ARBITRUM" },
  { id: 10,    name: "Optimism", color: "#FF0420", icon: "◎", rpcEnvKey: "NEXT_PUBLIC_RPC_OPTIMISM" },
  { id: 8453,  name: "Base",     color: "#0052FF", icon: "●", rpcEnvKey: "NEXT_PUBLIC_RPC_BASE"     },
];

export const getChain = (id: ChainId) => CHAINS.find((c) => c.id === id)!;

// ── Formatters ───────────────────────────────────────────────
export const fmtAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const fmtUSD = (n: number): string => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};

export const fmtNum = (n: number, d = 4): string => {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(d);
};

export const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

// ── Token helpers ────────────────────────────────────────────
export const getSymbol = (addr: string, tokens: TokenMap): string =>
  tokens[addr.toLowerCase()]?.symbol ?? fmtAddr(addr);

export const getPoolName = (
  token0: string,
  token1: string,
  tokens: TokenMap
): string => `${getSymbol(token0, tokens)} / ${getSymbol(token1, tokens)}`;

// ── CSV export ───────────────────────────────────────────────
export function downloadCSV(rows: (string | number)[][], filename: string) {
  const csv = rows.map((r) => r.map(String).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: filename,
  });
  a.click();
}

// ── Token brand colors (for avatars) ────────────────────────
const TOKEN_COLORS: Record<string, string> = {
  WETH:  "#627EEA",
  ETH:   "#627EEA",
  USDC:  "#2775CA",
  WBTC:  "#F7931A",
  BTC:   "#F7931A",
  USDT:  "#26A17B",
  DAI:   "#F5AC37",
  UNI:   "#FF007A",
  LINK:  "#2A5ADA",
  MATIC: "#8247E5",
  ARB:   "#28A0F0",
  OP:    "#FF0420",
};

export const getTokenColor = (symbol?: string): string =>
  (symbol && TOKEN_COLORS[symbol.toUpperCase()]) || "#4F6EF7";
