import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Chain, ChainId, TokenMap } from "./types";

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
    knownPoolAddresses: [
      { address: "0x00caEc2e118AbC4c510440A8D1ac8565Fec0180C", status: "a" },
      { address: "0x59b51516032241b796de4e495A90030C2d48BD1e", status: "a" },
      { address: "0x1d8f7368F7C9D29EB041fc6e1736D28a11E454D0", status: "a" },
      { address: "0x9fBA0E50C6a0164EDC715Ac9ADFf9272F9eE379e", status: "a" },
      { address: "0x2201439f6c7AC081f6A0c5f3A813B217222c8202", status: "a" },
      { address: "0xDAa1A1eA136aa1966f23CE83B83eb4aC01097C4a", status: "a" },
      { address: "0x459D6B37c9706fBA0Aa4EB327Dc1391CD817e78f", status: "a" },
      { address: "0xBBf81687F4cecf909eB58c836f4A00F9D4CA9e67", status: "a" },
      { address: "0x620628eFeb57f50e3d133f6236b4933Bf40E3458", status: "a" },
      { address: "0xB418dDEBA58145fbE0E8D6c4a574CB62994eedaB", status: "a" },
      { address: "0xB609F53a5eE06110B843954f0742698736DfB1C0", status: "a" },
      { address: "0x610e5B63B4ffB4dbFCA77096678a988F6dAad3E4", status: "a" },
      { address: "0x8A09B18BDff44AcdE3516847D679D4b044cDfb89", status: "a" },
      { address: "0xE694a9E646d690b3098D303175D4BA19B181CF43", status: "a" },
      { address: "0x79219fa3De6E9b29A5dE4e6DACE014564FD46Faf", status: "a" },
      { address: "0x5cdea17A1d541205D70C6e05B317e242CA099cd3", status: "a" },
      { address: "0x0BE222ccD60B1af556aa4EB8CD075Ba9142ae29B", status: "a" },
      { address: "0xd86B2605E9F996D5F425C24b11EE18A72aF26404", status: "a" },
      { address: "0xeCF2971544FF21900E40E3cB9f04097959a5F908", status: "a" },
      { address: "0x74e4999c46925ec096909CF9574b8CD10e3d7990", status: "a" },
      { address: "0xc8423Ee51a2Ef7688EE0505b53EdC83a1d7F13Bd", status: "a" },
      { address: "0xCB268e522e96463a40dB3E8fBF58Cf4Eb5B80810", status: "a" },
      { address: "0x77Dd7AB75b3c44e8c90C169ADf0D42C5cA84fd80", status: "a" },
      { address: "0x257480127dC7D3Afd2464A134316de2CE5397Ad3", status: "a" },
      { address: "0x90d69f92D515A414256f5544442B0622E5688459", status: "a" },
      { address: "0x4f06949b3791a2bcf4726cfc907ae8e9dc89ec80", status: "a" },
      { address: "0x42Cf1Af7Fa9c2b50855A47806706D623De73316b", status: "a" },
      { address: "0x15fb24881c24b5bf05b65fef92ba0eee705d6d51", status: "a" },
      { address: "0x2d2863490e65c0f3272a09c57faadb3c91791bb4", status: "a" },
      { address: "0xe7f02dcca5da4fa342ccaed5551b6c48458dc378", status: "a" },
      { address: "0xa34f8ebbd468b99a7e19fc3dfca840d0602db8c2", status: "a" },
      { address: "0x67c02b9c1ba5c5562cd97cf15129305aed6b1599", status: "a" },
      { address: "0xd1ead3063f170a3621a1f43b8fe4de0115a62f71", status: "a" },
      { address: "0xd214be47aba1032687c40da609d8eac3b5899712", status: "a" },
      { address: "0xf198dfa3eF63Dd6687D2C5f9665c716A9e04E262", status: "a" },
      { address: "0x61b728a0af38e46E9D8bB852350486FfA079436A", status: "a" },
      { address: "0xD785097e20CfAEA6B385EAf83c485b9034753e66", status: "a" },
      { address: "0xcb4937F87A17B9FCA1141C534Ba4fe40531c14Bb", status: "a" },
      { address: "0xD995B0525607C9F79D245C55080D822F93E3542C", status: "a" },
      { address: "0xCC389246F75c561faaBF09746e31B045fb24b361", status: "a" },
      { address: "0xbeDB8781147750300F6780fF86dECde8A589E0Be", status: "a" },
      { address: "0x47936E3738677a0d5849FC75586FAFE409c7FB4C", status: "a" },
      { address: "0x43A55d6BDde2b88C75150bE08f57783a54DCBeB0", status: "a" },
      { address: "0x700043981965B0ea95575EdA98683C365e017acD", status: "a" },
      { address: "0x62e8DEb111a96515b044C2f1093aAF817a7d55EA", status: "a" },
      { address: "0xd55982B517D17A299EA7b3a323044d37efDd3287", status: "a" },
    ],
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
    knownPoolAddresses: [
      { address: "0xe6655CCda10e28e23Eb067C85ec1A8F1A39847Fd", status: "a" },
      { address: "0x35FD50573A3Fe86A0bB135E067545798070F078a", status: "a" },
      { address: "0x66C290EF80a6c8C8b35e0FFbe27F867AA6567958", status: "a" },
      { address: "0x854859952f2c307219d5B53dc2b06b0Af9c8CE3C", status: "a" },
      { address: "0x288333A256E802aa2B97dA36fEA5561d5Ef64A5C", status: "a" },
      { address: "0xEa66f07EEa8d9D835DeDd90C2b177d1FE498bE13", status: "a" },
      { address: "0x96096455342208bE7Cf7a203c47388338Fd01c2B", status: "a" },
      { address: "0x1FbEC1C79B22A5A0b9566d7556D9D0B713300a58", status: "a" },
      { address: "0x111239FeC38707088B9EEe636666250B4B73ea41", status: "a" },
      { address: "0x08A29B19Bc3D6303CBe86008a9fdCbEa2027a55F", status: "a" },
      { address: "0xC56cEa8FAe5B9CF6D61Dc479Dca0eb2A0aDe2Ff9", status: "a" },
      { address: "0x784000E17BD910C165e43A40eF48613ca6A287b4", status: "a" },
      { address: "0x8432913373C8Fa7591D77436cdd73CAeDC031bFe", status: "a" },
      { address: "0x6d1FC3a61F3f5ca1f113a6FAF86fE37A69Bbbc4d", status: "a" },
      { address: "0x5fdbf06C4865EE2fFF30FA58a3778B6233f9fB0CF", status: "a" },
      { address: "0xfb9A8048f39B10B2D35c6f2bd66e2701B14a0e5C", status: "a" },
      { address: "0x0c8526D6d26b0f4d532B19E66A9628C92afc4BC4", status: "a" },
      { address: "0x3A5a104CB7b7764D2E6742B65fc2a7C57cF52382", status: "a" },
      { address: "0x97B76703A2Eb5706f00502F710A02Cd502a0d0e5", status: "a" },
      { address: "0xA3D9Bb0C47046dF4d761Cd4C5f1A0f49d9ad79b8", status: "a" },
      { address: "0x046E12995ad9a46c453FE8958903e6232f89dbc5", status: "a" },
      { address: "0xfFB849f84923A0EF41f84E69e88C8274e430223f", status: "a" },
      { address: "0x41bf7A11645D126698228203453b5116Eda301A9", status: "a" },
      { address: "0xcF199238293EA1D07B386AB16e1be96Fb7EDb421", status: "a" },
      { address: "0xD4cAF22F770a803795331e28bf023adB95054704", status: "a" },
      { address: "0xc2CABbe5cf1422D740bD2BE580e7B26078dFA956", status: "a" },
      { address: "0x8CF2514eB92378a75D5512EDc27271Eba9c60539", status: "a" },
    ],
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
  return stripZeros(val.toFixed(8));
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
  if (!isFinite(val) || isNaN(val)) return "N/A";
  if (val === 0) return "0";
  const abs = Math.abs(val);
  if (abs >= 1000)  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(val));
  if (abs >= 1)     return stripZeros(val.toFixed(4));
  if (abs >= 0.001) return stripZeros(val.toFixed(6));
  return stripZeros(val.toFixed(8));
};

/**
 * Token Manager price — up to 8 dp, strip trailing zeros.
 *  ≥ $1,000  → integer
 *  < $1,000  → up to 8 dp, strip trailing zeros
 */
export const fmtTokenPrice = (n: any): string => {
  const val = Number(n);
  if (!isFinite(val) || isNaN(val)) return "N/A";
  if (val === 0) return "0";
  const abs = Math.abs(val);
  if (abs >= 1000) return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(val));
  return stripZeros(val.toFixed(8));
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
