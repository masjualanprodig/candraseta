-- ============================================================
-- BAITUNA - beranda_builder.sql (v92)
-- Pembuat Beranda: Super Admin mengatur susunan blok beranda untuk 3 peran
-- (jamaah, admin = Admin Masjid, super = Super Admin). Disimpan di app_branding
-- dengan kunci layout_jamaah / layout_admin / layout_super.
-- Dibaca siapa saja (sama seperti tampilan lain); ditulis HANYA lewat layout_set / layout_reset (Super Admin).
-- Pengaman: beranda super wajib memuat blok "mgmt", beranda admin wajib memuat blok "akses"
-- agar tidak ada yang kehilangan akses menu. Jalankan SETELAH tampilan.sql. Aman dijalankan ulang.
-- ============================================================
alter table public.app_branding drop constraint if exists app_branding_key_check;
alter table public.app_branding add constraint app_branding_key_check
  check (key in ('splash_bg', 'font', 'icons', 'arts', 'layout_jamaah', 'layout_admin', 'layout_super'));

create or replace function public.layout_set(p_role text, p_blocks jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare b jsonb; s jsonb; i jsonb; t text; n int := 0; k int; has_req boolean := false; req text;
begin
  if not public.is_super_admin() then raise exception 'hanya Super Admin' using errcode = '42501'; end if;
  if p_role not in ('jamaah', 'admin', 'super') then raise exception 'peran tidak dikenal' using errcode = '22023'; end if;
  if p_blocks is null or jsonb_typeof(p_blocks) <> 'array' then raise exception 'susunan tidak valid' using errcode = '22023'; end if;
  if length(p_blocks::text) > 30000 then raise exception 'susunan terlalu besar' using errcode = '22023'; end if;
  if jsonb_array_length(p_blocks) < 1 or jsonb_array_length(p_blocks) > 30 then raise exception 'jumlah blok 1 sampai 30' using errcode = '22023'; end if;
  req := case p_role when 'super' then 'mgmt' when 'admin' then 'akses' else null end;
  for b in select * from jsonb_array_elements(p_blocks) loop
    if jsonb_typeof(b) <> 'object' then raise exception 'blok tidak valid' using errcode = '22023'; end if;
    t := b->>'t';
    if t = 'b' then
      if coalesce(b->>'id', '') !~ '^[a-z]{2,12}$' then raise exception 'blok bawaan tidak valid' using errcode = '22023'; end if;
      if b->>'id' = req then has_req := true; end if;
    elsif t = 'banner' then
      if jsonb_typeof(b->'slides') <> 'array' or jsonb_array_length(b->'slides') < 1 or jsonb_array_length(b->'slides') > 6 then raise exception 'banner berisi 1 sampai 6 slide' using errcode = '22023'; end if;
      for s in select * from jsonb_array_elements(b->'slides') loop
        if jsonb_typeof(s) <> 'object' then raise exception 'slide tidak valid' using errcode = '22023'; end if;
        if length(btrim(coalesce(s->>'title', ''))) < 1 or length(s->>'title') > 80 then raise exception 'judul slide 1 sampai 80 huruf' using errcode = '22023'; end if;
        if length(coalesce(s->>'text', '')) > 200 then raise exception 'teks slide maksimal 200 huruf' using errcode = '22023'; end if;
        if length(coalesce(s->>'cta', '')) > 30 then raise exception 'teks tombol maksimal 30 huruf' using errcode = '22023'; end if;
        if coalesce(s->>'link', '') !~ '^[a-z]{0,12}$' then raise exception 'tautan tidak valid' using errcode = '22023'; end if;
        if coalesce(s->>'tone', 'green') not in ('green', 'gold') then raise exception 'warna tidak valid' using errcode = '22023'; end if;
        if s->>'img' is not null and not public.branding_path_ok(s->>'img') then raise exception 'gambar tidak valid' using errcode = '22023'; end if;
      end loop;
    elsif t = 'fitur' then
      if length(coalesce(b->>'title', '')) > 60 then raise exception 'judul maksimal 60 huruf' using errcode = '22023'; end if;
      if jsonb_typeof(b->'items') <> 'array' or jsonb_array_length(b->'items') < 1 or jsonb_array_length(b->'items') > 12 then raise exception 'fitur berisi 1 sampai 12 menu' using errcode = '22023'; end if;
      for i in select * from jsonb_array_elements(b->'items') loop
        if jsonb_typeof(i) <> 'string' or (i #>> '{}') !~ '^[a-z]{2,12}$' then raise exception 'menu tidak valid' using errcode = '22023'; end if;
      end loop;
    elsif t = 'text' then
      if coalesce(b->>'style', '') not in ('h1', 'h2', 'p') then raise exception 'gaya teks tidak valid' using errcode = '22023'; end if;
      if coalesce(b->>'align', 'left') not in ('left', 'center', 'right') then raise exception 'rata teks tidak valid' using errcode = '22023'; end if;
      if length(btrim(coalesce(b->>'text', ''))) < 1 or length(b->>'text') > 600 then raise exception 'teks 1 sampai 600 huruf' using errcode = '22023'; end if;
    else
      raise exception 'jenis blok tidak dikenal' using errcode = '22023';
    end if;
  end loop;
  if req is not null and not has_req then raise exception 'blok wajib "%" tidak boleh dihapus', req using errcode = '22023'; end if;
  insert into public.app_branding (key, value, updated_at, updated_by)
  values ('layout_' || p_role, jsonb_build_object('blocks', p_blocks), now(), (select auth.uid()))
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;
  perform public.audit_write(null, 'tampilan_changed', jsonb_build_object('item', 'layout_' || p_role));
end $$;
revoke all on function public.layout_set(text, jsonb) from public, anon;
grant execute on function public.layout_set(text, jsonb) to authenticated;

create or replace function public.layout_reset(p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'hanya Super Admin' using errcode = '42501'; end if;
  if p_role not in ('jamaah', 'admin', 'super') then raise exception 'peran tidak dikenal' using errcode = '22023'; end if;
  delete from public.app_branding where key = 'layout_' || p_role;
  perform public.audit_write(null, 'tampilan_reset', jsonb_build_object('item', 'layout_' || p_role));
end $$;
revoke all on function public.layout_reset(text) from public, anon;
grant execute on function public.layout_reset(text) to authenticated;
