import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Chain, ChainId, TokenMap } from "./types";
import { MAINNET_V2_CONTRACTS, TESTNET_V2_CONTRACTS } from "./v2Contracts";

// ── Tailwind class merging ───────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Chain config ─────────────────────────────────────────────
export const CHAINS: Chain[] = [
  {
    id: 1111,
    name: "WEMIX Mainnet",
    color: "#3B82F6",
    icon: "M",
    rpcUrl: process.env.NEXT_PUBLIC_MAINNET_RPC_URL || "https://api.wemix.com/",
    explorer: process.env.NEXT_PUBLIC_MAINNET_EXPLORER || "https://scan.wemix.com/",
    nativeCurrency: { name: "WEMIX", symbol: "WEMIX", decimals: 18 },
    gateways: [
      process.env.NEXT_PUBLIC_MAINNET_GATEWAY_1 || "0xa2da60884848a549D1895fe6A9f67E68D57A1047",
      process.env.NEXT_PUBLIC_MAINNET_GATEWAY_2 || "0x221fa34839Cc91794DD48BD3298872CA338891d9",
    ],
    nfpm: process.env.NEXT_PUBLIC_MAINNET_NFPM || "0x3fc9d5600525276B89A2d4e126850FE992a86634",
    nfph: process.env.NEXT_PUBLIC_MAINNET_NFPH || "0x581dd116d7B01E244b5609d0E215fF994E96Fe3e",
    // V2 LP 스캔용 컨트랙트 목록 — lib/v2Contracts.ts 에서 관리
    knownPoolAddresses: MAINNET_V2_CONTRACTS.map(address => ({ address, status: "a" as const })),
  },
  {
    id: 1112,
    name: "WEMIX Testnet",
    color: "#F59E0B",
    icon: "T",
    rpcUrl: process.env.NEXT_PUBLIC_TESTNET_RPC_URL || "https://api.test.wemix.com/",
    explorer: process.env.NEXT_PUBLIC_TESTNET_EXPLORER || "https://scan.wemix.com/wemixTestnet/",
    nativeCurrency: { name: "tWEMIX", symbol: "tWEMIX", decimals: 18 },
    gateways: [
      process.env.NEXT_PUBLIC_TESTNET_GATEWAY_1 || "0x7460756B203911c0eF35B424329E25943dee2Cae",
      process.env.NEXT_PUBLIC_TESTNET_GATEWAY_2 || "0x920be579adbbe36c6dd0b5e4dbe85003688f5549",
      process.env.NEXT_PUBLIC_TESTNET_GATEWAY_3 || "0xc57Cb79817B06fBce82FA78d0bfCDCF69fc269FA",
      process.env.NEXT_PUBLIC_TESTNET_GATEWAY_4 || "0xF6165cAdA4D5D02aDb286AADFb4FE13B11750aF3",
    ],
    nfpm: process.env.NEXT_PUBLIC_TESTNET_NFPM || "0x06c1cb547c1ef4d69689a9e1dc250A912d429D5d",
    nfph: process.env.NEXT_PUBLIC_TESTNET_NFPH || "0xD03174383d12caa575c06faA8e343A2141C367aa",
    // V2 LP 스캔용 컨트랙트 목록 — lib/v2Contracts.ts 에서 관리
    knownPoolAddresses: TESTNET_V2_CONTRACTS.map(address => ({ address, status: "a" as const })),
  },
];

export const getChain = (id: ChainId) => CHAINS.find((c) => c.id === id)!;

// ── Formatters ───────────────────────────────────────────────
export const fmtAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// Abnormally large values (decimal precision errors) → N/A
const SANE_MAX = 1e13;

/** Strip trailing decimal zeros  "1.2300" → "1.23",  "5.0" → "5" */
function stripZeros(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "");
}

/** Abbreviated USD for compact stat cards — keeps K / M / B suffix. */
export const fmtUSD = (n: number): string => {
  if (!isFinite(n) || isNaN(n) || n >= SANE_MAX) return "N/A";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};

/**
 * Full USD — smart decimals, no K/M/B.
 *  ≥ $1,000 → integer with commas   e.g. $1,234,567
 *  ≥ $1     → 2 dp                  e.g. $12.34
 *  < $1     → up to 8 dp, strip trailing zeros   e.g. $0.001234
 */
export const fmtFullUSD = (n: any): string => {
  const val = Number(n);
  if (!isFinite(val) || isNaN(val) || val >= SANE_MAX) return "N/A";
  if (val === 0) return "$0";
  const abs = Math.abs(val);
  if (abs >= 1000) return "$" + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(val));
  if (abs >= 1)    return "$" + val.toFixed(2);
  return "$" + stripZeros(val.toFixed(8));
};

/**
 * Token amount — same numeric policy as fmtFullUSD, no $ sign.
 *  ≥ 1,000 → integer with commas   e.g. 1,234,567
 *  ≥ 1     → 2 dp                  e.g. 12.34
 *  < 1     → up to 8 dp, strip trailing zeros   e.g. 0.001234
 */
export const fmtAmt = (n: any): string => {
  const val = Number(n);
  if (!isFinite(val) || isNaN(val) || val >= SANE_MAX) return "N/A";
  if (val === 0) return "0";
  const abs = Math.abs(val);
  if (abs >= 1000) return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(val));
  if (abs >= 1)    return val.toFixed(2);
  return stripZeros(val.toFixed(4));
};

/**
 * Exchange rate — smart significant digits.
 *  ≥ 1,000  → integer
 *  ≥ 1      → 4 dp, strip trailing zeros
 *  ≥ 0.001  → 6 dp, strip trailing zeros
 *  < 0.001  → 8 dp, strip trailing zeros
 */
export const fmtRate = (n: any): string => {
  const val = Number(n);
  if (!isFinite(val) || isNaN(val) || val >= SANE_MAX) return "N/A";
  if (val === 0) return "0";
  return stripZeros(val.toFixed(6));
};

/**
 * Token Manager price — up to 8 dp, strip trailing zeros.
 *  ≥ $1,000  → integer
 *  < $1,000  → up to 8 dp, strip trailing zeros
 */
export const fmtTokenPrice = (n: any): string => {
  const val = Number(n);
  if (!isFinite(val) || isNaN(val) || val >= SANE_MAX) return "N/A";
  if (val === 0) return "0.0000";
  return val.toFixed(4);
};

/** Abbreviated token quantity for compact spaces (K / M). */
export const fmtNum = (n: any, d = 4): string => {
  const val = Number(n);
  if (isNaN(val) || !isFinite(val) || val >= SANE_MAX) return "N/A";
  if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
  return stripZeros(val.toFixed(d));
};

/** Fixed decimal places — kept for detailed position tables. */
export const fmtFull = (n: any, d = 4): string => {
  const val = Number(n);
  if (isNaN(val) || !isFinite(val) || val >= SANE_MAX) return "N/A";
  return stripZeros(new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  }).format(val));
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
