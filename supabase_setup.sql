-- ─────────────────────────────────────────────
-- STEP 1: Create the returns table
-- ─────────────────────────────────────────────
create table if not exists returns (
  id              text primary key,
  status          text not null default 'pending_invoice',
  supplier        text not null,
  bill_photo_url  text,
  products        jsonb not null default '[]',
  notes           text,
  created_by      text not null,
  timeline        jsonb not null default '[]',
  gr_invoice_url  text,
  gr_invoice_at   timestamptz,
  ready_to_pack_at timestamptz,
  dispatch        jsonb,
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- STEP 2: Allow anyone to read/write (no login required)
-- ─────────────────────────────────────────────
alter table returns enable row level security;

create policy "allow all" on returns
  for all using (true) with check (true);

-- ─────────────────────────────────────────────
-- STEP 3: Enable real-time updates
-- ─────────────────────────────────────────────
alter publication supabase_realtime add table returns;
