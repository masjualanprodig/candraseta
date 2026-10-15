// BAITUNA - nav-config.js (v73)
// Satu sumber untuk menu bawah per peran, dipakai di Beranda (app.js) dan di halaman fitur (directory.js).
//  tab : membuka halaman fitur   |  act : membuka bagian di beranda peran   |  home : kembali ke beranda
import { ICONS } from './feed-ui.js';

export const NAV_ITEMS = {
  jamaah: [
    { id: 'nav-home', label: 'Beranda', ic: ICONS.home, home: true },
    { id: 'nav-quran', label: 'Al-Qur’an', ic: ICONS.quran, tab: 'quran' },
    { id: 'nav-dir', label: 'Masjid', ic: ICONS.mosque, tab: 'dir' },
    { id: 'nav-agenda', label: 'Agenda', ic: ICONS.agenda, tab: 'info' },
    { id: 'nav-profil', label: 'Akun', ic: ICONS.user, tab: 'profil' }],
  admin: [
    { id: 'nav-home', label: 'Beranda', ic: ICONS.home, home: true },
    { id: 'nav-pengurus', label: 'Pengurus', ic: ICONS.user, act: 'team' },
    { id: 'nav-kas', label: 'Keuangan', ic: ICONS.zakat, act: 'kas' },
    { id: 'nav-posts', label: 'Agenda', ic: ICONS.agenda, act: 'posts' },
    { id: 'nav-profil', label: 'Akun', ic: ICONS.user, tab: 'profil' }],
  super: [
    { id: 'nav-home', label: 'Beranda', ic: ICONS.home, home: true },
    { id: 'nav-masjid', label: 'Masjid', ic: ICONS.mosque, act: 'masjid' },
    { id: 'nav-audit', label: 'Audit', ic: ICONS.shield, act: 'audit' },
    { id: 'nav-profil', label: 'Akun', ic: ICONS.user, tab: 'profil' }]
};
let kind = 'jamaah';
export const setNavKind = k => { if (NAV_ITEMS[k]) kind = k; };
export const navKind = () => kind;
export const navItems = () => NAV_ITEMS[kind];
