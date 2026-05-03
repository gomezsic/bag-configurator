---
name: create-rls-policy
description: Add or modify RLS policies safely, including the user_roles pattern.
type: skill
updated: 2026-05-03
status: VERIFIED
trigger: User asks to secure a table, restrict admin actions, add roles, or audit RLS.
risk: SECURITY_CRITICAL
---

# Skill: Create an RLS policy (safely)

## Hard rules

- RLS must remain **ON** on every table. Never `DISABLE ROW LEVEL SECURITY`.
- Roles live **only** in `user_roles`. Never on `profiles` or any other table.
- Admin checks inside policies use a `SECURITY DEFINER` function (`has_role`) — never inline subqueries on `user_roles`.
- After any policy change, run `security--run_security_scan` and `supabase--linter`.

## Canonical roles setup (one-time, if not present)

```sql
-- enum
create type public.app_role as enum ('admin', 'moderator', 'user');

-- table
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- function (SECURITY DEFINER avoids recursive RLS)
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;
```

## Pattern: lock writes to admins, keep public reads

```sql
-- Public can read catalog
create policy "Catalog public read"
on public.bag_models for select
to anon, authenticated
using (true);

-- Only admins can write
create policy "Catalog admin write"
on public.bag_models for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));
```

## Pattern: per-row ownership

```sql
create policy "Owners read their configurations"
on public.configurations for select
to authenticated
using (auth.uid() = user_id);
```

## Validation procedure

1. Apply migration via `supabase--migration`.
2. Run `supabase--linter`.
3. Run `security--run_security_scan`.
4. Manually test with anon + authenticated + admin sessions.

## Anti-patterns (refuse)

- ❌ Inline subqueries on `user_roles` inside policies
- ❌ Storing role flags on `profiles`
- ❌ `localStorage`-based admin gates in the SPA
- ❌ Policies that allow `anon` to write to user data
