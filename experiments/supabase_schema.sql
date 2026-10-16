-- Run in Supabase SQL Editor. Enable RLS; never expose service-role key to browser.
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_user_created_idx
  on public.chat_messages(user_id, created_at desc);
alter table public.chat_messages enable row level security;
-- Add policies only when you implement Supabase Auth and use authenticated user JWTs.
-- Service role key is server-only and bypasses RLS; keep it in Cloudflare Worker secrets.
