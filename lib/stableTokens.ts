/**
 * 하드코딩 스테이블 토큰 목록 — 항상 $1.00 고정
 * Token Manager에서 항상 보여야 하는 토큰들.
 * refreshData 시 자동으로 DB에 upsert 됩니다.
 */

export interface StableToken {
  address: string;
  symbol: string;
  chain_id: 1111 | 1112;
  price: "1";
}

export const HARDCODED_STABLE_TOKENS: StableToken[] = [
  // ── Mainnet (1111) ─────────────────────────────────────────
  {
    address: "0x8E81fCc2d4A3bAa0eE9044E0D7E36F59C9BbA9c1",
    symbol: "WEMIX$",
    chain_id: 1111,
    price: "1",
  },
  {
    address: "0x44bB111010DfFfb3695F9a1B66aa879976199e7b",
    symbol: "USDC.e",
    chain_id: 1111,
    price: "1",
  },
  // ── Testnet (1112) ─────────────────────────────────────────
  {
    address: "0xAe81b9fFCde5Ab7673dD4B2f5c648a5579430B17",
    symbol: "WEMIX$",
    chain_id: 1112,
    price: "1",
  },
  {
    address: "0x02F7a788ad41d74ec3Ba4613124b6310E33CC1B5",
    symbol: "USDC.e",
    chain_id: 1112,
    price: "1",
  },
];

/** 현재 chainId 에 해당하는 스테이블 토큰만 반환 */
export function getStableTokens(chainId: number): StableToken[] {
  return HARDCODED_STABLE_TOKENS.filter(t => t.chain_id === chainId);
}

/** 스테이블 토큰 주소 set (소문자) — price oracle 에서 $1.00 판별용 */
export function getStableAddressSet(chainId: number): Set<string> {
  return new Set(
    HARDCODED_STABLE_TOKENS
      .filter(t => t.chain_id === chainId)
      .map(t => t.address.toLowerCase())
  );
}
