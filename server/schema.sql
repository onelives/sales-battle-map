-- ============================================================
--  Neon Serverless PostgreSQL 建表脚本
--  在 Neon Console → SQL Editor 中一次性执行
--  ON CONFLICT (name, region) 保证重复挖掘幂等，不产生重复线索
-- ============================================================
create table if not exists leads (
  id          bigint generated always as identity primary key,
  name        text not null,
  lat         double precision,
  lng         double precision,
  region      text,
  district    text,
  industry    text,
  status      text default '未联系',
  priority    text default '中',
  footprint   text default '未点亮',
  visits      jsonb default '[]',
  dynamics    text default '',
  source      text default '探迹',
  address     text default '',
  phone       text default '',
  contact     text default '',
  note        text default '',
  created_at  timestamptz default now(),
  unique (name, region)
);

create index if not exists idx_leads_region   on leads (region);
create index if not exists idx_leads_district on leads (district);
create index if not exists idx_leads_industry on leads (industry);

-- 用户表（登录/注册/管理员权限；中转服务启动时也会幂等自建）
create table if not exists users (
  id          bigint generated always as identity primary key,
  username    text not null unique,
  pass_hash   text not null,          -- scrypt 哈希
  salt        text not null,
  role        text default 'user',    -- admin / user
  created_at  timestamptz default now()
);
