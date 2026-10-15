-- ============================================================
-- BAITUNA - mosque_register.sql (v91)
-- Admin Masjid (yang masjidnya sudah aktif) boleh mendaftarkan masjid baru lewat aplikasi.
-- Masjid baru berstatus "pending" sampai Super Admin memverifikasi. Pendaftar otomatis menjadi
-- Admin Masjid untuk masjid itu. Super Admin tidak lagi menambah masjid lewat aplikasi.
-- Batas: maksimal 3 masjid menunggu verifikasi per pendaftar; nama + kota yang sama tidak boleh ganda.
-- Jalankan SETELAH schema.sql, policies.sql, tahap3.sql. Aman dijalankan ulang.
-- ============================================================
create or replace function public.mosque_register(p_name text, p_city text, p_province text, p_phone text, p_address text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  n text := btrim(coalesce(p_name, ''));
  c text := nullif(btrim(coalesce(p_city, '')), '');
  pr text := nullif(btrim(coalesce(p_province, '')), '');
  ph text := nullif(btrim(coalesce(p_phone, '')), '');
  ad text := nullif(btrim(coalesce(p_address, '')), '');
  mid uuid;
begin
  if uid is null then raise exception 'masuk dulu' using errcode = '42501'; end if;
  if not exists (select 1 from public.mosque_members mm join public.mosques m on m.id = mm.mosque_id
                 where mm.user_id = uid and mm.role = 'admin_masjid' and mm.status = 'active' and m.status = 'active') then
    raise exception 'hanya Admin Masjid yang boleh mendaftarkan masjid' using errcode = '42501';
  end if;
  if char_length(n) not between 3 and 150 then raise exception 'nama masjid 3 sampai 150 huruf' using errcode = '22023'; end if;
  if c is not null and char_length(c) > 80 then raise exception 'kota maksimal 80 huruf' using errcode = '22023'; end if;
  if pr is not null and char_length(pr) > 80 then raise exception 'provinsi maksimal 80 huruf' using errcode = '22023'; end if;
  if ph is not null and char_length(ph) > 30 then raise exception 'telepon maksimal 30 huruf' using errcode = '22023'; end if;
  if ad is not null and char_length(ad) > 300 then raise exception 'alamat maksimal 300 huruf' using errcode = '22023'; end if;
  if (select count(*) from public.mosques where created_by = uid and status = 'pending') >= 3 then
    raise exception 'masih ada 3 masjid menunggu verifikasi' using errcode = '22023';
  end if;
  if exists (select 1 from public.mosques where lower(name) = lower(n) and lower(coalesce(city, '')) = lower(coalesce(c, '')) and status in ('pending', 'active')) then
    raise exception 'masjid dengan nama dan kota ini sudah terdaftar' using errcode = '22023';
  end if;
  insert into public.mosques (name, city, province, contact_phone, address, status, created_by)
  values (n, c, pr, ph, ad, 'pending', uid) returning id into mid;
  insert into public.mosque_members (mosque_id, user_id, role, status) values (mid, uid, 'admin_masjid', 'active');
  return mid;
end $$;
revoke all on function public.mosque_register(text, text, text, text, text) from public, anon;
grant execute on function public.mosque_register(text, text, text, text, text) to authenticated;
