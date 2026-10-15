-- ============================================================
-- BAITUNA - nomor_hp.sql (v94)
-- Nomor HP/WA saat daftar akun (wajib di aplikasi) + masuk memakai email ATAU nomor HP.
--  * profiles.phone_norm = nomor yang dinormalkan (62xxxxxxxxxx) oleh trigger; tidak bisa diisi langsung oleh pengguna.
--  * Satu nomor hanya untuk satu akun (indeks unik, bila data lama tidak ada yang kembar).
--  * handle_new_user menyimpan nomor dari pendaftaran.
--  * phone_available(p_phone): cek nomor sudah dipakai atau belum (boleh dipanggil sebelum login).
--  * login_email_for_phone(p_phone): mengembalikan email akun pemilik nomor, HANYA bila tepat satu akun.
--    Dipakai aplikasi untuk masuk dengan nomor HP + password (tanpa layanan SMS berbayar).
--    Catatan keamanan: fungsi ini memungkinkan orang yang tahu sebuah nomor mengetahui email akunnya.
-- Jalankan SETELAH schema.sql dan policies.sql. Aman dijalankan ulang.
-- ============================================================
create or replace function public.norm_phone(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare d text;
begin
  if p is null then return null; end if;
  d := regexp_replace(p, '[^0-9]', '', 'g');
  if d = '' then return null; end if;
  if left(d, 2) = '62' then null;
  elsif left(d, 1) = '0' then d := '62' || substr(d, 2);
  elsif left(d, 1) = '8' then d := '62' || d;
  end if;
  if length(d) < 9 or length(d) > 15 then return null; end if;
  return d;
end $$;

alter table public.profiles add column if not exists phone_norm text;

create or replace function public.profiles_phone_norm() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.phone_norm := public.norm_phone(new.phone);
  return new;
end $$;
drop trigger if exists profiles_phone_norm_trg on public.profiles;
create trigger profiles_phone_norm_trg before insert or update of phone on public.profiles
  for each row execute function public.profiles_phone_norm();

-- isi untuk data lama
update public.profiles set phone_norm = public.norm_phone(phone) where phone is not null and phone_norm is distinct from public.norm_phone(phone);

-- indeks unik bila tidak ada nomor kembar di data lama; bila ada, pakai indeks biasa (nomor kembar tidak bisa dipakai masuk)
do $$
begin
  drop index if exists public.profiles_phone_norm_uq;
  if exists (select 1 from public.profiles where phone_norm is not null group by phone_norm having count(*) > 1) then
    raise notice 'Ada nomor HP kembar pada data lama: indeks unik tidak dibuat. Nomor kembar tidak dapat dipakai untuk masuk.';
    create index if not exists profiles_phone_norm_ix on public.profiles (phone_norm) where phone_norm is not null;
  else
    drop index if exists public.profiles_phone_norm_ix;
    create unique index profiles_phone_norm_uq on public.profiles (phone_norm) where phone_norm is not null;
  end if;
end $$;

-- profil otomatis saat akun baru; nomor bentrok tidak menggagalkan pendaftaran (aplikasi sudah mengecek lebih dulu)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ph text := left(nullif(btrim(coalesce(new.raw_user_meta_data->>'phone', '')), ''), 30);
begin
  begin
    insert into public.profiles (id, full_name, phone)
    values (new.id, left(nullif(new.raw_user_meta_data->>'full_name', ''), 120), case when public.norm_phone(ph) is null then null else ph end)
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, full_name)
    values (new.id, left(nullif(new.raw_user_meta_data->>'full_name', ''), 120))
    on conflict (id) do nothing;
  end;
  return new;
end $$;

create or replace function public.phone_available(p_phone text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare n text := public.norm_phone(p_phone);
begin
  if n is null then raise exception 'nomor HP tidak valid' using errcode = '22023'; end if;
  return not exists (select 1 from public.profiles where phone_norm = n);
end $$;
revoke all on function public.phone_available(text) from public;
grant execute on function public.phone_available(text) to anon, authenticated;

create or replace function public.login_email_for_phone(p_phone text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare n text := public.norm_phone(p_phone); cnt int; em text;
begin
  if n is null then return null; end if;
  select count(*) into cnt from public.profiles where phone_norm = n;
  if cnt <> 1 then return null; end if;
  select u.email::text into em from public.profiles p join auth.users u on u.id = p.id where p.phone_norm = n;
  return em;
end $$;
revoke all on function public.login_email_for_phone(text) from public;
grant execute on function public.login_email_for_phone(text) to anon, authenticated;
