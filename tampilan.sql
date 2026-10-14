-- BAITUNA - tampilan.sql (v71): Editor Tampilan Aplikasi, khusus Super Admin.
-- Mengatur: foto latar splash, ikon Akses Cepat tiap fitur, font aplikasi, dan gambar banner/kartu beranda (v73).
-- Jalankan SETELAH daftar_audit.sql. Aman dijalankan ulang.
--  * Tabel app_branding: boleh DIBACA siapa saja (splash tampil sebelum login); TIDAK bisa ditulis langsung.
--  * Penulisan hanya lewat fungsi branding_set / branding_reset yang mengecek Super Admin dan mencatat jejak audit.
--  * Bucket PUBLIK "branding": hanya Super Admin yang boleh mengunggah/menghapus. Batas: 2 MB, tipe dibatasi.

create table if not exists public.app_branding (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.app_branding drop constraint if exists app_branding_key_check;
alter table public.app_branding add constraint app_branding_key_check check (key in ('splash_bg', 'font', 'icons', 'arts'));
alter table public.app_branding enable row level security;
revoke all on public.app_branding from anon, authenticated;
grant select on public.app_branding to anon, authenticated;
drop policy if exists app_branding_read on public.app_branding;
create policy app_branding_read on public.app_branding for select to anon, authenticated using (true);

-- Nama berkas di bucket: huruf/angka/titik/strip/garis bawah saja, 1-80 karakter, tanpa folder.
create or replace function public.branding_path_ok(p text) returns boolean language sql immutable set search_path = '' as $$
  select p is not null and p ~ '^[A-Za-z0-9._-]{1,80}$' and p !~ '\.\.';
$$;

create or replace function public.branding_set(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare k text; v jsonb; n int := 0;
begin
  if not public.is_super_admin() then raise exception 'hanya Super Admin' using errcode = '42501'; end if;
  if p_key not in ('splash_bg', 'font', 'icons', 'arts') then raise exception 'jenis tidak dikenal' using errcode = '22023'; end if;
  if p_value is null or jsonb_typeof(p_value) <> 'object' then raise exception 'isi tidak valid' using errcode = '22023'; end if;
  if p_key = 'splash_bg' then
    if not public.branding_path_ok(p_value->>'path') then raise exception 'berkas tidak valid' using errcode = '22023'; end if;
    p_value := jsonb_build_object('path', p_value->>'path');
  elsif p_key = 'font' then
    if not public.branding_path_ok(p_value->>'path') then raise exception 'berkas tidak valid' using errcode = '22023'; end if;
    if coalesce(p_value->>'format', '') not in ('woff2', 'woff', 'truetype', 'opentype') then raise exception 'format font tidak valid' using errcode = '22023'; end if;
    if coalesce(p_value->>'name', '') !~ '^[A-Za-z0-9 ._-]{1,40}$' then raise exception 'nama font tidak valid' using errcode = '22023'; end if;
    p_value := jsonb_build_object('path', p_value->>'path', 'format', p_value->>'format', 'name', p_value->>'name');
  elsif p_key = 'arts' then
    for k, v in select * from jsonb_each(p_value) loop
      n := n + 1;
      if n > 20 then raise exception 'terlalu banyak gambar' using errcode = '22023'; end if;
      if k !~ '^(banner|promo)_[a-z]{2,12}$' then raise exception 'kunci gambar tidak valid' using errcode = '22023'; end if;
      if jsonb_typeof(v) <> 'string' or not public.branding_path_ok(v #>> '{}') then raise exception 'berkas gambar tidak valid' using errcode = '22023'; end if;
    end loop;
  else
    for k, v in select * from jsonb_each(p_value) loop
      n := n + 1;
      if n > 60 then raise exception 'terlalu banyak ikon' using errcode = '22023'; end if;
      if k !~ '^open-[a-z]{2,20}$' then raise exception 'kunci ikon tidak valid' using errcode = '22023'; end if;
      if jsonb_typeof(v) <> 'string' or not public.branding_path_ok(v #>> '{}') then raise exception 'berkas ikon tidak valid' using errcode = '22023'; end if;
    end loop;
  end if;
  insert into public.app_branding (key, value, updated_at, updated_by) values (p_key, p_value, now(), (select auth.uid()))
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;
  perform public.audit_write(null, 'tampilan_changed', jsonb_build_object('item', p_key));
end $$;
revoke all on function public.branding_set(text, jsonb) from public, anon;
grant execute on function public.branding_set(text, jsonb) to authenticated;

create or replace function public.branding_reset(p_key text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'hanya Super Admin' using errcode = '42501'; end if;
  delete from public.app_branding where key = p_key;
  perform public.audit_write(null, 'tampilan_reset', jsonb_build_object('item', p_key));
end $$;
revoke all on function public.branding_reset(text) from public, anon;
grant execute on function public.branding_reset(text) to authenticated;

-- Bucket publik untuk berkas tampilan.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'font/woff2', 'font/woff', 'font/ttf', 'font/otf', 'application/font-woff', 'application/font-woff2', 'application/x-font-ttf', 'application/x-font-opentype', 'application/octet-stream'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'font/woff2', 'font/woff', 'font/ttf', 'font/otf', 'application/font-woff', 'application/font-woff2', 'application/x-font-ttf', 'application/x-font-opentype', 'application/octet-stream'];

drop policy if exists branding_ins on storage.objects;
create policy branding_ins on storage.objects for insert to authenticated with check (bucket_id = 'branding' and (select public.is_super_admin()) and public.branding_path_ok(name));
drop policy if exists branding_upd on storage.objects;
create policy branding_upd on storage.objects for update to authenticated using (bucket_id = 'branding' and (select public.is_super_admin())) with check (bucket_id = 'branding' and (select public.is_super_admin()) and public.branding_path_ok(name));
drop policy if exists branding_del on storage.objects;
create policy branding_del on storage.objects for delete to authenticated using (bucket_id = 'branding' and (select public.is_super_admin()));
drop policy if exists branding_sel on storage.objects;
create policy branding_sel on storage.objects for select to anon, authenticated using (bucket_id = 'branding');
