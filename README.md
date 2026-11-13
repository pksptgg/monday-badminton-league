# Monday Badminton League

Sistem live scoring dan liga sosial untuk 7 team, doubles, satu court.

## Mula guna di PC ini

1. Double-click **Buka Monday Badminton League.bat** di Desktop.
2. Browser akan membuka `http://localhost:5173`.
3. Untuk ujian di phone yang sama Wi-Fi, buka alamat `Network` yang muncul dalam tetingkap command.

Jangan tutup tetingkap command semasa aplikasi sedang digunakan. Klik button **Admin** dan masukkan PIN.

**PIN asal: `123456`** — tukar melalui **Admin aktif → Tukar PIN** selepas login pertama.

Tanpa sambungan Supabase, aplikasi berjalan dalam **Demo peranti ini**: data disimpan dalam localStorage browser itu sahaja. Mod online menggunakan database Supabase dan skor disegerakkan antara peranti.

## Peraturan yang dipasang

- Single round robin: 21 perlawanan, 7 pusingan.
- Satu perlawanan doubles, best of 3.
- Game 21 mata, mesti menang dengan beza 2.
- 20–20 diteruskan; maksimum 30–29.
- Menang 2 mata liga, kalah 1, walkover 0.
- Tie-break: beza game, kemudian beza mata badminton.
- Bye tidak mendapat mata.
- Undo rally, pembetulan skor akhir, retired dan walkover disokong.

## Arahan pembangunan

```bash
npm install
npm run dev
npm test
npm run build
```

## Sambungan online

Salin `.env.example` kepada `.env.local`, kemudian isi URL dan anon key Supabase. Jangan masukkan service-role key dalam aplikasi web.

Database menggunakan RPC yang mengesahkan PIN di server. Public hanya boleh membaca `league_state`; tiada akses terus untuk mengubah data.

Struktur utama:

- `src/domain.js` — skor BWF, Undo, retired/walkover dan pembetulan.
- `src/schedule.js` — jadual round robin.
- `src/standings.js` — mata liga dan tie-break.
- `src/stats.js` — statistik pemain/pasangan.
- `src/storage.js` — localStorage atau Supabase.
- `src/App.jsx` — antara muka dan scoring admin.
