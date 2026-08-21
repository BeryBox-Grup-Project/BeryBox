# BeryBox CMS

Aplikasi admin BeryBox (repo terpisah dari client user). React + Vite, port **4174**. Backend yang sama: `http://localhost:3000`.

Tidak ada register. Login hanya akun `admin` yang di-seed.

## Menjalankan

```bash
cp .env.example .env
npm install
npm run dev     # http://127.0.0.1:4174
```

Backend harus jalan (`cd ../server && npm run dev`). CMS mem-proxy `/login` dan `/admin` ke port 3000, jadi login tidak tergantung CORS.

Kalau ganti API URL, restart `npm run dev` di folder `cms`.

## Akun seed

| Email | Password |
|---|---|
| `admin@berybox.com` | `Admin123!` |

## Halaman

| Route | Isi |
|---|---|
| `/login` | Login admin saja |
| `/` | Dashboard statistik |
| `/organizations` | Verifikasi organisasi + riset AI |
| `/reports` | Keluhan: resolve, warn, ban |

User biasa masuk lewat client di `http://127.0.0.1:5173`. CMS **bukan** port 5173/5174.
