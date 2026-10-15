-- ============================================================
-- BAITUNA - tanpa_gerbang_jamaah.sql (v91)
-- Fitur "Pendaftaran Jamaah" dihapus. Semua pengguna yang sudah login boleh bertanya di Tanya Jawab.
-- Data lama di tabel jamaah_registrations TIDAK dihapus (arsip). Aman dijalankan ulang.
-- Jalankan SETELAH daftar_audit.sql.
-- ============================================================
create or replace function public.is_approved_jamaah() returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null;
$$;

-- Fungsi antrean pendaftaran tidak lagi bisa dipanggil dari aplikasi.
revoke execute on function public.jamaah_apply(uuid, text) from public, anon, authenticated;
revoke execute on function public.jamaah_my_status() from public, anon, authenticated;
revoke execute on function public.jamaah_queue(text) from public, anon, authenticated;
revoke execute on function public.jamaah_decide(uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.jamaah_pending_count() from public, anon, authenticated;
