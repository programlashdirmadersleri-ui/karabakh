-- Supabase > SQL Editor-a yapışdırıb "Run" edin

create table if not exists sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references sections(id) on delete cascade,
  type text not null check (type in ('image','video')),
  url text not null,
  path text not null,
  name text,
  visible boolean not null default false,
  created_at timestamptz default now()
);

alter table sections enable row level security;
alter table items enable row level security;

create policy "sections all" on sections for all using (true) with check (true);
create policy "items all" on items for all using (true) with check (true);

-- Şəkil/video üçün ictimai qovluq (bucket)
insert into storage.buckets (id, name, public) values ('media', 'media', true)
on conflict (id) do nothing;

create policy "media read" on storage.objects for select using (bucket_id = 'media');
create policy "media insert" on storage.objects for insert with check (bucket_id = 'media');
create policy "media delete" on storage.objects for delete using (bucket_id = 'media');

-- Canlı yenilənmə (admin işarələyən kimi user-də dəyişsin)
alter publication supabase_realtime add table sections, items;

-- Başlanğıc bölmələr
insert into sections (name) values ('Xankəndi'), ('Əsgəran'), ('Xocalı');
