-- ============================================================
-- PoolScan — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ────────────────────────────────────────────
-- tokens
-- ────────────────────────────────────────────
create table if not exists tokens (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz not null default now(),
  address     text not null,
  chain_id    int  not null,
  symbol      text not null,
  name        text not null default '',
  decimals    int  not null default 18,

  unique (address, chain_id)
);

-- ────────────────────────────────────────────
-- pools
-- ────────────────────────────────────────────
create table if not exists pools (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz not null default now(),
  address     text not null,
  chain_id    int  not null,
  type        text not null check (type in ('v2', 'v3')),
  fee         numeric,                    -- e.g. 0.3
  token0      text not null,             -- contract address
  token1      text not null,             -- contract address
  label       text,                      -- optional custom label

  unique (address, chain_id)
);

-- ────────────────────────────────────────────
-- wallets
-- ────────────────────────────────────────────
create table if not exists wallets (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz not null default now(),
  address     text not null,
  chain_id    int  not null,
  label       text,                      -- e.g. "vitalik.eth"

  unique (address, chain_id)
);

-- ────────────────────────────────────────────
-- Indexes for common queries
-- ────────────────────────────────────────────
create index if not exists idx_pools_chain    on pools   (chain_id);
create index if not exists idx_wallets_chain  on wallets (chain_id);
create index if not exists idx_tokens_chain   on tokens  (chain_id);

-- ────────────────────────────────────────────
-- Row Level Security (RLS)
-- For now: public read/write (no auth)
-- Tighten later when adding auth
-- ────────────────────────────────────────────
alter table tokens  enable row level security;
alter table pools   enable row level security;
alter table wallets enable row level security;

-- Allow all operations for now (anonymous access)
create policy "public_all_tokens"  on tokens  for all using (true) with check (true);
create policy "public_all_pools"   on pools   for all using (true) with check (true);
create policy "public_all_wallets" on wallets for all using (true) with check (true);
