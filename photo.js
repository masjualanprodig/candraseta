// BAITUNA - photo.js
// Menyiapkan foto masjid: 1 foto, hasil akhir maksimal 2 MB (JPEG/PNG/WebP).
// Foto diubah ulang lewat kanvas: ukuran diperkecil (sisi terpanjang 1600 px), orientasi dirapikan,
// dan data tersembunyi (EXIF, termasuk lokasi GPS kamera) otomatis terbuang.
export const MAX_BYTES = 2 * 1024 * 1024;   // batas yang juga dipasang di Storage
export const MAX_INPUT = 25 * 1024 * 1024;  // berkas asli yang terlalu besar langsung ditolak
const MAX_SIDE = 1600;

export const PHOTO_ERRORS = {
  type: 'Format foto harus JPEG, PNG, atau WebP.',
  big: 'Berkas terlalu besar (maksimal 25 MB sebelum diperkecil).',
  decode: 'Foto tidak bisa dibaca. Coba foto lain.',
  size: 'Foto tetap lebih dari 2 MB setelah diperkecil. Coba foto lain.'
};

export async function prepareImage(file) {
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) throw { code: 'type' };
  if (file.size > MAX_INPUT) throw { code: 'big' };
  let bmp;
  try { bmp = await createImageBitmap(file); } catch (e) { throw { code: 'decode' }; }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); // PNG transparan -> latar putih
  ctx.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  for (const q of [0.85, 0.75, 0.65, 0.5, 0.4]) {
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', q));
    if (blob && blob.size <= MAX_BYTES) return { blob, width: w, height: h, originalSize: file.size };
  }
  throw { code: 'size' };
}

// Nama file unik tiap unggahan: "<id-masjid>/<waktu>.jpg" (file lama tidak ditimpa).
export const newPhotoPath = mosqueId => mosqueId + '/' + Date.now() + '.jpg';

/* ===== Foto profil: persegi, maksimal 100 KB ===== */
export const AVATAR_MAX_BYTES = 100 * 1024; // sama dengan batas bucket "avatars" di Storage
export const AVATAR_ERRORS = { ...PHOTO_ERRORS, size: 'Foto tetap lebih dari 100 KB setelah diperkecil. Coba foto lain.' };
// Dipotong persegi dari tengah, diperkecil bertahap (320 -> 256 -> 192 -> 128 px) sampai <= 100 KB; EXIF/GPS terbuang.
export async function prepareAvatar(file) {
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) throw { code: 'type' };
  if (file.size > MAX_INPUT) throw { code: 'big' };
  let bmp;
  try { bmp = await createImageBitmap(file); } catch (e) { throw { code: 'decode' }; }
  const side = Math.min(bmp.width, bmp.height), sx = (bmp.width - side) / 2, sy = (bmp.height - side) / 2;
  try {
    for (const px of [320, 256, 192, 128]) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = px;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, px, px);
      ctx.drawImage(bmp, sx, sy, side, side, 0, 0, px, px);
      for (const q of [0.85, 0.7, 0.55, 0.4]) {
        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', q));
        if (blob && blob.size <= AVATAR_MAX_BYTES) return { blob, width: px, height: px, originalSize: file.size };
      }
    }
  } finally { if (bmp.close) bmp.close(); }
  throw { code: 'size' };
}
export const newAvatarPath = userId => userId + '/' + Date.now() + '.jpg';

/* ===== Foto produk/toko Pasar Umat: maksimal 100 KB per foto ===== */
export const PRODUCT_MAX_BYTES = 100 * 1024; // sama dengan batas bucket "market-photos" di Storage
export const PRODUCT_ERRORS = { ...PHOTO_ERRORS, size: 'Foto tetap lebih dari 100 KB setelah diperkecil. Coba foto lain.' };
// Perbandingan sisi dipertahankan; sisi terpanjang diperkecil bertahap (1280 -> 1024 -> 800 -> 640 -> 480 px) dan kualitas diturunkan
// sampai <= 100 KB. EXIF/GPS terbuang.
export async function prepareProductPhoto(file) {
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) throw { code: 'type' };
  if (file.size > MAX_INPUT) throw { code: 'big' };
  let bmp;
  try { bmp = await createImageBitmap(file); } catch (e) { throw { code: 'decode' }; }
  try {
    for (const side of [1280, 1024, 800, 640, 480]) {
      const scale = Math.min(1, side / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, w, h);
      for (const q of [0.8, 0.7, 0.6, 0.5, 0.4, 0.3]) {
        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', q));
        if (blob && blob.size <= PRODUCT_MAX_BYTES) return { blob, width: w, height: h, originalSize: file.size };
      }
    }
  } finally { if (bmp.close) bmp.close(); }
  throw { code: 'size' };
}
