# BeryBox Client

Frontend BeryBox: aplikasi **user** (donasi, klaim, barter, organisasi). React + Vite + Tailwind CSS v4, terhubung ke backend Express di `../server` (`http://localhost:3000`, tanpa prefix `/api`).

CMS admin adalah aplikasi terpisah di `../cms` (`http://127.0.0.1:4174`). Akun `admin` tidak login di client ini.

## Menjalankan

```bash
npm install
npm run dev     # selalu http://localhost:5173 — tidak pindah ke 5174
npm run build
```

Backend harus jalan lebih dulu (`cd ../server && npm run dev`) supaya login, feed, dan socket bekerja.

## Environment

Salin `.env.example` ke `.env` lalu isi kunci milikmu. Nilai kosong tidak membuat app crash: fitur terkait dinonaktifkan dengan pesan di UI.

| Variabel | Fungsi | Wajib? |
|---|---|---|
| `VITE_API_URL` | Base URL backend | ya (default `http://localhost:3000`) |
| `VITE_GOOGLE_CLIENT_ID` | Tombol Google Identity di `/login` dan `/register` | opsional |
| `VITE_IMAGEKIT_PUBLIC_KEY` | Unggah foto barang dari browser | wajib untuk unggah barang |
| `VITE_IMAGEKIT_URL_ENDPOINT` | Endpoint ImageKit, dipakai backend untuk validasi URL | wajib untuk unggah barang |
| `VITE_MIDTRANS_CLIENT_KEY` | Snap.js untuk bayar ongkir kurir | opsional |
| `VITE_CMS_URL` | Dipakai untuk mengarahkan akun admin ke CMS | opsional (`http://127.0.0.1:4174`) |

## Desain

Layout mengikuti desain Google Stitch **BeryBox Social Platform**. Token warna, radius, spasi, dan tipografi diterjemahkan ke `@theme` Tailwind v4 di `src/index.css` (mis. `bg-primary`, `text-on-surface-variant`, `p-stack-md`, `gap-gutter`). Font: Plus Jakarta Sans (judul) + Inter (teks).

Hero landing dan sisi kiri halaman login memakai `src/assets/herosection.jpg`.

## Struktur

```
src/
  api/            # axios instance + seluruh pemanggilan endpoint backend
  components/
    layout/       # AppShell, top nav desktop, bottom nav mobile
    ui/           # Button, Card, Chip, Badge, Input, Modal, skeleton, empty state
    Cards.jsx     # kartu barang & organisasi
    BeryBot.jsx   # asisten AI mengambang
    LocationPicker.jsx  # Leaflet + tile OpenStreetMap
    RouteGuards.jsx
  context/        # UiContext (toast, drawer bot), SocketContext (socket.io)
  hooks/          # useGeolocation, useImageKitUpload
  lib/labels.js   # enum backend → label Indonesia
  pages/
  store/          # Redux Toolkit: auth + notifications
```

## Halaman

| Route | Isi |
|---|---|
| `/` | Landing publik: hero, tiga jalur (donasi / cari / organisasi), testimoni, CTA |
| `/login`, `/register` | Email-password, Google Identity, pemilih lokasi peta saat daftar |
| `/home` | Feed barang `available` + filter tipe, kategori, pencarian, paginasi |
| `/items/:id` | Detail, klaim, tawar barter, tawarkan ke organisasi, chat, lapor, daftar klaim untuk pemilik |
| `/items/new`, `/items/:id/edit` | Form unggah/ubah barang, unggah foto ke ImageKit |
| `/organizations` | Peta Leaflet + daftar organisasi berfoto (data Overpass OpenStreetMap) |
| `/organizations/:id` | Detail organisasi, galeri, tawarkan donasi, klaim profil |
| `/organizations/new` | Daftarkan organisasi (role `organization`) |
| `/requests` | Aktivitas: permintaan masuk/keluar, stepper pengiriman, bayar ongkir, tracking, ulasan |
| `/inbox` | Percakapan realtime lewat socket.io |
| `/profile`, `/users/:id`, `/history` | Profil, kredit, barang saya, ulasan, riwayat selesai |
| `/barter` | Pencocokan barter berbantuan AI (`POST /ai/match`) + listing barter |

Guard: `/` `/login` `/register` hanya untuk yang belum login; sisanya butuh JWT; `/organizations/new` khusus role `organization`. Akun admin diarahkan ke CMS.

## Akun seed

| Email | Password | Role |
|---|---|---|
| `admin@berybox.com` | `Admin123!` | admin |
| `alice@mail.com` | `Alice123!` | user |
| `ana@mail.com` | `Ana123!` | user |
| `bob@mail.com` | `Bob123!` | user |
| `user01@mail.com` | `User123!` | user dummy |
| `panti@mail.com` | `Panti123!` | organization |
