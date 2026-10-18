-- ============================================================
-- BAITUNA - buku_editor.sql (Pustaka Buku: deskripsi berformat + teks tombol pesan)
-- Jalankan SETELAH buku.sql. Aman dijalankan ulang.
-- 1) Deskripsi boleh berisi format (tebal, miring, garis bawah, daftar). Batas disimpan naik jadi 8000 karakter
--    (batas isi teks 2000 huruf tetap dijaga di aplikasi).
-- 2) Kolom order_label: teks tombol pesan yang bisa diubah Super Admin (kosong = teks bawaan).
-- ============================================================
alter table public.books drop constraint if exists books_description_check;
alter table public.books add constraint books_description_check check (char_length(btrim(description)) between 10 and 8000);

alter table public.books add column if not exists order_label text;
alter table public.books drop constraint if exists books_order_label_check;
alter table public.books add constraint books_order_label_check check (order_label is null or char_length(btrim(order_label)) between 1 and 30);

-- Rapikan label di trigger yang sudah ada (spasi ganda dibuang, kosong -> null).
create or replace function public.books_before()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.title = btrim(regexp_replace(new.title, '\s+', ' ', 'g'));
  new.description = btrim(new.description);
  new.order_label = nullif(btrim(regexp_replace(coalesce(new.order_label, ''), '\s+', ' ', 'g')), '');
  new.updated_at = now();
  if tg_op = 'INSERT' then new.created_by = auth.uid(); new.created_at = now();
  else new.created_by = old.created_by; new.created_at = old.created_at; end if;
  return new;
end $$;
revoke all on function public.books_before() from public, anon, authenticated;

grant select (order_label) on public.books to anon;
