// BAITUNA - zakat-ui.js
// Halaman Kalkulator Zakat: zakat maal, zakat penghasilan, nisab & haul, dasar & rujukan. Semua hitungan di perangkat.
import { h, toast } from './ui.js';
import * as Z from './zakat-service.js';
import { HIJRI_MONTH, MASEHI_MONTH } from './islamic-calendar.js';

const TABS = [['maal', 'Zakat Maal'], ['hasil', 'Penghasilan'], ['nisab', 'Nisab & Haul'], ['dasar', 'Dasar & Rujukan']];

export function zakatPage() {
  const wrap = h('div', { class: 'zakat' });
  let cfg = Z.load(), tab = 'maal';
  const vals = { cash: '', goldGram: '', jewelWornGram: '', silverGram: '', securities: '', receivable: '', trade: '', other: '', debt: '', rutin: '', tidakRutin: '', kebutuhan: '' };
  let haul = 'unsure';
  const persist = () => { if (!Z.save(cfg)) toast('Pengaturan belum bisa disimpan di perangkat ini.', true); };

  /* ---------- bagian kecil ---------- */
  const note = (...k) => h('p', { class: 'zk-note' }, ...k);
  const sec = (title, ...k) => h('section', { class: 'panel zk-sec' }, h('h3', { class: 'zk-h' }, title), ...k);

  function money(key, label, help, kind) {
    const isGram = kind === 'gram';
    const inp = h('input', { class: 'in zk-in', type: 'text', inputmode: isGram ? 'decimal' : 'numeric', autocomplete: 'off', 'aria-label': label, placeholder: isGram ? '0' : '0', 'data-k': key });
    inp.value = vals[key];
    inp.addEventListener('input', () => { vals[key] = inp.value; recalc(); });
    if (!isGram) inp.addEventListener('blur', () => { const n = Z.parseRp(inp.value); inp.value = n ? Z.fmtNum(n) : ''; vals[key] = inp.value; });
    return h('label', { class: 'zk-f' }, h('span', { class: 'zk-l' }, label), help ? h('span', { class: 'zk-help' }, help) : '',
      h('span', { class: 'zk-wrap' }, h('span', { class: 'zk-u' }, isGram ? 'gram' : 'Rp'), inp));
  }
  function radios(name, cur, items, onPick) {
    return h('div', { class: 'zk-radios', role: 'radiogroup' }, ...items.map(([v, label, sub]) => {
      const b = h('button', { class: 'zk-rd' + (cur === v ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': cur === v ? 'true' : 'false', 'data-v': v, onclick: () => onPick(v) },
        h('b', {}, label), sub ? h('span', {}, sub) : '');
      return b;
    }));
  }

  /* ---------- pengaturan nisab (dipakai bersama) ---------- */
  function priceBox() {
    const g = h('input', { class: 'in zk-in', type: 'text', inputmode: 'numeric', id: 'zk-gold', 'aria-label': 'Harga emas per gram', placeholder: 'mis. isi sesuai harga hari ini' });
    g.value = cfg.gold ? Z.fmtNum(cfg.gold) : '';
    const s = h('input', { class: 'in zk-in', type: 'text', inputmode: 'numeric', id: 'zk-silver', 'aria-label': 'Harga perak per gram', placeholder: 'opsional' });
    s.value = cfg.silver ? Z.fmtNum(cfg.silver) : '';
    const nb = h('input', { class: 'in zk-in', type: 'text', inputmode: 'numeric', id: 'zk-nisab', 'aria-label': 'Nisab penghasilan per tahun dari BAZNAS', placeholder: 'opsional' });
    nb.value = cfg.nisabYear ? Z.fmtNum(cfg.nisabYear) : '';
    const info = h('p', { class: 'zk-note', id: 'zk-nisabinfo', role: 'status' });
    const upd = () => {
      cfg.gold = Z.parseRp(g.value); cfg.silver = Z.parseRp(s.value); cfg.nisabYear = Z.parseRp(nb.value); persist();
      const ny = Z.nisabPenghasilanTahun(cfg.gold, cfg.nisabYear);
      info.textContent = cfg.gold ? 'Nisab maal (85 gram emas): ' + Z.rp(Z.nisabEmas(cfg.gold)) + (ny ? '. Nisab penghasilan: ' + Z.rp(ny) + ' per tahun (' + Z.rp(ny / 12) + ' per bulan).' : '') :
        (ny ? 'Nisab penghasilan: ' + Z.rp(ny) + ' per tahun (' + Z.rp(ny / 12) + ' per bulan). Isi harga emas untuk menghitung nisab maal.' : 'Isi harga emas per gram terlebih dahulu agar nisab bisa dihitung.');
      recalc();
    };
    for (const e of [g, s, nb]) { e.addEventListener('input', upd); e.addEventListener('blur', () => { const n = Z.parseRp(e.value); e.value = n ? Z.fmtNum(n) : ''; }); }
    const useRef = h('button', { class: 'btn-sm ghost', type: 'button', id: 'zk-useref', onclick: () => { nb.value = Z.fmtNum(Z.BAZNAS_REF.tahun); upd(); toast('Nilai acuan BAZNAS ' + Z.BAZNAS_REF.year + ' dimasukkan. Mohon cek ke baznas.go.id.'); } }, 'Isi dengan acuan BAZNAS ' + Z.BAZNAS_REF.year);
    setTimeout(upd, 0);
    return h('section', { class: 'panel zk-sec', id: 'zk-prices' }, h('h3', { class: 'zk-h' }, 'Harga emas & nisab'),
      note('Nisab dihitung dari harga emas hari ini. Aplikasi tidak mengambil harga dari internet, jadi isi sendiri dari sumber yang Anda percaya (mis. toko emas resmi atau situs BAZNAS).'),
      h('label', { class: 'zk-f' }, h('span', { class: 'zk-l' }, 'Harga emas murni (24 karat) per gram'), h('span', { class: 'zk-wrap' }, h('span', { class: 'zk-u' }, 'Rp'), g)),
      h('label', { class: 'zk-f' }, h('span', { class: 'zk-l' }, 'Harga perak per gram (jika punya perak)'), h('span', { class: 'zk-wrap' }, h('span', { class: 'zk-u' }, 'Rp'), s)),
      h('label', { class: 'zk-f' }, h('span', { class: 'zk-l' }, 'Nisab penghasilan per tahun dari BAZNAS (opsional)'), h('span', { class: 'zk-help' }, 'Bila diisi, dipakai untuk zakat penghasilan menggantikan 85 gram × harga emas.'), h('span', { class: 'zk-wrap' }, h('span', { class: 'zk-u' }, 'Rp'), nb)),
      h('div', { class: 'zk-row' }, useRef), info,
      note('Hanya harga dan pilihan metode yang diingat di perangkat ini. Jumlah harta dan penghasilan Anda tidak disimpan dan tidak dikirim ke mana pun.'));
  }

  /* ---------- hasil (diperbarui tanpa menggambar ulang isian) ---------- */
  const res = h('div', { class: 'zk-res', 'aria-live': 'polite' });
  let current = null;

  function chip(kind, text) { return h('div', { class: 'zk-chip ' + kind, role: 'status' }, text); }
  function table(rows) { return h('table', { class: 'zk-tb' }, h('tbody', {}, ...rows.map(([a, b, cls]) => h('tr', { class: cls || '' }, h('td', {}, a), h('td', { class: 'r' }, b))))); }
  function copyBtn(text) {
    return h('button', { class: 'btn-sm ghost', type: 'button', id: 'zk-copy', onclick: async () => {
      try { await navigator.clipboard.writeText(text); toast('Ringkasan disalin.'); } catch { toast('Tidak bisa menyalin di perangkat ini.', true); } } }, 'Salin ringkasan');
  }
  const AMIL = h('p', { class: 'zk-amil' }, 'Hasil ini perkiraan, bukan fatwa. Untuk kondisi khusus (usaha, warisan, harta bersama, utang, dll.) tanyakan ke amil resmi (BAZNAS/LAZ/UPZ masjid) atau ustaz yang Anda percaya.');

  function drawMaal() {
    const num = {}; for (const k of Z.MAAL_FIELDS) num[k] = (k.endsWith('Gram')) ? Z.parseGram(vals[k]) : Z.parseRp(vals[k]);
    const r = Z.maal(num, { gold: cfg.gold, silver: cfg.silver, jewel: cfg.jewel, debt: cfg.debt, haul });
    const kids = [];
    for (const p of r.problems) kids.push(h('p', { class: 'zk-warn' }, p));
    if (r.status === 'no-price') kids.push(chip('info', 'Isi harga emas dulu agar nisab bisa dihitung'));
    else if (r.status === 'below') kids.push(chip('neutral', 'Belum mencapai nisab: belum wajib zakat maal'));
    else if (r.status === 'no-haul') kids.push(chip('neutral', 'Sudah mencapai nisab, tetapi belum genap satu tahun (haul): belum wajib'));
    else if (r.status === 'due-unsure') kids.push(chip('info', 'Mencapai nisab. Wajib jika haul sudah terpenuhi'));
    else kids.push(chip('due', 'Mencapai nisab dan haul: wajib zakat maal'));
    if (r.status !== 'no-price' || r.net > 0) {
      kids.push(table([
        ...r.rows.map(([a, b]) => [a, Z.rp(b)]),
        ['Total harta', Z.rp(r.gross), 'sum'],
        ...(r.debt ? [['Utang jatuh tempo dikurangkan', '− ' + Z.rp(r.debt)]] : []),
        ['Harta bersih yang dihitung', Z.rp(r.net), 'sum'],
        ['Nisab (85 gram emas)', r.nisab ? Z.rp(r.nisab) : 'belum dihitung']
      ]));
    }
    if (r.status === 'due' || r.status === 'due-unsure') kids.push(h('div', { class: 'zk-big' }, h('span', {}, r.status === 'due' ? 'Zakat maal (2,5%)' : 'Zakat maal jika haul terpenuhi (2,5%)'), h('b', { id: 'zk-amount' }, Z.rp(r.zakat))));
    if (r.status === 'no-haul') kids.push(note('Jika haul sudah genap, zakat yang perlu ditunaikan kira-kira ', h('b', {}, Z.rp(r.ifDue)), '.'));
    if (r.status === 'below' && r.net > 0 && r.nisab) kids.push(note('Kekurangan dari nisab: ', h('b', {}, Z.rp(r.nisab - r.net)), '. Bersedekah tetap dianjurkan kapan saja.'));
    const ctx = [];
    if (r.hasWorn) {
      const a = r.altJewel;
      ctx.push(h('li', {}, 'Perhiasan emas yang dipakai sehari-hari: ulama berbeda pendapat. Pilihan Anda saat ini: ', h('b', {}, r.jewel === 'include' ? 'dihitung' : 'tidak dihitung'),
        '. Dengan pendapat sebaliknya, harta bersih ', Z.rp(a.net), a.reach ? ' dan zakat sekitar ' + Z.rp(a.zakat) + '.' : ' (belum mencapai nisab).'));
    }
    if (r.altDebt) ctx.push(h('li', {}, 'Utang: pendapat tentang pengurangan utang juga berbeda. Bila ', r.altDebt.deduct ? 'utang dikurangkan' : 'utang tidak dikurangkan', ', harta bersih ', Z.rp(r.altDebt.net), r.altDebt.reach ? ' dan zakat sekitar ' + Z.rp(r.altDebt.zakat) + '.' : ' (belum mencapai nisab).'));
    if (r.status === 'due-unsure' || r.status === 'no-haul' || haul === 'unsure') ctx.push(h('li', {}, 'Haul: zakat maal baru wajib bila harta mencapai nisab dan dimiliki satu tahun Hijriah penuh. Cek di tab "Nisab & Haul" untuk menghitung tanggalnya.'));
    ctx.push(h('li', {}, 'Rumah tinggal, kendaraan pribadi, dan perabot untuk dipakai sendiri bukan objek zakat maal, jadi tidak dihitung di sini.'));
    ctx.push(h('li', {}, 'Harta yang dimiliki dengan cara halal dan sepenuhnya milik Anda saja yang dihitung; harta bersama atau titipan perlu dipisahkan.'));
    kids.push(h('div', { class: 'zk-ctx' }, h('b', {}, 'Catatan sesuai pilihan Anda'), h('ul', {}, ...ctx)));
    kids.push(h('div', { class: 'zk-row' }, copyBtn(Z.summaryMaal(r))), AMIL);
    res.replaceChildren(...kids); current = r;
  }

  function drawHasil() {
    const num = { rutin: Z.parseRp(vals.rutin), tidakRutin: Z.parseRp(vals.tidakRutin), kebutuhan: Z.parseRp(vals.kebutuhan) };
    const ny = Z.nisabPenghasilanTahun(cfg.gold, cfg.nisabYear);
    const r = Z.penghasilan(num, { basis: cfg.basis, period: cfg.period, nisabTahun: ny });
    const kids = [];
    if (r.status === 'no-price') kids.push(chip('info', 'Isi harga emas atau nisab BAZNAS dulu agar nisab bisa dihitung'));
    else if (r.status === 'below') kids.push(chip('neutral', 'Belum mencapai nisab pada metode ini: belum wajib'));
    else kids.push(chip('due', 'Mencapai nisab pada metode ini: zakat penghasilan perlu ditunaikan'));
    if (r.income || r.needs) kids.push(table([
      [r.period === 'tahun' ? 'Penghasilan setahun' : 'Penghasilan bulan ini', Z.rp(r.income)],
      ...(r.needs ? [['Kebutuhan pokok' + (r.period === 'tahun' ? ' setahun' : ''), '− ' + Z.rp(r.needs)]] : []),
      ['Dasar hitung (' + (r.basis === 'neto' ? 'setelah kebutuhan pokok' : 'penghasilan kotor') + ')', Z.rp(r.net), 'sum'],
      ['Nisab ' + (r.period === 'tahun' ? 'per tahun' : 'per bulan (1/12 dari nisab tahunan)'), r.nisab ? Z.rp(r.nisab) : 'belum dihitung']
    ]));
    if (r.status === 'due') kids.push(h('div', { class: 'zk-big' }, h('span', {}, 'Zakat penghasilan (2,5%) ' + (r.period === 'tahun' ? 'setahun' : 'bulan ini')), h('b', { id: 'zk-amount' }, Z.rp(r.zakat))));
    const ctx = [];
    if (r.needsExceed) ctx.push(h('li', {}, 'Kebutuhan pokok yang Anda isi melebihi penghasilan, jadi dasar hitung 0.'));
    if (r.period === 'bulan' && r.status === 'below' && r.yearView) {
      ctx.push(h('li', {}, 'Bila tiap bulan belum mencapai nisab bulanan, penghasilan boleh dikumpulkan selama setahun dan dihitung di akhir tahun (Fatwa MUI No. 3 Tahun 2003). Jika penghasilan bulan ini berulang selama setahun: dasar hitung ', Z.rp(r.yearView.net), r.yearView.reach ? ', zakat sekitar ' + Z.rp(r.yearView.zakat) + '.' : ' (belum mencapai nisab tahunan).'));
    }
    if (r.period === 'bulan' && r.status === 'due') ctx.push(h('li', {}, 'Dengan cara bulanan, zakat ditunaikan setiap menerima penghasilan. Pilih "Tahunan" bila Anda memilih menghitung di akhir tahun.'));
    ctx.push(h('li', {}, r.basis === 'neto'
      ? 'Metode "setelah kebutuhan pokok": hanya kebutuhan pokok yang wajar (pangan, sandang, papan, pendidikan, kesehatan, cicilan kebutuhan pokok) yang dikurangkan. Tidak termasuk gaya hidup berlebih.'
      : 'Metode "penghasilan kotor": zakat dihitung dari seluruh penghasilan halal sebelum pengeluaran. Sebagian ulama dan lembaga memilih metode setelah kebutuhan pokok.'));
    ctx.push(h('li', {}, 'Tidak ada syarat haul tersendiri untuk tiap penerimaan; yang diperiksa adalah nisab. Pendapat lain mensyaratkan haul seperti zakat maal; tanyakan ke amil/ustaz Anda.'));
    if (cfg.nisabYear) ctx.push(h('li', {}, 'Nisab memakai nilai BAZNAS yang Anda isi. Nilai itu dihitung BAZNAS dengan patokan harga emas tertentu, jadi bisa berbeda dari 85 gram × harga emas 24 karat Anda.'));
    kids.push(h('div', { class: 'zk-ctx' }, h('b', {}, 'Catatan sesuai pilihan Anda'), h('ul', {}, ...ctx)));
    kids.push(h('div', { class: 'zk-row' }, copyBtn(Z.summaryPenghasilan(r))), AMIL);
    res.replaceChildren(...kids); current = r;
  }
  function recalc() { if (tab === 'maal') drawMaal(); else if (tab === 'hasil') drawHasil(); else if (tab === 'nisab' && nisabSec && nisabSec.isConnected) { const n = buildNisabSec(); nisabSec.replaceWith(n); nisabSec = n; } }

  /* ---------- tab: maal ---------- */
  function maalTab() {
    const jewelOpt = radios('jewel', cfg.jewel, [['exclude', 'Tidak dihitung', 'Pendapat mayoritas ulama (Maliki, Syafi’i, Hanbali) bila dipakai wajar'], ['include', 'Dihitung', 'Pendapat Hanafi']], v => { cfg.jewel = v; persist(); draw(); });
    const haulOpt = radios('haul', haul, [['yes', 'Sudah satu tahun', 'Hartanya sudah mencapai nisab selama setahun Hijriah'], ['no', 'Belum', 'Baru mencapai nisab kurang dari setahun'], ['unsure', 'Belum tahu', 'Tampilkan sebagai perkiraan']], v => { haul = v; draw(); });
    return [
      priceBox(),
      sec('Harta yang Anda miliki',
        note('Isi yang ada saja; kosongkan yang tidak ada. Hanya harta yang halal, milik penuh, dan tidak untuk dipakai sendiri yang dihitung.'),
        money('cash', 'Uang tunai, tabungan, deposito', 'Saldo saat ini'),
        money('goldGram', 'Emas simpanan atau investasi', 'Batangan, koin, perhiasan yang disimpan. Isi setara emas 24 karat.', 'gram'),
        money('jewelWornGram', 'Perhiasan emas yang dipakai sehari-hari', 'Hanya untuk perhiasan yang benar-benar dipakai secara wajar.', 'gram'),
        h('div', { class: 'zk-sub' }, h('b', {}, 'Perhiasan yang dipakai wajar, bagaimana?'), jewelOpt),
        money('silverGram', 'Perak', 'Butuh harga perak di atas', 'gram'),
        money('securities', 'Saham, reksa dana, surat berharga', 'Nilai pasar saat ini'),
        money('receivable', 'Piutang yang diharapkan kembali', 'Hanya yang lancar (orangnya mampu dan mau membayar)'),
        money('trade', 'Aset usaha dagang', 'Stok barang dagangan ditambah kas usaha'),
        money('other', 'Harta lain yang halal dan berkembang', 'Mis. hasil sewa yang tersimpan')),
      sec('Utang jatuh tempo', note('Utang yang harus dibayar dalam waktu dekat. Cicilan jangka panjang yang belum jatuh tempo tidak diisi.'),
        money('debt', 'Utang jatuh tempo', ''),
        h('label', { class: 'zk-chk' }, (() => { const c = h('input', { type: 'checkbox', id: 'zk-debt' }); c.checked = cfg.debt; c.addEventListener('change', () => { cfg.debt = c.checked; persist(); recalc(); }); return c; })(), h('span', {}, 'Kurangkan utang jatuh tempo dari harta (pendapat yang dipakai banyak lembaga zakat di Indonesia; sebagian ulama tidak mengurangkannya)'))),
      sec('Haul (satu tahun Hijriah)', haulOpt),
      res
    ];
  }

  /* ---------- tab: penghasilan ---------- */
  function hasilTab() {
    const basis = radios('basis', cfg.basis, [['bruto', 'Dari penghasilan kotor', 'Seluruh penghasilan halal'], ['neto', 'Setelah kebutuhan pokok', 'Dikurangi kebutuhan pokok yang wajar']], v => { cfg.basis = v; persist(); draw(); });
    const period = radios('period', cfg.period, [['bulan', 'Bulanan', 'Dibayar tiap menerima penghasilan'], ['tahun', 'Tahunan', 'Dihitung di akhir tahun']], v => { cfg.period = v; persist(); draw(); });
    const yr = cfg.period === 'tahun';
    return [
      priceBox(),
      sec('Metode perhitungan', note('Zakat penghasilan punya beberapa cara hitung yang sama-sama dipakai di Indonesia. Pilih yang sesuai arahan amil/ustaz Anda.'),
        h('div', { class: 'zk-sub' }, h('b', {}, 'Dasar hitung'), basis), h('div', { class: 'zk-sub' }, h('b', {}, 'Periode'), period)),
      sec('Penghasilan Anda',
        money('rutin', 'Penghasilan rutin per bulan', 'Gaji, honor, penghasilan usaha bersih/kotor sesuai metode'),
        money('tidakRutin', yr ? 'Penghasilan tidak rutin setahun' : 'Penghasilan tidak rutin bulan ini', yr ? 'Bonus, THR, komisi, dan sejenisnya selama setahun' : 'Bonus, THR, komisi bila Anda terima bulan ini'),
        cfg.basis === 'neto' ? money('kebutuhan', 'Kebutuhan pokok per bulan', 'Pangan, sandang, papan, pendidikan, kesehatan, cicilan kebutuhan pokok') : ''),
      res
    ];
  }

  /* ---------- tab: nisab & haul ---------- */
  let nisabSec = null;
  function buildNisabSec() {
    const gold = Z.nisabEmas(cfg.gold), silver = Z.nisabPerak(cfg.silver), ny = Z.nisabPenghasilanTahun(cfg.gold, cfg.nisabYear);
    return sec('Nisab ringkas', h('table', { class: 'zk-tb' }, h('tbody', {},
        h('tr', {}, h('td', {}, 'Zakat maal (patokan emas)'), h('td', { class: 'r' }, '85 gram emas', h('br'), h('small', {}, gold ? Z.rp(gold) : 'isi harga emas'))),
        h('tr', {}, h('td', {}, 'Patokan perak'), h('td', { class: 'r' }, '595 gram perak', h('br'), h('small', {}, silver ? Z.rp(silver) : 'isi harga perak'))),
        h('tr', {}, h('td', {}, 'Zakat penghasilan per tahun'), h('td', { class: 'r' }, ny ? Z.rp(ny) : 'belum dihitung')),
        h('tr', {}, h('td', {}, 'Zakat penghasilan per bulan (1/12)'), h('td', { class: 'r' }, ny ? Z.rp(ny / 12) : 'belum dihitung')),
        h('tr', {}, h('td', {}, 'Kadar'), h('td', { class: 'r' }, '2,5%')))),
        note('Nisab adalah batas minimum harta agar terkena zakat. Nilainya naik turun mengikuti harga emas, jadi periksa lagi setiap kali menghitung.'),
        h('div', { class: 'zk-ref' }, h('b', {}, 'Acuan BAZNAS ' + Z.BAZNAS_REF.year), h('p', {}, 'Nisab penghasilan dan jasa ' + Z.rp(Z.BAZNAS_REF.tahun) + ' per tahun atau ' + Z.rp(Z.BAZNAS_REF.bulan) + ' per bulan (' + Z.BAZNAS_REF.sk + ').'),
          h('p', { class: 'zk-warn' }, 'Angka ini dikutip dari pemberitaan dan belum diperiksa langsung ke dokumen resmi. Cek nilai terbaru di baznas.go.id sebelum dipakai.')));
  }
  function nisabTab() {
    const dt = h('input', { class: 'in', type: 'date', id: 'zk-date', 'aria-label': 'Tanggal harta mulai mencapai nisab' });
    const out = h('div', { class: 'zk-haulout', 'aria-live': 'polite' });
    dt.addEventListener('change', () => {
      out.replaceChildren();
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dt.value); if (!m) return;
      const r = Z.haulDate(+m[1], +m[2], +m[3]);
      if (!r) { out.append(note('Peramban ini belum mendukung kalender Hijriah, jadi tanggal haul tidak bisa dihitung. Hitung satu tahun Hijriah (sekitar 354 hari) dari tanggal mulai.')); return; }
      out.append(h('div', { class: 'zk-chip info' }, 'Haul genap sekitar ', h('b', {}, r.d + ' ' + MASEHI_MONTH[r.m - 1] + ' ' + r.y), ' (' + r.hijri.d + ' ' + HIJRI_MONTH[r.hijri.m - 1] + ' ' + r.hijri.y + ' H)'),
        note('Mulai dihitung: ' + r.start.d + ' ' + HIJRI_MONTH[r.start.m - 1] + ' ' + r.start.y + ' H. Ini perkiraan memakai kalender Hijriah peramban; ikuti penetapan tanggal yang berlaku di tempat Anda. Bila harta turun di bawah nisab di tengah tahun, sebagian ulama menghitung ulang dari awal.'));
    });
    nisabSec = buildNisabSec();
    return [
      priceBox(),
      nisabSec,
      sec('Periode perhitungan (haul)',
        h('ul', { class: 'zk-ul' },
          h('li', {}, h('b', {}, 'Zakat maal: '), 'wajib bila harta mencapai nisab dan dimiliki satu tahun Hijriah penuh (haul). Haul dihitung sejak harta mencapai nisab.'),
          h('li', {}, h('b', {}, 'Zakat penghasilan: '), 'menurut Fatwa MUI No. 3 Tahun 2003, dikeluarkan saat menerima penghasilan bila sudah mencapai nisab; bila belum, dikumpulkan selama setahun dan dizakati ketika mencapai nisab. Ada pula pendapat yang mensyaratkan haul seperti zakat maal.'),
          h('li', {}, h('b', {}, 'Tahun Hijriah: '), 'satu tahun Hijriah sekitar 354 hari, lebih pendek dari tahun Masehi. Kadar 2,5% berlaku untuk tahun Hijriah; sebagian lembaga memakai 2,5775% bila menghitung berdasarkan tahun Masehi (365 hari). Ikuti arahan amil Anda.')),
        h('div', { class: 'zk-sub' }, h('b', {}, 'Hitung tanggal haul'), note('Pilih tanggal harta Anda mulai mencapai nisab.'), dt, out))
    ];
  }

  /* ---------- tab: dasar & rujukan ---------- */
  function dasarTab() {
    const link = (t, u) => h('a', { href: u, target: '_blank', rel: 'noopener noreferrer' }, t);
    const det = (t, ...k) => h('details', { class: 'zk-det' }, h('summary', {}, t), ...k);
    return [
      sec('Cara kerja kalkulator',
        h('ol', { class: 'zk-ul' },
          h('li', {}, 'Tentukan nisab: 85 gram emas × harga emas yang Anda isi (atau nilai BAZNAS bila Anda isi).'),
          h('li', {}, 'Zakat maal: seluruh harta yang dihitung dijumlahkan, utang jatuh tempo dikurangkan (bila dipilih), lalu dibandingkan dengan nisab. Bila mencapai nisab dan haul, zakatnya 2,5% dari harta bersih.'),
          h('li', {}, 'Zakat penghasilan: penghasilan (dikurangi kebutuhan pokok bila memilih metode itu) dibandingkan dengan nisab bulanan atau tahunan sesuai pilihan. Bila mencapai nisab, zakatnya 2,5%.'),
          h('li', {}, 'Bila hasilnya bergantung pada pilihan yang diperselisihkan ulama (perhiasan, utang, kebutuhan pokok), aplikasi menampilkan hasil dengan pilihan Anda beserta pilihan sebaliknya.'))),
      sec('Yang belum tercakup',
        h('p', { class: 'zk-note' }, 'Kalkulator ini belum menghitung zakat fitrah, zakat pertanian, zakat peternakan, zakat rikaz/barang temuan, atau kondisi khusus seperti harta warisan, harta bersama, dan usaha dengan akad tertentu. Untuk itu tanyakan langsung ke amil atau ustaz.')),
      sec('Perbedaan pendapat ulama',
        det('Perhiasan emas yang dipakai', h('p', { class: 'zk-note' }, 'Mayoritas ulama (Maliki, Syafi’i, Hanbali) berpendapat perhiasan mubah yang dipakai wajar tidak dizakati. Ulama Hanafi berpendapat tetap dizakati. Perhiasan yang disimpan sebagai tabungan atau investasi dizakati menurut semuanya.')),
        det('Utang', h('p', { class: 'zk-note' }, 'Sebagian ulama dan lembaga zakat mengurangkan utang yang jatuh tempo dari harta sebelum dibandingkan dengan nisab; sebagian lain tidak mengurangkannya. Karena itu kalkulator ini menampilkan hasil kedua pilihan.')),
        det('Zakat penghasilan: kotor atau setelah kebutuhan pokok', h('p', { class: 'zk-note' }, 'Lembaga dan ulama di Indonesia memakai cara berbeda: sebagian menghitung dari penghasilan kotor, sebagian setelah kebutuhan pokok. Pilih yang sesuai arahan amil Anda.')),
        det('Haul pada zakat penghasilan', h('p', { class: 'zk-note' }, 'Ada yang berpendapat zakat penghasilan ditunaikan saat menerima (tanpa menunggu haul), ada yang mensyaratkan haul seperti zakat maal. Fatwa MUI No. 3 Tahun 2003 membolehkan keduanya sesuai ketentuan di atas.'))),
      sec('Rujukan',
        h('ul', { class: 'zk-ul' },
          h('li', {}, 'Al-Qur’an: QS At-Taubah ayat 103 (zakat diambil dari harta) dan ayat 60 (golongan penerima zakat). Bacalah teks dan terjemahannya di menu Al-Qur’an.'),
          h('li', {}, 'Nisab 85 gram emas dan 595 gram perak serta kadar 2,5% dirumuskan para ulama dari hadits tentang zakat emas dan perak; rujuk kitab fikih atau penjelasan BAZNAS untuk dalilnya.'),
          h('li', {}, 'UU No. 23 Tahun 2011 tentang Pengelolaan Zakat (pendapatan dan jasa termasuk objek zakat maal).'),
          h('li', {}, 'Fatwa MUI No. 3 Tahun 2003 tentang Zakat Penghasilan.'),
          h('li', {}, 'Peraturan Menteri Agama No. 31 Tahun 2019 (mengubah PMA No. 52 Tahun 2014).'),
          h('li', {}, Z.BAZNAS_REF.sk + ' tentang nilai nisab zakat pendapatan dan jasa tahun ' + Z.BAZNAS_REF.year + '. Dikutip dari pemberitaan, belum diperiksa ke dokumen resmi.'),
          h('li', {}, 'Bahan bacaan: ', link('baznas.go.id', 'https://baznas.go.id'), ', ', link('Hukumonline: Ketentuan zakat profesi', 'https://www.hukumonline.com/klinik/a/ketentuan-zakat-profesi-di-indonesia-lt699e5e0531cd1/'), '.')),
        note('Tautan terbuka di peramban dan memerlukan internet. Kalkulator sendiri berjalan tanpa internet.')),
      sec('Golongan penerima zakat (asnaf)', h('p', { class: 'zk-note' }, 'Fakir, miskin, amil, muallaf, riqab (hamba sahaya), gharimin (orang berutang), fi sabilillah, dan ibnu sabil (musafir), sebagaimana QS At-Taubah ayat 60. Menyalurkan lewat amil resmi (BAZNAS, LAZ, atau UPZ masjid) memudahkan zakat sampai kepada yang berhak.')),
      h('p', { class: 'zk-amil' }, 'Penting: ini alat bantu hitung, bukan fatwa. Isi dan rujukan sebaiknya ditinjau ustaz atau amil sebelum dipakai luas.')
    ];
  }

  function draw() {
    const tabs = h('div', { class: 'zk-tabs', role: 'tablist' }, ...TABS.map(([k, l]) => h('button', { class: 'zk-tab' + (tab === k ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': tab === k ? 'true' : 'false', 'data-t': k, onclick: () => { tab = k; draw(); window.scrollTo(0, 0); } }, l)));
    const body = tab === 'maal' ? maalTab() : tab === 'hasil' ? hasilTab() : tab === 'nisab' ? nisabTab() : dasarTab();
    wrap.replaceChildren(h('h2', { class: 'wtitle' }, 'Kalkulator Zakat'), tabs, ...body);
    if (tab === 'maal') drawMaal(); else if (tab === 'hasil') drawHasil();
  }
  draw();
  return wrap;
}
