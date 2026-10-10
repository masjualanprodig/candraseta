// BAITUNA - islamic-calendar.js
// Kalender Hijriah PERKIRAAN memakai kalender Umm al-Qura bawaan peramban (Intl).
// Penetapan resmi di Indonesia (awal Ramadan, Idulfitri, Iduladha) mengikuti sidang isbat
// Kemenag dan bisa berbeda 1-2 hari. Karena itu semua tanggal diberi status "perlu konfirmasi".
export const HIJRI_MONTH = ['Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir', 'Jumadil Awal', 'Jumadil Akhir',
  'Rajab', 'Syaban', 'Ramadan', 'Syawal', 'Zulkaidah', 'Zulhijah'];
export const MASEHI_MONTH = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const DAY_NAME = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// Hari besar yang dihitung otomatis dari tanggal Hijriah (bulan, hari).
// Isi penjelasan sengaja ringkas dan umum. Perbedaan pandangan ulama/ormas dicantumkan sebagai catatan.
export const EVENTS = [
  { m: 1, d: 1, name: 'Tahun Baru Islam', short: 'Thn Baru Islam',
    about: ['1 Muharram adalah awal tahun baru dalam kalender Hijriah. Penanggalan Hijriah dihitung dari peristiwa hijrah Nabi Muhammad SAW dari Mekkah ke Madinah, dan penetapannya sebagai awal kalender dikenal berlangsung pada masa Khalifah Umar bin Khattab.',
      'Muharram termasuk salah satu dari empat bulan haram (Zulkaidah, Zulhijah, Muharram, dan Rajab) yang dimuliakan.'],
    practices: ['Muhasabah (introspeksi diri) serta memperbanyak doa dan zikir.', 'Puasa sunnah di bulan Muharram, terutama pada 9 dan 10 Muharram.'] },
  { m: 1, d: 10, name: 'Hari Asyura', short: 'Asyura',
    about: ['10 Muharram dikenal sebagai hari Asyura. Hari ini dikaitkan dengan diselamatkannya Nabi Musa AS dan kaumnya, dan Nabi Muhammad SAW menganjurkan puasa pada hari ini.'],
    practices: ['Puasa sunnah Asyura (10 Muharram), dianjurkan disertai puasa pada 9 Muharram (Tasu’a).', 'Di banyak daerah di Indonesia, hari ini juga diisi dengan santunan anak yatim.'] },
  { m: 3, d: 12, name: 'Maulid Nabi Muhammad SAW', short: 'Maulid Nabi',
    about: ['12 Rabiul Awal diperingati sebagai hari kelahiran Nabi Muhammad SAW. Di Indonesia, Maulid Nabi ditetapkan sebagai hari libur nasional.',
      'Cara memperingatinya beragam di tiap daerah dan masjid, umumnya berupa pengajian, selawat, dan kajian sirah (perjalanan hidup) Nabi.'],
    practices: ['Memperbanyak selawat dan mempelajari sirah Nabi.', 'Mengikuti pengajian atau peringatan di masjid setempat.'],
    note: 'Para ulama memiliki pandangan yang beragam tentang tata cara peringatan Maulid. Ikuti arahan pengurus masjid dan ulama setempat.' },
  { m: 7, d: 27, name: 'Isra Mi’raj', short: 'Isra Mi’raj',
    about: ['Isra Mi’raj adalah perjalanan malam Nabi Muhammad SAW dari Masjidil Haram di Mekkah ke Masjidil Aqsa (Isra), lalu naik ke langit (Mi’raj). Dalam peristiwa ini diterima perintah salat lima waktu.'],
    practices: ['Merenungi makna salat dan memperbaiki kualitas ibadah.', 'Mengikuti pengajian peringatan Isra Mi’raj.'],
    note: 'Tanggal 27 Rajab umum dipakai di Indonesia. Para ulama berbeda pendapat tentang tanggal pastinya.' },
  { m: 8, d: 15, name: 'Nisfu Syaban', short: 'Nisfu Syaban',
    about: ['Nisfu Syaban adalah pertengahan bulan Syaban, bulan sebelum Ramadan. Sebagian kaum muslimin mengisinya dengan doa, zikir, dan membaca Al-Quran.',
      'Syaban juga dikenal sebagai bulan untuk bersiap menyambut Ramadan; Nabi Muhammad SAW banyak berpuasa di bulan ini.'],
    practices: ['Memperbanyak doa, zikir, dan membaca Al-Quran.', 'Puasa sunnah di bulan Syaban sebagai persiapan Ramadan.'],
    note: 'Pandangan ulama tentang amalan khusus pada malam Nisfu Syaban berbeda-beda. Ikuti arahan ulama dan pengurus masjid setempat.' },
  { m: 9, d: 1, name: 'Awal Ramadan', short: 'Awal Ramadan',
    about: ['1 Ramadan adalah awal bulan puasa, saat umat Islam menjalankan puasa wajib selama sebulan penuh (29 atau 30 hari).',
      'Di Indonesia, awal Ramadan ditetapkan Kementerian Agama melalui sidang isbat berdasarkan hisab dan rukyatul hilal, sehingga tanggal pastinya baru diketahui menjelang Ramadan dan bisa berbeda dengan perkiraan atau dengan keputusan organisasi lain.'],
    practices: ['Berniat puasa, sahur, dan berbuka.', 'Salat tarawih berjamaah, tadarus Al-Quran, dan memperbanyak sedekah.'],
    note: 'Tunggu pengumuman resmi pemerintah atau ikuti keputusan lembaga yang Anda ikuti.' },
  { m: 9, d: 17, name: 'Nuzulul Quran', short: 'Nuzulul Quran',
    about: ['Nuzulul Quran memperingati turunnya wahyu pertama kepada Nabi Muhammad SAW (Surat Al-Alaq ayat 1–5) di Gua Hira.'],
    practices: ['Membaca, mengkaji, dan merenungi isi Al-Quran.', 'Mengikuti peringatan Nuzulul Quran di masjid.'],
    note: 'Tanggal 17 Ramadan umum dipakai di Indonesia. Para ulama berbeda pendapat tentang tanggal pastinya.' },
  { m: 10, d: 1, name: 'Idulfitri', short: 'Idulfitri',
    about: ['1 Syawal adalah Idulfitri, hari raya setelah sebulan berpuasa Ramadan. Pada hari ini umat Islam melaksanakan salat Id berjamaah dan bersilaturahmi.',
      'Berpuasa pada hari raya Idulfitri tidak diperbolehkan.'],
    practices: ['Menunaikan zakat fitrah sebelum salat Id.', 'Takbiran pada malam hari raya, salat Id berjamaah, dan saling memaafkan.'],
    note: 'Tanggal Idulfitri di Indonesia ditetapkan pemerintah melalui sidang isbat dan bisa berbeda dari perkiraan di sini.' },
  { m: 12, d: 9, name: 'Hari Arafah', short: 'Hari Arafah',
    about: ['9 Zulhijah adalah hari Arafah, saat jamaah haji melaksanakan wukuf di Padang Arafah, inti dari ibadah haji.',
      'Bagi yang tidak sedang berhaji, dianjurkan berpuasa sunnah Arafah.'],
    practices: ['Puasa sunnah Arafah.', 'Memperbanyak doa, zikir, dan takbir.'],
    note: 'Wukuf ditetapkan otoritas Arab Saudi, sedangkan di Indonesia tanggalnya mengikuti penetapan pemerintah.' },
  { m: 12, d: 10, name: 'Iduladha', short: 'Iduladha',
    about: ['10 Zulhijah adalah Iduladha (Hari Raya Kurban) yang mengenang ketaatan Nabi Ibrahim AS dan Nabi Ismail AS. Umat Islam melaksanakan salat Id dan berkurban.',
      'Penyembelihan hewan kurban dilakukan setelah salat Id, pada 10 Zulhijah hingga hari tasyrik (11–13 Zulhijah).'],
    practices: ['Salat Id berjamaah.', 'Berkurban bagi yang mampu dan membagikan dagingnya.', 'Memperbanyak takbir.'],
    note: 'Tanggal Iduladha di Indonesia ditetapkan pemerintah melalui sidang isbat dan dapat berbeda dari Arab Saudi.' }
];
export const HIJRI_SHORT = ['Muh', 'Saf', 'R.Awl', 'R.Akh', 'J.Awl', 'J.Akh', 'Raj', 'Syb', 'Ram', 'Syw', 'Zkd', 'Zhj'];

let fmt = null;
function formatter() {
  if (fmt === null) {
    try { fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' }); }
    catch (e) { fmt = false; }
  }
  return fmt;
}
export const supported = () => !!formatter() && !!hijriOf(2026, 1, 1);

// Tanggal Masehi (y, m, d) -> {d, m, y} Hijriah, atau null jika peramban tidak mendukung.
export function hijriOf(y, m, d) {
  const f = formatter();
  if (!f) return null;
  const parts = f.formatToParts(new Date(Date.UTC(y, m - 1, d, 12)));
  const get = t => Number((parts.find(p => p.type === t) || {}).value);
  const out = { d: get('day'), m: get('month'), y: get('year') };
  return out.d && out.m && out.y ? out : null;
}

export const hijriText = h => h.d + ' ' + HIJRI_MONTH[h.m - 1] + ' ' + h.y + ' H';
export const masehiText = (y, m, d) => {
  const w = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  return DAY_NAME[w] + ', ' + d + ' ' + MASEHI_MONTH[m - 1] + ' ' + y;
};

// Hari besar berikutnya dalam rentang ~13 bulan ke depan (tiap hari besar: kemunculan pertama).
export function upcomingEvents(y, m, d, limit = 5) {
  const seen = new Set(), found = [];
  for (let i = 0; i < 400 && found.length < EVENTS.length; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i, 12));
    const gy = dt.getUTCFullYear(), gm = dt.getUTCMonth() + 1, gd = dt.getUTCDate();
    const h = hijriOf(gy, gm, gd);
    if (!h) return [];
    const ev = EVENTS.find(e => e.m === h.m && e.d === h.d);
    if (ev && !seen.has(ev.name)) { seen.add(ev.name); found.push({ name: ev.name, y: gy, m: gm, d: gd, hijri: h, inDays: i }); }
  }
  return found.sort((a, b) => a.inDays - b.inDays).slice(0, limit);
}

export const eventFor = h => (h && EVENTS.find(e => e.m === h.m && e.d === h.d)) || null;

// Data satu bulan Masehi untuk kisi kalender (minggu mulai Minggu).
export function monthData(y, m) {
  const startDow = new Date(Date.UTC(y, m - 1, 1, 12)).getUTCDay();
  const daysIn = new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
  const days = [];
  for (let d = 1; d <= daysIn; d++) { const h = hijriOf(y, m, d); days.push({ y, m, d, h, ev: eventFor(h), dow: (startDow + d - 1) % 7 }); }
  return { y, m, startDow, daysIn, days };
}

// Label bulan Hijriah yang tercakup bulan Masehi ini, mis. "Rabiul Awal – Rabiul Akhir 1448 H".
export function hijriRangeLabel(data) {
  const a = data.days[0].h, b = data.days[data.days.length - 1].h;
  if (!a || !b) return '';
  const left = HIJRI_MONTH[a.m - 1] + (a.y !== b.y ? ' ' + a.y : '');
  if (a.m === b.m && a.y === b.y) return left + ' ' + a.y + ' H';
  return left + ' \u2013 ' + HIJRI_MONTH[b.m - 1] + ' ' + b.y + ' H';
}
