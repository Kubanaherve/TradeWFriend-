-- Create a centralized transactions table for all financial activity

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_type text not null,
  amount numeric not null,
  date timestamp with time zone not null default now(),
  description text not null,
  related_id text,
  created_by text,
  metadata jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists transactions_transaction_type_idx on transactions (transaction_type);
create index if not exists transactions_date_idx on transactions (date);
