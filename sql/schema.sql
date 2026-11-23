-- Alpha House Real Estate — Supabase / PostgreSQL schema
-- Run this in Supabase SQL Editor (or psql) to create tables, RLS, and storage.

-- ============ PROFILES (admin roles) ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles self read" on public.profiles
  for select using (auth.uid() = id);

create policy "admin read all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, role) values (new.id, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============ AREAS ============
create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null,
  slug text unique,
  created_at timestamptz not null default now()
);
alter table public.areas enable row level security;
create policy "areas public read" on public.areas for select using (true);
create policy "areas admin write" on public.areas for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ============ PROPERTIES ============
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null,
  type text not null check (type in ('residential','commercial')),
  unit_type_ar text not null,
  unit_type_en text not null,
  area_id uuid references public.areas(id) on delete set null,
  area_ar text,
  area_en text,
  size numeric not null default 0,
  price numeric,
  status text not null default 'draft' check (status in ('draft','available','reserved','sold')),
  is_published boolean not null default false,
  is_featured boolean not null default false,
  description_ar text,
  description_en text,
  features_ar jsonb default '[]'::jsonb,
  features_en jsonb default '[]'::jsonb,
  images text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.properties enable row level security;

create policy "properties public read published" on public.properties
  for select using (is_published = true);

create policy "properties admin all" on public.properties
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ============ PROJECTS ============
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null,
  description_ar text,
  description_en text,
  area_ar text,
  area_en text,
  image text,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;
create policy "projects public read published" on public.projects
  for select using (is_published = true);
create policy "projects admin all" on public.projects
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ============ INQUIRIES ============
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  email text,
  message text,
  property_id uuid references public.properties(id) on delete set null,
  type text default 'general',
  status text default 'new' check (status in ('new','contacted','closed')),
  created_at timestamptz not null default now()
);
alter table public.inquiries enable row level security;
create policy "inquiries public insert" on public.inquiries for insert with check (true);
create policy "inquiries admin read" on public.inquiries for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "inquiries admin update" on public.inquiries for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "inquiries admin delete" on public.inquiries for delete using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ============ SITE SETTINGS ============
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
create policy "settings public read" on public.site_settings for select using (true);
create policy "settings admin write" on public.site_settings for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- seed default settings (company info only — no invented properties)
insert into public.site_settings (key, value) values
  ('company', '{"name":"ALPHA HOUSE REAL ESTATE","phone":"01557222799","whatsapp":"https://wa.me/201557222799","area":"مدينة العبور، مصر"}'::jsonb)
on conflict (key) do nothing;

-- ============ STORAGE BUCKET ============
-- Create bucket 'property-images' (public) via Supabase dashboard or:
insert into storage.buckets (id, name, public) values ('property-images','property-images', true)
on conflict (id) do nothing;

create policy "property images public read" on storage.objects
  for select using (bucket_id = 'property-images');

create policy "property images admin write" on storage.objects
  for insert with check (
    bucket_id = 'property-images' and
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "property images admin update" on storage.objects
  for update using (
    bucket_id = 'property-images' and
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "property images admin delete" on storage.objects
  for delete using (
    bucket_id = 'property-images' and
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ============ ADMIN PROMOTION HELPER ============
-- After creating an account via Supabase Auth, promote it:
-- update public.profiles set role = 'admin' where id = '<USER_UUID>';