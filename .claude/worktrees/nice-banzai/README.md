# PoolScan — DeFi Explorer

> Real-time Uniswap V2/V3 pool and wallet liquidity analytics

## Stack

| Layer      | Tech                              |
|------------|-----------------------------------|
| Framework  | Next.js 14 (App Router)           |
| Styling    | Tailwind CSS                      |
| Database   | Supabase (PostgreSQL)             |
| On-chain   | Wagmi v2 + Viem                   |
| Deploy     | Vercel                            |

---

## 1. 로컬 세팅

```bash
# 1) 레포 클론 후 의존성 설치
git clone https://github.com/YOUR_USERNAME/poolscan.git
cd poolscan
npm install

# 2) 환경 변수 설정
cp .env.local.example .env.local
# .env.local 파일에 Supabase URL/Key, RPC URL 입력

# 3) 개발 서버 실행
npm run dev
# → http://localhost:3000
```

---

## 2. Supabase 세팅

1. [supabase.com](https://supabase.com) 에서 프로젝트 생성
2. **SQL Editor → New query** 열기
3. `supabase/schema.sql` 내용 전체 붙여넣기 후 실행
4. **Settings → API** 에서 `URL` 과 `anon key` 복사
5. `.env.local` 에 붙여넣기

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

---

## 3. GitHub + Vercel 배포

```bash
# GitHub 레포 생성 후
git init
git add .
git commit -m "feat: initial PoolScan scaffold"
git remote add origin https://github.com/YOUR_USERNAME/poolscan.git
git push -u origin main
```

그 다음 [vercel.com](https://vercel.com) 에서:

1. **New Project** → GitHub 레포 연결
2. **Environment Variables** 탭에서 `.env.local` 값 동일하게 입력
3. **Deploy** 클릭 → 자동 배포 완료 🎉

---

## 4. 프로젝트 구조

```
poolscan/
├── app/
│   ├── layout.tsx          ← Root layout (sidebar + topbar)
│   ├── page.tsx            ← Dashboard
│   ├── pools/page.tsx      ← Pool Manager
│   ├── wallets/page.tsx    ← Wallet Manager
│   └── tokens/page.tsx     ← Token Registry
├── components/
│   ├── layout/             ← Sidebar, Topbar
│   └── ui/                 ← Badge, TokenAvatar, PriceRangeBar …
├── lib/
│   ├── supabase.ts         ← DB CRUD 함수
│   ├── types.ts            ← TypeScript 타입 정의
│   └── utils.ts            ← 포맷터, 체인 설정, 유틸
├── supabase/
│   └── schema.sql          ← DB 스키마 (Supabase에 실행)
└── .env.local.example      ← 환경변수 템플릿
```

---

## 5. 다음 단계 (로드맵)

- [ ] Wagmi + Viem으로 실제 온체인 데이터 읽기
- [ ] Pool 컨트랙트에서 sqrtPriceX96 / tick / reserve 읽기
- [ ] Wallet NFT 포지션 조회 (Uniswap V3 NonfungiblePositionManager)
- [ ] The Graph 서브그래프 연동 (히스토리 데이터)
- [ ] 체인별 Multicall 배치 최적화
