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
- Satu perlawanan doubles, 2 game (keputusan 2–0 atau seri 1–1).
- Game 21 mata, mesti menang dengan beza 2.
- 20–20 diteruskan; maksimum 30–29.
- Kedudukan ikut mata: 1 mata setiap game menang (2–0 = 2, 1–1 = 1 seorang, 0–2 = 0). Walkover = 2 mata kepada pemenang.
- Jika mata sama: 2 team → head-to-head; 3 team atau lebih → beza mata badminton (jika tinggal 2 team, head-to-head); masih sama → cabutan undi.
- Lajur Baki menunjukkan perlawanan yang belum dimain.
- Admin boleh tanda team yang hadir dan sistem mencadangkan perlawanan yang belum dimain antara mereka, kemudian umumkan senarai "Perlawanan hari ini".
- Bilangan court (1–4) ditetapkan dalam Tetapan admin. Dengan lebih daripada 1 court, cadangan disusun ikut giliran dan tiada team main di dua court serentak (`src/courts.js`).
- Skor disimpan satu perlawanan pada satu masa (`update_league_match`, `supabase/migrations/003_update_single_match.sql`), jadi dua pengskor di dua court tidak saling menimpa.
- Sesi harian tamat pada waktu yang ditetapkan admin (asal 7:00 ptg, ikut jam telefon). Selepas itu senarai "Petang ni" dan tanda team hadir dikosongkan; perlawanan yang belum dimain kekal untuk sesi seterusnya (`src/session.js`).
- PIN admin: 5 cubaan salah dari peranti yang sama dalam 15 minit akan dikunci selama 15 minit (`supabase/migrations/002_pin_rate_limit.sql`).
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
