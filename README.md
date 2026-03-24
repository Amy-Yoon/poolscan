# PoolScan — DeFi Explorer

WEMIX 체인의 Uniswap V2/V3 풀과 지갑 유동성을 실시간으로 모니터링하는 내부 툴입니다.
별도 백엔드나 DB 없이 브라우저 localStorage에 데이터를 저장하며, Vercel에 정적 배포합니다.

---

## Stack

| Layer     | Tech                        |
|-----------|-----------------------------|
| Framework | Next.js 14 (App Router)     |
| Styling   | Tailwind CSS                |
| Storage   | Browser localStorage        |
| On-chain  | Viem v2                     |
| Deploy    | Vercel                      |

---

## 로컬 실행

```bash
git clone https://github.com/YOUR_USERNAME/poolscan.git
cd poolscan
npm install
npm run dev
# → http://localhost:3000
```

환경 변수(`.env.local`)는 선택 사항입니다. 비워두면 내장 기본값(WEMIX 퍼블릭 RPC)이 사용됩니다.
RPC를 커스텀하려면 `.env.local`의 값을 수정하거나, 앱 내 **Settings** 페이지(`/settings`)에서 변경할 수 있습니다.

---

## Vercel 배포

1. GitHub에 push
2. [vercel.com](https://vercel.com) → **New Project** → 레포 연결
3. **Deploy** — 환경 변수 없이 바로 배포 가능

필요 시 Vercel 환경 변수 탭에서 `.env.local`의 값을 동일하게 추가하세요.

---

## 프로젝트 구조

```
poolscan/
├── app/
│   ├── layout.tsx              ← Root layout (Sidebar + Topbar + RefreshBar)
│   ├── page.tsx                ← Dashboard
│   ├── pools/
│   │   ├── page.tsx            ← Pool Manager
│   │   └── [address]/page.tsx  ← Pool Detail
│   ├── wallets/
│   │   ├── page.tsx            ← Wallet Manager
│   │   └── [address]/page.tsx  ← Wallet Detail
│   ├── tokens/page.tsx         ← Token Registry
│   └── settings/page.tsx       ← Chain config (hidden menu, /settings)
├── components/
│   ├── layout/                 ← Sidebar, Topbar, RefreshBar
│   ├── pools/                  ← AddPoolModal
│   ├── search/                 ← SearchModal
│   └── ui/                     ← Badge, TokenAvatar, PriceRangeBar
├── context/
│   └── AppContext.tsx           ← 전역 상태 (체인, 풀/지갑/토큰, 새로고침)
├── lib/
│   ├── db.ts                   ← localStorage CRUD (풀·지갑·토큰·설정)
│   ├── blockchain.ts           ← Viem 온체인 조회 (풀 메타데이터, 토큰 정보)
│   ├── types.ts                ← TypeScript 타입 정의
│   └── utils.ts                ← 포맷터, 체인 설정, 유틸
├── public/
│   └── wemix-default-config.json  ← 기본 풀·토큰 목록 (가져오기 기본 데이터)
└── .env.local                  ← RPC/Explorer/Contract 커스텀 (선택)
```

---

## 데이터 흐름

- **localStorage** 에 풀·지갑·토큰 주소 목록 저장 (`poolscan_pools`, `poolscan_wallets`, `poolscan_tokens`)
- **캐시** (`poolscan-cache-v2-{chainId}`) 에 온체인 메타데이터(TVL, 가격, 유동성 등) 저장
- **새로고침** 버튼 또는 체인 전환 시 온체인에서 최신 데이터 재조회
- **내보내기** : 현재 등록된 풀·지갑·토큰을 JSON 파일로 다운로드
- **가져오기** : JSON 파일 또는 기본 데이터(wemix-default-config.json)로 일괄 등록

---

## 숨겨진 메뉴

- `/settings` — 체인별 RPC URL, Explorer, Gateway, NFPM, NFPH 주소 커스텀
  사이드바에는 노출되지 않으며 URL 직접 접근으로만 진입 가능
