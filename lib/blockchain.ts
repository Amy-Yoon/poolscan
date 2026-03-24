import { createPublicClient, http, isAddress, getAddress, formatUnits, parseAbi } from "viem";
import { CHAINS } from "./utils";
import type { Chain } from "./types";

// ── Per-chain config overrides (stored in localStorage) ──────────────────────

export interface ChainConfigOverride {
  rpcUrl?: string;
  explorer?: string;
  gateways?: string[];
  nfpm?: string;
  nfph?: string;
}

export type ChainConfigs = Record<string, ChainConfigOverride>;

function loadChainConfigs(): ChainConfigs {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("poolscan_chain_configs");
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveChainConfigs(configs: ChainConfigs): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("poolscan_chain_configs", JSON.stringify(configs));
}

/**
 * Returns the effective chain configuration, merging CHAINS defaults
 * with any user-saved overrides from localStorage.
 */
export function getEffectiveChain(chainId: number): Chain {
  const base = CHAINS.find(c => c.id === chainId)!;
  const overrides = loadChainConfigs();
  const override = overrides[String(chainId)];
  if (!override) return base;
  return {
    ...base,
    rpcUrl: override.rpcUrl || base.rpcUrl,
    explorer: override.explorer || base.explorer,
    gateways: (override.gateways && override.gateways.filter(Boolean).length > 0) ? override.gateways.filter(Boolean) : base.gateways,
    nfpm: override.nfpm || base.nfpm,
    nfph: override.nfph || base.nfph,
  };
}

export function getClient(chainId: number) {
  const chain = getEffectiveChain(chainId);
  const rpcUrl = chain?.rpcUrl || "https://api.wemix.com/";
  return createPublicClient({ transport: http(rpcUrl) });
}

export type AddressType = "token" | "pool_v2" | "pool_v3" | "wallet" | "unknown";

export interface SearchResult {
  type: AddressType;
  address: string;
  chainId: number;
  data: any;
}

const ERC20_ABI = [
  { name: "name", type: "function", inputs: [], outputs: [{ type: "string" }] },
  { name: "symbol", type: "function", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "balanceOf", type: "function", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const WEMIX_GATEWAY_ABI = [
  {
    name: "getSinglePoolInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "pool", type: "address" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "name", type: "string" }, { name: "token0", type: "address" }, { name: "token1", type: "address" },
        { name: "pool", type: "address" }, { name: "fee", type: "uint24" }, { name: "poolId", type: "uint80" },
        { name: "currentTick", type: "int24" }, { name: "currentPrice", type: "uint160" }, { name: "token0Price", type: "uint256" },
        { name: "token1Price", type: "uint256" }, { name: "token0Amt", type: "uint256" }, { name: "token1Amt", type: "uint256" },
        { name: "totalDepositValue", type: "uint256" }, { name: "userNum", type: "uint256" }
      ]
    }]
  },
  {
    name: "getTokenPrice",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "uint256", name: "price" }]
  }
] as const;

const V3_ABI = [
  { inputs: [], name: "token0", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "token1", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "fee", outputs: [{ type: "uint24" }], stateMutability: "view", type: "function" },
  // Full slot0 output (7 fields) — viem v2 requires full ABI to decode correctly
  { inputs: [], name: "slot0", outputs: [
    { type: "uint160", name: "sqrtPriceX96" },
    { type: "int24", name: "tick" },
    { type: "uint16", name: "observationIndex" },
    { type: "uint16", name: "observationCardinality" },
    { type: "uint16", name: "observationCardinalityNext" },
    { type: "uint8", name: "feeProtocol" },
    { type: "bool", name: "unlocked" },
  ], stateMutability: "view", type: "function" },
  { inputs: [], name: "feeGrowthGlobal0X128", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "feeGrowthGlobal1X128", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "int24", name: "tick" }], name: "ticks", outputs: [
    { type: "uint128", name: "liquidityGross" }, { type: "int128", name: "liquidityNet" },
    { type: "uint256", name: "feeGrowthOutside0X128" }, { type: "uint256", name: "feeGrowthOutside1X128" },
    { type: "int56", name: "tickCumulativeOutside" }, { type: "uint160", name: "secondsPerLiquidityOutsideX128" },
    { type: "uint32", name: "secondsOutside" }, { type: "bool", name: "initialized" }
  ], stateMutability: "view", type: "function" },
] as const;

const V2_ABI = [
  { inputs: [], name: "token0", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "token1", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalSupply", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "getReserves", outputs: [{ type: "uint112", name: "reserve0" }, { type: "uint112", name: "reserve1" }, { type: "uint32", name: "blockTimestampLast" }], stateMutability: "view", type: "function" },
] as const;

export function tickToPrice(sqrtPriceX96: bigint, d0: number = 18, d1: number = 18) {
  const ratio = (Number(sqrtPriceX96) / (2 ** 96)) ** 2;
  return ratio * (10 ** d0 / 10 ** d1);
}

export async function analyzeAddress(address: string, chainId: number): Promise<SearchResult> {
  if (!isAddress(address)) throw new Error("Invalid address format");
  const client = getClient(chainId);
  const chain = getEffectiveChain(chainId);
  const addr = address as `0x${string}`;

  // Step 1: Gateway check for pool (best-effort, fast path)
  if (chain?.gateways) {
    for (const gw of chain.gateways) {
      try {
        const info = await client.readContract({ address: gw as `0x${string}`, abi: WEMIX_GATEWAY_ABI, functionName: "getSinglePoolInfo", args: [addr] }) as any;
        if (info && info.pool !== "0x0000000000000000000000000000000000000000") {
          return { type: "pool_v3", address, chainId, data: { name: info.name || "WESWAP V3", token0: info.token0, token1: info.token1, fee: Number(info.fee)/10000, version: "V3" }};
        }
      } catch {}
    }
  }

  // Step 2: Check if there is bytecode — no code = EOA wallet
  const code = await client.getCode({ address: addr });
  if (!code || code === "0x") return { type: "wallet", address, chainId, data: {} };

  // Step 3: Try direct pool detection via token0/token1 (V3 or V2)
  try {
    const [t0, t1] = await Promise.all([
      client.readContract({ address: addr, abi: V3_ABI, functionName: "token0" }),
      client.readContract({ address: addr, abi: V3_ABI, functionName: "token1" }),
    ]) as [string, string];

    // Looks like a pool — distinguish V3 vs V2 by trying fee()
    let version: "V3" | "V2" = "V2";
    let fee = 0.25;
    try {
      const feeRaw = await client.readContract({ address: addr, abi: V3_ABI, functionName: "fee" });
      fee = Number(feeRaw) / 10000;
      version = "V3";
    } catch {
      // No fee() → V2 pool
      try {
        const res = await client.readContract({ address: addr, abi: V2_ABI, functionName: "getReserves" });
        void res; // confirms it's a V2 pool
      } catch { /* best guess V2 anyway */ }
    }

    // Fetch token symbols for display
    const [sym0, sym1] = await Promise.allSettled([
      client.readContract({ address: t0 as `0x${string}`, abi: ERC20_ABI, functionName: "symbol" }),
      client.readContract({ address: t1 as `0x${string}`, abi: ERC20_ABI, functionName: "symbol" }),
    ]).then(r => r.map(x => x.status === "fulfilled" ? x.value as string : "?"));

    const poolType: AddressType = version === "V3" ? "pool_v3" : "pool_v2";
    return {
      type: poolType,
      address,
      chainId,
      data: { name: `${sym0}/${sym1}`, token0: t0, token1: t1, fee, version },
    };
  } catch {}

  // Step 4: Try ERC20 token
  try {
    const [name, symbol, decimals] = await Promise.all([
      client.readContract({ address: addr, abi: ERC20_ABI, functionName: "name" }),
      client.readContract({ address: addr, abi: ERC20_ABI, functionName: "symbol" }),
      client.readContract({ address: addr, abi: ERC20_ABI, functionName: "decimals" }),
    ]);
    return { type: "token", address, chainId, data: { name, symbol, decimals }};
  } catch {}

  return { type: "unknown", address, chainId, data: {} };
}

export async function getPoolData(address: string, chainId: number, _type: string = "v3") {
  const client = getClient(chainId);
  const chain = getEffectiveChain(chainId);
  const addr = getAddress(address) as `0x${string}`;

  // Step 1: Get token addresses (required)
  let t0: string, t1: string;
  try {
    [t0, t1] = await Promise.all([
      client.readContract({ address: addr, abi: V3_ABI, functionName: "token0" }),
      client.readContract({ address: addr, abi: V3_ABI, functionName: "token1" }),
    ]) as [string, string];
  } catch (e: any) {
    throw new Error(e.message || "Not a valid pool address");
  }

  // Step 2: ERC20 metadata + balances
  const [sym0, sym1, dec0, dec1, bal0, bal1] = await Promise.all([
    client.readContract({ address: t0 as `0x${string}`, abi: ERC20_ABI, functionName: "symbol" }).catch(() => "?"),
    client.readContract({ address: t1 as `0x${string}`, abi: ERC20_ABI, functionName: "symbol" }).catch(() => "?"),
    client.readContract({ address: t0 as `0x${string}`, abi: ERC20_ABI, functionName: "decimals" }).catch(() => 18),
    client.readContract({ address: t1 as `0x${string}`, abi: ERC20_ABI, functionName: "decimals" }).catch(() => 18),
    client.readContract({ address: t0 as `0x${string}`, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] }).catch(() => BigInt(0)),
    client.readContract({ address: t1 as `0x${string}`, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] }).catch(() => BigInt(0)),
  ]);

  // Step 3: fee + price
  let fee = 0;
  let price = 0;
  let tick = 0;
  let poolType: "v3" | "v2" = "v3";

  try {
    const [feeRaw, slot0Raw] = await Promise.all([
      client.readContract({ address: addr, abi: V3_ABI, functionName: "fee" }),
      client.readContract({ address: addr, abi: V3_ABI, functionName: "slot0" }),
    ]);
    fee = Number(feeRaw) / 10000;
    const s0 = slot0Raw as any;
    const sqrtPriceX96: bigint = s0?.sqrtPriceX96 ?? s0?.[0] ?? BigInt(0);
    tick = s0?.tick ?? s0?.[1] ?? 0;
    price = sqrtPriceX96 > BigInt(0) ? tickToPrice(sqrtPriceX96, dec0 as number, dec1 as number) : 0;
  } catch {
    // V2 pool
    try {
      poolType = "v2";
      const res = await client.readContract({ address: addr, abi: V2_ABI, functionName: "getReserves" });
      const r0 = Number(formatUnits((res as any)[0], dec0 as number));
      const r1 = Number(formatUnits((res as any)[1], dec1 as number));
      price = r0 > 0 ? r1 / r0 : 0;
      fee = 0.25;
    } catch { /* no fee/price data */ }
  }

  // Step 4: Try Gateway for TVL (optional)
  let tvl = "0.00";
  let t0Balance = formatUnits(bal0 as bigint, dec0 as number);
  let t1Balance = formatUnits(bal1 as bigint, dec1 as number);
  if (chain?.gateways) {
    for (const gw of chain.gateways) {
      try {
        const info = await client.readContract({ address: gw as `0x${string}`, abi: WEMIX_GATEWAY_ABI, functionName: "getSinglePoolInfo", args: [addr] }) as any;
        if (info?.pool && info.pool !== "0x0000000000000000000000000000000000000000"
            && (BigInt(info.token0Amt ?? 0) > BigInt(0) || BigInt(info.totalDepositValue ?? 0) > BigInt(0))) {
          tvl = formatUnits(info.totalDepositValue, 18);
          t0Balance = formatUnits(info.token0Amt, dec0 as number);
          t1Balance = formatUnits(info.token1Amt, dec1 as number);
          if (info.currentPrice && BigInt(info.currentPrice) > BigInt(0)) {
            price = tickToPrice(BigInt(info.currentPrice), dec0 as number, dec1 as number);
            tick = Number(info.currentTick);
          }
          break;
        }
      } catch { /* skip */ }
    }
  }

  return {
    address: addr, chainId, type: poolType, name: `${sym0}/${sym1}`, fee,
    token0: { address: t0, symbol: sym0, decimals: dec0, balance: t0Balance },
    token1: { address: t1, symbol: sym1, decimals: dec1, balance: t1Balance },
    price, tvl, tick, userNum: "0"
  };
}

async function fetchSinglePoolMeta(addr: string, client: ReturnType<typeof getClient>, chain: Chain | undefined) {
  try {
    // ── Step 1: Get token addresses (always V3-compatible) ──────────────
    let t0: string, t1: string;
    try {
      [t0, t1] = await Promise.all([
        client.readContract({ address: addr as `0x${string}`, abi: V3_ABI, functionName: "token0" }),
        client.readContract({ address: addr as `0x${string}`, abi: V3_ABI, functionName: "token1" }),
      ]) as [string, string];
    } catch (e: any) {
      console.error(`[PoolScan] token0/token1 FAILED ${addr.slice(0,10)}: ${e?.shortMessage || e?.message}`);
      throw e; // Can't proceed without token addresses
    }

    // ── Step 2: Get ERC20 metadata + balances ────────────────────────
    const [sym0, sym1, dec0, dec1, bal0, bal1] = await Promise.all([
      client.readContract({ address: t0 as `0x${string}`, abi: ERC20_ABI, functionName: "symbol" }).catch(() => "?"),
      client.readContract({ address: t1 as `0x${string}`, abi: ERC20_ABI, functionName: "symbol" }).catch(() => "?"),
      client.readContract({ address: t0 as `0x${string}`, abi: ERC20_ABI, functionName: "decimals" }).catch(() => 18),
      client.readContract({ address: t1 as `0x${string}`, abi: ERC20_ABI, functionName: "decimals" }).catch(() => 18),
      client.readContract({ address: t0 as `0x${string}`, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] }).catch(() => BigInt(0)),
      client.readContract({ address: t1 as `0x${string}`, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] }).catch(() => BigInt(0)),
    ]);

    // ── Step 3: Try V3 fee + slot0 (may fail on some pools) ──────────
    let fee = 0;
    let price = 0;
    let poolType: "v3" | "v2" = "v3";

    try {
      const [feeRaw, slot0Raw] = await Promise.all([
        client.readContract({ address: addr as `0x${string}`, abi: V3_ABI, functionName: "fee" }),
        client.readContract({ address: addr as `0x${string}`, abi: V3_ABI, functionName: "slot0" }),
      ]);
      fee = Number(feeRaw) / 10000;
      const slot0 = slot0Raw as any;
      const sqrtPriceX96: bigint = slot0?.sqrtPriceX96 ?? slot0?.[0] ?? BigInt(0);
      price = sqrtPriceX96 > BigInt(0) ? tickToPrice(sqrtPriceX96, dec0 as number, dec1 as number) : 0;
    } catch {
      // If V3 fee/slot0 fail, try V2 reserves for price
      try {
        poolType = "v2";
        const res = await client.readContract({ address: addr as `0x${string}`, abi: V2_ABI, functionName: "getReserves" });
        const r0 = Number(formatUnits((res as any)[0], dec0 as number));
        const r1 = Number(formatUnits((res as any)[1], dec1 as number));
        price = r0 > 0 ? r1 / r0 : 0;
        fee = 0.25;
      } catch {
        // Fallback: use balances for price estimate
        poolType = "v3"; // keep as v3 since token0/token1 exist
      }
    }

    // ── Step 4: Try Gateway for TVL data (optional, best-effort) ──────
    let tvl = 0;
    let t0AmtGw: string | null = null;
    let t1AmtGw: string | null = null;
    if (chain?.gateways) {
      for (const gw of chain.gateways) {
        try {
          const info = await client.readContract({
            address: gw as `0x${string}`,
            abi: WEMIX_GATEWAY_ABI,
            functionName: "getSinglePoolInfo",
            args: [addr as `0x${string}`]
          }) as any;
          if (info?.pool && info.pool !== "0x0000000000000000000000000000000000000000") {
            const hasAmts = BigInt(info.token0Amt ?? 0) > BigInt(0) || BigInt(info.token1Amt ?? 0) > BigInt(0);
            if (hasAmts) {
              tvl = Number(formatUnits(info.totalDepositValue, 18));
              t0AmtGw = formatUnits(info.token0Amt, dec0 as number);
              t1AmtGw = formatUnits(info.token1Amt, dec1 as number);
              if (info.currentPrice && BigInt(info.currentPrice) > BigInt(0)) {
                price = tickToPrice(BigInt(info.currentPrice), dec0 as number, dec1 as number);
              }
              break;
            }
          }
        } catch { /* Gateway not available — skip */ }
      }
    }

    const t0Amt = t0AmtGw ?? formatUnits(bal0 as bigint, dec0 as number);
    const t1Amt = t1AmtGw ?? formatUnits(bal1 as bigint, dec1 as number);

    console.debug(`[PoolScan] ✓ ${addr.slice(0,10)} ${sym0}/${sym1} fee=${fee}% tvl=${tvl}`);
    return {
      address: addr, symbol0: sym0, symbol1: sym1,
      token0: t0, token1: t1,
      fee, isValid: true, type: poolType,
      t0Amt, t1Amt, price, tvl,
    };
  } catch (e: any) {
    console.error(`[PoolScan] FAILED ${addr.slice(0,10)}: ${e?.shortMessage || e?.message}`);
    return { address: addr, symbol0: "Unknown", symbol1: "Unknown", fee: 0, isValid: false, type: "unknown", price: 0, t0Amt: "0", t1Amt: "0", tvl: 0 };
  }
}

export async function fetchPoolsMetadata(addresses: string[], chainId: number) {
  const client = getClient(chainId);
  const chain = getEffectiveChain(chainId);
  const BATCH_SIZE = 8;
  const results: any[] = [];

  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(addr => fetchSinglePoolMeta(addr, client, chain)));
    results.push(...batchResults);
  }
  return results;
}

// ── Gateway-based price fetcher (backup / fallback) ──────────────────────────
export async function fetchTokenPricesFromGateway(addresses: string[], chainId: number) {
  const client = getClient(chainId);
  const chain = getEffectiveChain(chainId);
  if (!chain?.gateways || chain.gateways.length === 0) {
    return addresses.map(addr => ({ address: addr, price: "0" }));
  }

  const isZero = (p: string) => !p || p === "0" || Number(p) === 0;
  const results: string[] = addresses.map(() => "0");

  for (const gw of chain.gateways) {
    const pendingIndices = addresses.map((_, i) => i).filter(i => isZero(results[i]));
    if (pendingIndices.length === 0) break;

    const settled = await Promise.allSettled(
      pendingIndices.map(i =>
        client.readContract({
          address: gw as `0x${string}`,
          abi: WEMIX_GATEWAY_ABI,
          functionName: "getTokenPrice",
          args: [addresses[i] as `0x${string}`],
        })
      )
    );

    settled.forEach((result, j) => {
      const i = pendingIndices[j];
      if (result.status === "fulfilled") {
        const raw = result.value as bigint;
        const price = formatUnits(raw, 18);
        const priceNum = Number(price);
        const isSuspect = raw === BigInt("1000000000000000000");
        if (!isSuspect && !isZero(price) && priceNum > 0) {
          results[i] = price;
        }
      }
    });
  }

  return addresses.map((addr, i) => ({ address: addr, price: results[i] }));
}

// ── Pool-based TVL-weighted price oracle ──────────────────────────────────────

/** Stable token symbols that are pegged to $1.00 */
const STABLE_SYMBOLS = new Set(["WEMIXD", "WEMIX$", "USDC.e", "USDC", "USDT", "DAI"]);

interface PoolRate {
  poolAddr: string;
  token0: string;   // lowercase
  token1: string;   // lowercase
  dec0: number;
  dec1: number;
  sym0: string;
  sym1: string;
  rate: number;     // token1 per token0 (raw price)
  bal0: number;     // token0 balance (human-readable)
  bal1: number;     // token1 balance (human-readable)
  poolType: "v3" | "v2";
}

async function fetchAllPoolRates(
  pools: any[],
  tokenMeta: Record<string, { symbol: string; decimals: number }>,
  chainId: number
): Promise<PoolRate[]> {
  const client = getClient(chainId);
  const rates: PoolRate[] = [];

  await Promise.allSettled(
    pools.map(async (pool) => {
      try {
        const addr = pool.address as `0x${string}`;
        const t0 = pool.token0?.toLowerCase() ?? "";
        const t1 = pool.token1?.toLowerCase() ?? "";
        if (!t0 || !t1) return;

        const meta0 = tokenMeta[t0];
        const meta1 = tokenMeta[t1];
        const dec0 = meta0?.decimals ?? 18;
        const dec1 = meta1?.decimals ?? 18;
        const sym0 = meta0?.symbol ?? "?";
        const sym1 = meta1?.symbol ?? "?";
        const poolType: "v3" | "v2" = pool.type === "v2" ? "v2" : "v3";

        let rate = 0;
        let bal0 = 0;
        let bal1 = 0;

        if (poolType === "v3") {
          const [slot0Raw, b0, b1] = await Promise.all([
            client.readContract({ address: addr, abi: V3_ABI, functionName: "slot0" }).catch(() => null),
            client.readContract({ address: t0 as `0x${string}`, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] }).catch(() => BigInt(0)),
            client.readContract({ address: t1 as `0x${string}`, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] }).catch(() => BigInt(0)),
          ]);
          if (slot0Raw) {
            const s0 = slot0Raw as any;
            const sqrtPriceX96: bigint = s0?.sqrtPriceX96 ?? s0?.[0] ?? BigInt(0);
            if (sqrtPriceX96 > BigInt(0)) {
              rate = tickToPrice(sqrtPriceX96, dec0, dec1);
            }
          }
          bal0 = Number(formatUnits(b0 as bigint, dec0));
          bal1 = Number(formatUnits(b1 as bigint, dec1));
        } else {
          // V2
          const res = await client.readContract({ address: addr, abi: V2_ABI, functionName: "getReserves" }).catch(() => null);
          if (res) {
            const r0 = Number(formatUnits((res as any)[0], dec0));
            const r1 = Number(formatUnits((res as any)[1], dec1));
            rate = r0 > 0 ? r1 / r0 : 0;
            bal0 = r0;
            bal1 = r1;
          }
        }

        if (rate > 0 && (bal0 > 0 || bal1 > 0)) {
          rates.push({ poolAddr: pool.address, token0: t0, token1: t1, dec0, dec1, sym0, sym1, rate, bal0, bal1, poolType });
        }
      } catch {
        // Skip failed pools silently
      }
    })
  );

  return rates;
}

/**
 * Pool-based TVL-weighted token price oracle.
 *
 * Uses already-fetched pool metadata (no extra RPC calls).
 * Pricing priority:
 *   1. Stablecoins (WEMIX$, USDC.e, etc.)  → hardcoded $1.00
 *   2. WEMIX / tWEMIX                       → TVL-weighted avg from WEMIX/stable pools
 *   3. Other tokens                          → TVL-weighted avg from token/stable or token/WEMIX pools
 *   4. No pool found                         → gateway fallback
 *
 * @param poolMetadata  The `metadata` object from AppContext (Record<poolAddr, poolMeta>)
 */
export async function fetchTokenPrices(
  addresses: string[],
  chainId: number,
  registeredPools: any[] = [],
  registeredTokens: any[] = [],
  poolMetadata: Record<string, any> = {}
): Promise<{ address: string; price: string }[]> {
  if (addresses.length === 0) return [];

  // ── Build symbol map from registeredTokens ───────────────────────────────
  const symMap: Record<string, string> = {}; // addr.lower → symbol
  for (const t of registeredTokens) {
    symMap[t.address.toLowerCase()] = t.symbol;
  }
  // Also pull symbols from metadata
  for (const meta of Object.values(poolMetadata) as any[]) {
    if (!meta?.isValid) continue;
    if (meta.token0) symMap[meta.token0.toLowerCase()] = meta.symbol0 ?? symMap[meta.token0.toLowerCase()] ?? "?";
    if (meta.token1) symMap[meta.token1.toLowerCase()] = meta.symbol1 ?? symMap[meta.token1.toLowerCase()] ?? "?";
  }

  const priceMap: Record<string, number> = {};

  // ── Step 1: Stables → $1.00 ──────────────────────────────────────────────
  for (const addr of addresses) {
    const sym = symMap[addr.toLowerCase()];
    if (sym && STABLE_SYMBOLS.has(sym)) {
      priceMap[addr.toLowerCase()] = 1.0;
      console.log(`[priceOracle] ${sym} (${addr.slice(0,8)}) → $1.00 (stable)`);
    }
  }

  // ── Build pool rate list from metadata (no extra RPC) ────────────────────
  interface PoolRate { t0: string; t1: string; rate: number; bal0: number; bal1: number; }
  const poolRates: PoolRate[] = [];

  const chainPools = registeredPools.filter(p => p.chain_id === chainId && p.status === "a");
  console.log(`[priceOracle] chainPools with status=a: ${chainPools.length}`);

  for (const pool of chainPools) {
    const meta = poolMetadata[pool.address.toLowerCase()];
    if (!meta?.isValid) continue;
    const t0 = meta.token0?.toLowerCase();
    const t1 = meta.token1?.toLowerCase();
    if (!t0 || !t1) continue;
    const rate = Number(meta.price); // token1 per token0
    const bal0 = Number(meta.t0Amt);
    const bal1 = Number(meta.t1Amt);
    if (rate > 0 && (bal0 > 0 || bal1 > 0)) {
      poolRates.push({ t0, t1, rate, bal0, bal1 });
      console.log(`[priceOracle] pool ${pool.address.slice(0,10)} ${meta.symbol0}/${meta.symbol1} rate=${rate.toFixed(6)} bal0=${bal0.toFixed(2)} bal1=${bal1.toFixed(2)}`);
    }
  }
  console.log(`[priceOracle] poolRates collected: ${poolRates.length}`);

  const isResolved = (addr: string) => priceMap[addr.toLowerCase()] !== undefined;

  // ── Step 2: WEMIX from WEMIX/stable pools ────────────────────────────────
  const wemixSymbols = new Set(["WEMIX", "tWEMIX", "stWEMIX"]);
  for (const addr of addresses) {
    const sym = symMap[addr.toLowerCase()];
    if (!sym || !wemixSymbols.has(sym) || isResolved(addr)) continue;
    const aL = addr.toLowerCase();
    let num = 0, den = 0;
    for (const pr of poolRates) {
      const isT0 = pr.t0 === aL;
      const isT1 = pr.t1 === aL;
      if (!isT0 && !isT1) continue;
      const baseAddr = isT0 ? pr.t1 : pr.t0;
      if (!isResolved(baseAddr)) continue; // base must be a resolved stable
      const basePrice = priceMap[baseAddr];
      // rate = t1/t0; WEMIX is t0 → WEMIX price = rate * basePrice
      //                WEMIX is t1 → WEMIX price = (1/rate) * basePrice
      const tokenPrice = isT0 ? pr.rate * basePrice : (1 / pr.rate) * basePrice;
      const baseBal = isT0 ? pr.bal1 : pr.bal0;
      const w = baseBal * basePrice;
      if (w > 0 && tokenPrice > 0 && isFinite(tokenPrice)) { num += tokenPrice * w; den += w; }
    }
    if (den > 0) {
      priceMap[aL] = num / den;
      console.log(`[priceOracle] ${sym} → $${priceMap[aL].toFixed(6)} (TVL-weighted)`);
    }
  }

  // ── Step 3: Other tokens from any resolved-base pool ─────────────────────
  // Run up to 3 passes to handle chained pairs (e.g. TOKEN→WEMIX→stable)
  for (let pass = 0; pass < 3; pass++) {
    let resolved = 0;
    for (const addr of addresses) {
      if (isResolved(addr)) continue;
      const aL = addr.toLowerCase();
      let num = 0, den = 0;
      for (const pr of poolRates) {
        const isT0 = pr.t0 === aL;
        const isT1 = pr.t1 === aL;
        if (!isT0 && !isT1) continue;
        const baseAddr = isT0 ? pr.t1 : pr.t0;
        if (!isResolved(baseAddr)) continue;
        const basePrice = priceMap[baseAddr];
        const tokenPrice = isT0 ? pr.rate * basePrice : (1 / pr.rate) * basePrice;
        const baseBal = isT0 ? pr.bal1 : pr.bal0;
        const w = baseBal * basePrice;
        if (w > 0 && tokenPrice > 0 && isFinite(tokenPrice)) { num += tokenPrice * w; den += w; }
      }
      if (den > 0) {
        priceMap[aL] = num / den;
        const sym = symMap[aL] ?? aL.slice(0,8);
        console.log(`[priceOracle] ${sym} → $${priceMap[aL].toFixed(6)} (pass ${pass+1})`);
        resolved++;
      }
    }
    if (resolved === 0) break;
  }

  // ── Step 4: Gateway fallback ─────────────────────────────────────────────
  const stillMissing = addresses.filter(a => !isResolved(a));
  if (stillMissing.length > 0) {
    console.log(`[priceOracle] ${stillMissing.length} tokens → gateway fallback`);
    const gwPrices = await fetchTokenPricesFromGateway(stillMissing, chainId);
    for (const { address, price } of gwPrices) {
      if (price && Number(price) > 0) priceMap[address.toLowerCase()] = Number(price);
    }
  }

  return addresses.map(addr => ({
    address: addr,
    price: priceMap[addr.toLowerCase()] !== undefined ? String(priceMap[addr.toLowerCase()]) : "0",
  }));
}

export async function getWalletData(address: string, chainId: number) {
  const client = getClient(chainId);
  const nativeBalance = await client.getBalance({ address: address as `0x${string}` });
  return { address, chainId, nativeBalance: Number(nativeBalance) / 1e18, tokenBalances: [] };
}

const NFPM_ABI = parseAbi([
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
  "function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
  "function factory() external view returns (address)"
]);

const V3_FACTORY_ABI = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
]);

import { DBPool, ChainId } from "./types";
import { getChain } from "./utils";

// ── V3 위치 수량 계산 헬퍼 ────────────────────────────────────

/** tick → sqrt(1.0001^tick) as float */
function tickToSqrtRatio(tick: number): number {
  return Math.pow(1.0001, tick / 2);
}

/** sqrtPriceX96 (Q64.96) → float */
function sqrtPriceX96ToFloat(sqrtPriceX96: bigint): number {
  return Number(sqrtPriceX96) / (2 ** 96);
}

/** liquidity + sqrtPrice → token0/token1 실수 수량 (단위: 실제 토큰, 소수점 반영) */
function calcV3Amounts(
  liquidity: bigint,
  sqrtRatioCurrent: number,
  sqrtRatioLower: number,
  sqrtRatioUpper: number,
  dec0: number,
  dec1: number
): { amount0: number; amount1: number } {
  const L = Number(liquidity);
  if (L === 0) return { amount0: 0, amount1: 0 };
  const sqrtC = Math.max(sqrtRatioLower, Math.min(sqrtRatioCurrent, sqrtRatioUpper));
  const amount0Raw = sqrtRatioUpper > sqrtC
    ? L * (sqrtRatioUpper - sqrtC) / (sqrtC * sqrtRatioUpper)
    : 0;
  const amount1Raw = sqrtC > sqrtRatioLower
    ? L * (sqrtC - sqrtRatioLower)
    : 0;
  return {
    amount0: amount0Raw / Math.pow(10, dec0),
    amount1: amount1Raw / Math.pow(10, dec1),
  };
}

/**
 * PositionValue.fees 동일 알고리즘 (WeswapV3Gateway.sol 참고)
 * tokensOwed(NFPM 스냅샷) + feeGrowthInside 델타 = 실제 미수령 수수료
 */
function calcUncollectedFees(params: {
  liquidity: bigint;
  feeGrowthGlobal0: bigint; feeGrowthGlobal1: bigint;
  lowerOuter0: bigint; lowerOuter1: bigint;
  upperOuter0: bigint; upperOuter1: bigint;
  feeGrowthInside0Last: bigint; feeGrowthInside1Last: bigint;
  tokensOwed0: bigint; tokensOwed1: bigint;
  currentTick: number; tickLower: number; tickUpper: number;
  dec0: number; dec1: number;
}): { fees0: number; fees1: number } {
  const Q128 = BigInt(2) ** BigInt(128);
  const OVERFLOW = BigInt(2) ** BigInt(256); // uint256 underflow wrap
  const u = (v: bigint) => ((v % OVERFLOW) + OVERFLOW) % OVERFLOW; // safe uint256

  const { liquidity, feeGrowthGlobal0, feeGrowthGlobal1,
    lowerOuter0, lowerOuter1, upperOuter0, upperOuter1,
    feeGrowthInside0Last, feeGrowthInside1Last,
    tokensOwed0, tokensOwed1,
    currentTick, tickLower, tickUpper, dec0, dec1 } = params;

  let fg0: bigint, fg1: bigint;
  if (currentTick < tickLower) {
    fg0 = u(lowerOuter0 - upperOuter0);
    fg1 = u(lowerOuter1 - upperOuter1);
  } else if (currentTick < tickUpper) {
    fg0 = u(feeGrowthGlobal0 - lowerOuter0 - upperOuter0);
    fg1 = u(feeGrowthGlobal1 - lowerOuter1 - upperOuter1);
  } else {
    fg0 = u(upperOuter0 - lowerOuter0);
    fg1 = u(upperOuter1 - lowerOuter1);
  }

  const accrued0 = (liquidity * u(fg0 - feeGrowthInside0Last)) / Q128;
  const accrued1 = (liquidity * u(fg1 - feeGrowthInside1Last)) / Q128;

  return {
    fees0: Number(formatUnits(tokensOwed0 + accrued0, dec0)),
    fees1: Number(formatUnits(tokensOwed1 + accrued1, dec1)),
  };
}

export async function getWalletLPPositions(walletAddress: string, chainId: ChainId, pools: DBPool[]) {
  const chain = getChain(chainId);
  const client = getClient(chainId);
  const user = walletAddress as `0x${string}`;

  // 1. Scan V2 Positions
  // Build deduplicated address list: DB-registered V2 pools + all known pool addresses
  const v2v3Positions: { v2: any[], v3: any[] } = { v2: [], v3: [] };

  const dbV2Pools = pools.filter(p => p.type === "v2" && p.chain_id === chainId);
  const knownAddrs = (chain.knownPoolAddresses || []).map(p => p.address.toLowerCase());
  const dbV2Addrs = new Set(dbV2Pools.map(p => p.address.toLowerCase()));

  // Build scan list: db V2 pools + known pool addresses not already in db V2
  // (known pool addresses include both V2 and V3, we'll detect by trying token0/token1 + getReserves)
  const knownOnlyAddrs = (chain.knownPoolAddresses || [])
    .filter(p => !dbV2Addrs.has(p.address.toLowerCase()))
    .map(p => p.address);

  const allScanAddrs = [
    ...dbV2Pools.map(p => p.address),
    ...knownOnlyAddrs,
  ];

  if (allScanAddrs.length > 0) {
    const balanceAbi = parseAbi(["function balanceOf(address) view returns (uint256)"]);
    const v2TokenAbi = parseAbi([
      "function token0() view returns (address)",
      "function token1() view returns (address)",
    ]);

    // Step 1: check balanceOf for all candidate addresses
    const balanceResults = await Promise.allSettled(
      allScanAddrs.map(addr =>
        client.readContract({
          address: addr as `0x${string}`,
          abi: balanceAbi,
          functionName: "balanceOf",
          args: [user],
        })
      )
    );

    // Step 2: for those with balance > 0, enrich with full on-chain data
    await Promise.allSettled(
      balanceResults.map(async (result, i) => {
        if (result.status !== "fulfilled") return;
        const balance = result.value as bigint;
        if (!balance || balance === BigInt(0)) return;

        const poolAddr = allScanAddrs[i];
        const poolAddrHex = poolAddr as `0x${string}`;
        const dbPool = pools.find(p => p.address.toLowerCase() === poolAddr.toLowerCase());

        try {
          // Step 2a: get token0/token1 addresses (DB or on-chain)
          let t0Addr: string;
          let t1Addr: string;
          if (dbPool?.token0 && dbPool?.token1) {
            t0Addr = dbPool.token0;
            t1Addr = dbPool.token1;
          } else {
            [t0Addr, t1Addr] = await Promise.all([
              client.readContract({ address: poolAddrHex, abi: v2TokenAbi, functionName: "token0" }),
              client.readContract({ address: poolAddrHex, abi: v2TokenAbi, functionName: "token1" }),
            ]) as [string, string];
          }

          // Step 2b: fetch everything in parallel
          const [sym0Res, sym1Res, dec0Res, dec1Res, reservesRes, totalSupplyRes] = await Promise.allSettled([
            client.readContract({ address: t0Addr as `0x${string}`, abi: ERC20_ABI, functionName: "symbol" }),
            client.readContract({ address: t1Addr as `0x${string}`, abi: ERC20_ABI, functionName: "symbol" }),
            client.readContract({ address: t0Addr as `0x${string}`, abi: ERC20_ABI, functionName: "decimals" }),
            client.readContract({ address: t1Addr as `0x${string}`, abi: ERC20_ABI, functionName: "decimals" }),
            client.readContract({ address: poolAddrHex, abi: V2_ABI, functionName: "getReserves" }),
            client.readContract({ address: poolAddrHex, abi: V2_ABI, functionName: "totalSupply" }),
          ]);

          const sym0 = sym0Res.status === "fulfilled" ? sym0Res.value as string : "?";
          const sym1 = sym1Res.status === "fulfilled" ? sym1Res.value as string : "?";
          const dec0 = dec0Res.status === "fulfilled" ? Number(dec0Res.value) : 18;
          const dec1 = dec1Res.status === "fulfilled" ? Number(dec1Res.value) : 18;

          // Step 2c: calculate user's token amounts from LP share
          let amount0: number | null = null;
          let amount1: number | null = null;
          if (reservesRes.status === "fulfilled" && totalSupplyRes.status === "fulfilled") {
            const reserves = reservesRes.value as [bigint, bigint, number];
            const totalSupply = totalSupplyRes.value as bigint;
            if (totalSupply > BigInt(0)) {
              const share = Number(balance) / Number(totalSupply);
              amount0 = (Number(reserves[0]) / Math.pow(10, dec0)) * share;
              amount1 = (Number(reserves[1]) / Math.pow(10, dec1)) * share;
            }
          }

          v2v3Positions.v2.push({
            pool: dbPool || {
              id: `known-${poolAddr}`,
              address: poolAddr,
              chain_id: chainId,
              type: "v2",
              fee: 0.25,
              token0: t0Addr,
              token1: t1Addr,
              label: `${sym0} / ${sym1}`,
              status: (chain.knownPoolAddresses?.find(p => p.address.toLowerCase() === poolAddr.toLowerCase())?.status) || "a",
            },
            balance: balance.toString(),
            formattedBalance: formatUnits(balance, 18),
            tokenSymbols: { sym0, sym1 },
            decimals: { dec0, dec1 },
            amount0,
            amount1,
            token0Addr: t0Addr.toLowerCase(),
            token1Addr: t1Addr.toLowerCase(),
          });
        } catch {
          // Not a V2 pool or failed to read metadata
        }
      })
    );
  }

  // 2. Scan V3 Positions
  if (chain.nfpm) {
    try {
      const balance = await client.readContract({
        address: chain.nfpm as `0x${string}`,
        abi: NFPM_ABI,
        functionName: "balanceOf",
        args: [user]
      }) as bigint;

      if (balance > BigInt(0)) {
        // tokenId 목록 조회
        const tokenIds = await Promise.all(
          Array.from({ length: Number(balance) }).map((_, i) =>
            client.readContract({
              address: chain.nfpm as `0x${string}`,
              abi: NFPM_ABI,
              functionName: "tokenOfOwnerByIndex",
              args: [user, BigInt(i)]
            })
          )
        );

        // 포지션 상세 조회
        const posData = await Promise.all(
          tokenIds.map(id =>
            client.readContract({
              address: chain.nfpm as `0x${string}`,
              abi: NFPM_ABI,
              functionName: "positions",
              args: [id]
            })
          )
        );

        // factory 주소 조회
        let factoryAddr: string | null = null;
        try {
          factoryAddr = await client.readContract({
            address: chain.nfpm as `0x${string}`,
            abi: NFPM_ABI,
            functionName: "factory"
          }) as string;
        } catch {}

        // 고유 토큰/풀 키 수집
        const uniqueTokenSet = new Set<string>();
        const uniquePoolKeys = new Map<string, { token0: string; token1: string; feeRaw: number }>();
        posData.forEach((pos: any) => {
          uniqueTokenSet.add((pos[2] as string).toLowerCase());
          uniqueTokenSet.add((pos[3] as string).toLowerCase());
          const key = `${(pos[2] as string).toLowerCase()}_${(pos[3] as string).toLowerCase()}_${pos[4]}`;
          if (!uniquePoolKeys.has(key)) {
            uniquePoolKeys.set(key, { token0: pos[2] as string, token1: pos[3] as string, feeRaw: pos[4] as number });
          }
        });

        // 토큰 메타데이터 (symbol + decimals) 병렬 조회
        const tokenMeta: Record<string, { symbol: string; decimals: number }> = {};
        await Promise.allSettled(
          Array.from(uniqueTokenSet).map(async (addr) => {
            try {
              const [sym, dec] = await Promise.all([
                client.readContract({ address: addr as `0x${string}`, abi: ERC20_ABI, functionName: "symbol" }),
                client.readContract({ address: addr as `0x${string}`, abi: ERC20_ABI, functionName: "decimals" }),
              ]);
              tokenMeta[addr] = { symbol: sym as string, decimals: dec as number };
            } catch {}
          })
        );

        // 풀 주소 → slot0 + feeGrowthGlobal + 수수료 계산에 필요한 데이터 병렬 조회
        const poolData: Record<string, {
          address: string;
          sqrtPriceX96: bigint; tick: number;
          fg0: bigint; fg1: bigint;
        }> = {};
        if (factoryAddr) {
          await Promise.allSettled(
            Array.from(uniquePoolKeys.entries()).map(async ([key, { token0, token1, feeRaw }]) => {
              try {
                const poolAddr = await client.readContract({
                  address: factoryAddr as `0x${string}`,
                  abi: V3_FACTORY_ABI,
                  functionName: "getPool",
                  args: [token0 as `0x${string}`, token1 as `0x${string}`, feeRaw]
                }) as string;
                if (poolAddr && poolAddr !== "0x0000000000000000000000000000000000000000") {
                  const [s0, fg0, fg1] = await Promise.all([
                    client.readContract({ address: poolAddr as `0x${string}`, abi: V3_ABI, functionName: "slot0" }),
                    client.readContract({ address: poolAddr as `0x${string}`, abi: V3_ABI, functionName: "feeGrowthGlobal0X128" }),
                    client.readContract({ address: poolAddr as `0x${string}`, abi: V3_ABI, functionName: "feeGrowthGlobal1X128" }),
                  ]);
                  const s = s0 as any;
                  poolData[key] = {
                    address: poolAddr,
                    sqrtPriceX96: s[0] as bigint, tick: Number(s[1]),
                    fg0: fg0 as bigint, fg1: fg1 as bigint,
                  };
                }
              } catch {}
            })
          );
        }

        // 풍부한 포지션 데이터 구성 (tick 데이터는 각 포지션별로 별도 조회)
        await Promise.allSettled(
          posData.map(async (pos: any, i) => {
            const t0Addr = (pos[2] as string).toLowerCase();
            const t1Addr = (pos[3] as string).toLowerCase();
            const feeRaw = pos[4] as number;
            const key = `${t0Addr}_${t1Addr}_${feeRaw}`;

            const t0 = tokenMeta[t0Addr] || { symbol: "?", decimals: 18 };
            const t1 = tokenMeta[t1Addr] || { symbol: "?", decimals: 18 };
            const pd = poolData[key];

            const tickLower = Number(pos[5]);
            const tickUpper = Number(pos[6]);
            const liquidity = pos[7] as bigint;
            const feeGrowthInside0Last = pos[8] as bigint;
            const feeGrowthInside1Last = pos[9] as bigint;
            const tokensOwed0 = pos[10] as bigint;
            const tokensOwed1 = pos[11] as bigint;

            // 예치 수량 계산 (V3 수학)
            let amount0 = 0, amount1 = 0, inRange = false, currentTick = 0;
            let currentPrice = 0;
            if (pd) {
              const sqrtC = sqrtPriceX96ToFloat(pd.sqrtPriceX96);
              const sqrtL = tickToSqrtRatio(tickLower);
              const sqrtU = tickToSqrtRatio(tickUpper);
              const res = calcV3Amounts(liquidity, sqrtC, sqrtL, sqrtU, t0.decimals, t1.decimals);
              amount0 = res.amount0;
              amount1 = res.amount1;
              currentTick = pd.tick;
              inRange = currentTick >= tickLower && currentTick < tickUpper;
              // 현재 교환비 (token1/token0, human units)
              currentPrice = sqrtC * sqrtC * Math.pow(10, t0.decimals - t1.decimals);
            }

            // 가격 범위 (inverted: 1 token1 = X token0 으로 표시)
            const decAdj = Math.pow(10, t0.decimals - t1.decimals);
            const rawL = Math.pow(1.0001, tickLower) * decAdj;
            const rawU = Math.pow(1.0001, tickUpper) * decAdj;
            const priceLower = Math.min(rawL > 0 ? 1/rawL : 0, rawU > 0 ? 1/rawU : 0);
            const priceUpper = Math.max(rawL > 0 ? 1/rawL : 0, rawU > 0 ? 1/rawU : 0);

            // ── 정확한 미수령 수수료 계산 (PositionValue.fees 동일 알고리즘) ──
            let fees0 = Number(formatUnits(tokensOwed0, t0.decimals));
            let fees1 = Number(formatUnits(tokensOwed1, t1.decimals));

            if (pd && liquidity > BigInt(0)) {
              try {
                const [lowerTickData, upperTickData] = await Promise.all([
                  client.readContract({ address: pd.address as `0x${string}`, abi: V3_ABI, functionName: "ticks", args: [tickLower] }),
                  client.readContract({ address: pd.address as `0x${string}`, abi: V3_ABI, functionName: "ticks", args: [tickUpper] }),
                ]);
                const lt = lowerTickData as any;
                const ut = upperTickData as any;
                const result = calcUncollectedFees({
                  liquidity, feeGrowthGlobal0: pd.fg0, feeGrowthGlobal1: pd.fg1,
                  lowerOuter0: lt[2] as bigint, lowerOuter1: lt[3] as bigint,
                  upperOuter0: ut[2] as bigint, upperOuter1: ut[3] as bigint,
                  feeGrowthInside0Last, feeGrowthInside1Last,
                  tokensOwed0, tokensOwed1,
                  currentTick, tickLower, tickUpper, dec0: t0.decimals, dec1: t1.decimals,
                });
                fees0 = result.fees0;
                fees1 = result.fees1;
              } catch {}
            }

            v2v3Positions.v3.push({
              tokenId: tokenIds[i].toString(),
              token0: { address: pos[2] as string, symbol: t0.symbol, decimals: t0.decimals },
              token1: { address: pos[3] as string, symbol: t1.symbol, decimals: t1.decimals },
              fee: feeRaw / 10000,
              tickLower, tickUpper,
              liquidity: liquidity.toString(),
              priceLower, priceUpper,
              currentPrice,
              amount0, amount1,
              fees0, fees1,
              inRange, currentTick,
              poolAddress: pd?.address || null,
            });
          })
        );
      }
    } catch (e) {
      console.error("V3 position scan failed", e);
    }
  }

  return v2v3Positions;
}
