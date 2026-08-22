# Prompt: bangun frontend BeryBox dari nol

Salin seluruh file ini ke agent frontend. Backend **sudah jadi** di `../server`. Jangan menebak API — kontrak lengkap ada di [`../server/README.md`](../server/README.md). Field, path, enum, dan status code yang tidak ada di backend **jangan diada-adakan**.

Frontend lama sudah dihapus. Scaffold app baru di folder `client/` ini. Folder `.cursor/skills` dan `.cursor/mcp.json` boleh tetap; jangan hapus.

---

## 1. Produk

**BeryBox** = platform donasi + barter barang bekas yang masih layak pakai. Bukan marketplace jual-beli, bukan crypto, bukan gamifikasi koin.

Satu akun login bisa **donor dan penerima**. Role tidak membagi dua aplikasi:

| Role | Boleh |
|---|---|
| `user` | Unggah barang, klaim barang orang, tawar barter/kredit, tawar donasi ke organisasi, chat, review |
| `organization` | Semua milik `user` + daftar/klaim profil organisasi, terima tawaran donasi setelah admin approve |
| `admin` | Login ke **CMS terpisah** (`../cms`, port 5174). Tidak login di client user |

Bahasa UI: **Indonesia**. Error API tetap tampilkan `message` English dari server (boleh dibungkus toast).

---

## 2. Stack (wajib)

- React + Vite + JavaScript (**bukan** TypeScript)
- Tailwind CSS
- React Router
- Redux Toolkit (auth, notifikasi) — **thunk biasa**, bukan `createAsyncThunk`
- React Context hanya untuk socket + UI (toast, drawer bot, reduced-motion)
- Axios ke `http://localhost:3000` — **tanpa** prefix `/api`
- `socket.io-client`
- ImageKit browser upload (`GET /images/auth` dulu, lalu SDK)
- Google Identity Services untuk `POST /google-login`
- Leaflet + tile OpenStreetMap untuk pilih lokasi dan peta organisasi
- Motion: `import { motion, AnimatePresence } from "motion/react"` — **jangan** `framer-motion`
- Ikon Phosphor outline
- Midtrans Snap.js di client untuk bayar ongkir kurir saja

**Jangan pakai:** Google Maps / Places, Cloudinary, multer, TypeScript, shadcn wajib. CMS admin ada di repo/folder `../cms` port 5174, bukan di dalam client user.

Env client:

```
VITE_API_URL=http://localhost:3000
VITE_GOOGLE_CLIENT_ID=
VITE_IMAGEKIT_PUBLIC_KEY=
VITE_IMAGEKIT_URL_ENDPOINT=
VITE_MIDTRANS_CLIENT_KEY=
```

CORS server sudah mengizinkan `http://localhost:5173`.

---

## 3. Desain (warm, merakyat, porto)

Bukan neon, bukan cyber, bukan TikTok pink. Terasa komunitas donasi.

| Token | Nilai |
|---|---|
| Primary (berry) | `#BE185D` — merek + CTA utama |
| Secondary | `#FB7185` |
| Paper background | `#FFF8F4` |
| Ink | `#4A1530` |
| Success / verified | sage `#3F6F5B` |
| Card | `#FFFFFF` solid, rounded besar |
| Glass cream | `rgba(255,248,244,0.72)` + blur 12–16px **hanya** navbar, modal, BeryBot |

Tipografi: Plus Jakarta Sans + Inter. Satu rumpun. Jangan 3 font.

Kartu **putih solid**, bukan kaca. Trust di kartu: foto 4:3, chip tipe, judul, area+jarak, rating atau verified.

Motion hemat: fade+`y:12` setelah skeleton; grid stagger 0.06; hover desktop `y: -4`; tap `scale: 0.98`. Aurora desktop only. Hormati `prefers-reduced-motion`. Maksimal 1–2 elemen bergerak per layar.

Z-index: base 0, sticky 20, overlay 30, bot 40, toast 50.

Kredit tampil teks biasa: `Kredit 100` + tooltip singkat. Bukan koin/XP.

---

## 4. Informasi arsitektur (5 tab)

Desktop: top nav glass cream. Mobile: bottom nav 5 item, target sentuh ≥ 44px.

| Tab | Route | Isi |
|---|---|---|
| Beranda | `/home` | Feed barang **available** |
| Organisasi | `/organizations` | Peta + card panti/komunitas |
| Aktivitas | `/requests` | Incoming/outgoing + shipping + tracking |
| Pesan | `/inbox` | DM |
| Profil | `/profile` | Kredit, rating, item saya, link admin |

Publik (tanpa JWT): `/` landing, `/login`, `/register`.

Route ada tapi tidak di nav: `/items/:id`, `/items/new`, `/items/:id/edit`, `/organizations/:id`, `/organizations/new`, `/users/:id`, `/history`, `/admin/*`, `/barter`.

Guard: `PublicOnly` (landing/login), `ProtectedRoute` (sisanya), `AdminRoute` (`/admin/*`), `OrganizationRoute` (daftar/klaim org).

Banned user (`GET /me` atau login → `403 Account banned`): logout + pesan akun ditangguhkan.

---

## 5. Halaman (detail)

### 5.1 `/` Landing — publik

Sebelum login. Hero foto orang + barang rumah (dokumenter, bukan icon soup). Tiga jalur:

1. Donasikan barang
2. Cari barang / klaim
3. Donasi ke organisasi

Lalu 1 baris kartu contoh (boleh dummy visual), testimoni singkat, CTA daftar/masuk. Jangan paksa peta di landing.

### 5.2 `/login` dan `/register`

Login: email + password. Google Identity → `POST /google-login` `{ id_token, latitude, longitude }`. User Google **baru** wajib kirim koordinat; user lama koordinat opsional.

Register: username, email, password min 8, role `user` | `organization` (default user). **Lokasi 1-tap dulu** (`navigator.geolocation`). Peta Leaflet collapsed: “Atur pin”. Body `POST /register` wajib `latitude` + `longitude` number. Server geocode Nominatim. Register **tidak** mengembalikan token — redirect ke login.

Login sukses `201` `{ access_token, user }`. Simpan token di `localStorage`. Header: `Authorization: Bearer <access_token>`.

### 5.3 `/home` Beranda (setelah login)

Hanya item `status=available`. Query `GET /items?lat=&lng=&q=&type=&category=&page=&limit=`.

Chip filter: Semua / Gratis (`type=public`) / Barter (`type=barter`) / Untuk organisasi (`type=organization`) + kategori.

Kartu barang (`ItemCard`):

- Foto `imageUrl` rasio 4:3 (anti layout shift)
- Chip tipe: Gratis (kertas) / Barter (outline berry) / Organisasi (sage)
- Judul max 2 baris, kondisi, `addressLabel` + `distanceKm`
- `pendingClaimCount` jika > 0 (“2 orang mengantri”)
- Barter: tampilkan juga `wantedTitle` + thumbnail `wantedImageUrl` (punya / mau)

Sold (`completed`) **tidak** muncul — API sudah filter. Empty state + skeleton wajib. Pagination dari `page` / `totalPages`.

### 5.4 `/items/:id` Detail barang

`GET /items/:id?lat=&lng=`.

Isi: foto besar, deskripsi, kondisi, kategori, donor (`owner.username`, `ratingAvg`), jarak, `suggestedShipping`.

Aksi tergantung konteks:

- Bukan milik sendiri + `type=public` → **Klaim** (popup alasan min 20 karakter) → `POST /requests` `{ type: "claim", itemId, reason }`
- `type=organization` → arahkan tawar ke org (bukan klaim publik)
- `type=barter` → pilih barang saya sebagai `itemId`, lawan = `targetItemId`, atau tawar kredit satu arah `{ type: "credit", itemId }`
- **Chat** → `POST /conversations` `{ otherUserId, itemId? }` lalu `/inbox/:id`

Jika `req.user` = owner dan type public: tampilkan daftar `claims` (alasan + rating pemohon). Owner **pilih penerima** dengan accept satu klaim. Accept menolak klaim lain otomatis di server.

Jangan tampilkan `latitude`/`longitude` kecuali API mengirim (hanya setelah request accepted/completed).

### 5.5 `/items/new` Unggah barang

Upload ImageKit: `GET /images/auth` → upload client → simpan URL domain ImageKit saja.

Field: type, title, description min 20, condition, category, lat/lng (default dari profil), `imageUrl`.

Jika `type=barter`: wajib `wantedTitle` + `wantedImageUrl` (foto barang yang dicari) + optional `wantedDescription` / `wantedCategory`. Kartu barter = dua foto: punya / mau.

`creditValue` integer ≥ 0 (untuk selisih barter / tawaran kredit).

### 5.6 `/requests` Aktivitas (inbox donor + status)

Dua tab: Masuk (`GET /requests/incoming`) dan Keluar (`GET /requests/outgoing`).

Alur donasi publik (wajib UI lengkap):

1. Penerima klaim + alasan → pending
2. Donor accept **tanpa** pilih metode kirim
3. **Penerima** pilih `POST /requests/:id/shipping` `{ method: "pickup" | "courier_agent" }`
   - pickup → selesai tanpa bayar
   - kurir → penerima bayar → `POST /requests/:id/pay` → buka Midtrans Snap (`token`, `redirect_url`, `orderId`)
4. Tracking **simulasi** tombol: `PATCH /requests/:id/tracking` `{ trackingStatus: "in_transit" | "delivered" }`
5. Setelah completed: form bintang 1–5 `POST /reviews` `{ requestId, rating, comment? }`

Tampilkan `shipment`: `method`, `paymentStatus`, `trackingStatus`, `grossAmount`.

Barter accept bisa gagal `Insufficient credit`. Setelah barter **rejected**, pemohon boleh `POST /requests/:id/redeem-credit` (bayar kredit satu sisi).

### 5.7 `/organizations` — foto wajib + peta

`GET /organizations?lat=&lng=&q=&type=&page=`. Kirim koordinat user supaya server sync Overpass OSM (gratis, **tanpa Google Maps**).

Wajib:

- **Peta Leaflet** tile OSM, marker organisasi di radius, klik marker → card/detail. Attribution: “Peta OpenStreetMap”
- **Setiap card punya foto cover** `<img src={org.photoUrl}>`. Jangan kartu polos / inisial
- Badge jarak, verified (`approved` = sage centang) vs belum, source `openstreetmap` vs `manual`
- Caption kecil “Foto ilustrasi Unsplash” jika URL unsplash.com (bukan Wikimedia/ImageKit)

`photoUrl` dan `galleryUrls` dari API sudah terisi (Wikimedia atau Unsplash per tipe). `GET /places/photo` sudah mati (404) — jangan pakai.

### 5.8 `/organizations/:id` Detail organisasi

Hero foto besar + gallery `galleryUrls` (1–3). Deskripsi, tipe, alamat, jarak, kontak (`phone`, `website`, `email` jika ada).

Badge verified. `claimed` / `offerChannel`:

- `inbox` (`userId` ada) → tawar donasi `POST /requests` `{ type: "org_offer", itemId, toUserId }` (pilih item milik user)
- `email` / `phone` / `website` → `mailto:` atau tautan eksternal (tempat OSM belum diklaim)
- `none` → teks “Belum ada kanal tawaran”

Role `organization` yang belum punya profil: CTA klaim tempat ini `POST /organizations/claim` `{ googlePlaceId }` — nilai field tetap `googlePlaceId` meski isinya `osm:node:123`.

Jangan tampilkan koordinat kecuali API mengirim.

### 5.9 `/organizations/new`

Hanya role `organization`. Daftar manual jika panti tidak ada di OSM. Upload foto ImageKit. Body: name, type, description min 20, lat/lng, optional email/phone/website/photoUrl/galleryUrls. Status awal `pending` (menunggu admin).

Satu user satu org. Sudah ada → error `Organization already exists`.

### 5.10 `/inbox` dan `/inbox/:id`

List: `GET /conversations` (`otherUser`, `lastMessage`). Room: `GET /conversations/:id/messages`, kirim REST `POST .../messages` dan/atau socket `send_message`.

Socket: `auth: { token: access_token }` (tanpa `Bearer`). Join `user:{id}` otomatis. `join_conversation` `{ conversationId }`. Event `new_message`, `new_notification`.

Header room: nama lawan + `ratingAvg`. Sembunyikan FAB BeryBot di room chat.

### 5.11 `/barter` (halaman tambahan)

Form punya/mau → `POST /ai/match` `{ have, want, category? }`. Tampilkan `reply` + kartu `suggestions` (item barter, `wantedTitle`). Tetap ada grid listing `type=barter` dengan dua foto.

AI: Gemini utama, Groq fallback — client hanya satu endpoint.

### 5.12 `/profile` dan `/users/:id`

Profil sendiri: `GET /me`, kredit, rating, `GET /items/mine`, edit `PATCH /me` `{ username?, photoUrl?, latitude+longitude }`. Link riwayat `/history`. Jika admin: masuk CMS.

Publik: `GET /users/:id` tanpa email/koordinat. `GET /users/:id/reviews`.

### 5.13 `/history`

`GET /history` → `{ donated, received, offered, receivedOffers, barters }`. Kartu selesai + tombol review jika belum.

### 5.14 `/admin/*` CMS (login admin)

Satu app. Halaman:

- Dashboard `GET /admin/stats`
- Organisasi: list semua status, approve/reject `PATCH /admin/organizations/:id` `{ verified }`, riset AI `POST /admin/ai/organization` `{ organizationId }`
- Laporan: `GET /admin/reports`, resolve `PATCH /admin/reports/:id` `{ status: "resolved" }`
- User: warn lalu ban `POST /admin/users/:id/warn` dan `/ban` (dua kali warn → banned)

Laporan user: `POST /reports` `{ targetType, targetId, reason, requestId? }` dari detail item/user/org.

### 5.15 BeryBot (global)

FAB “Tanya Bery”, drawer glass cream, `POST /ai/chat` `{ message }`. `suggestions` jadi kartu klik ke item/org. Sembunyikan di `/inbox/:id`. 502 → “AI sedang sibuk”.

---

## 6. Komponen (wajib ada)

Letakkan di `src/components/`. Jangan satu file raksasa.

**Primitif**

- `Button` (primary berry, secondary, ghost, sage success, destructive)
- `Input`, `Textarea`, `Select`, `Chip`
- `Card` (putih solid)
- `Modal` / `Drawer`
- `Toast` (dari `{ message }` axios interceptor)
- `EmptyState` (ilustrasi lembut + 1 CTA)
- `Skeleton` meniru anatomi kartu
- `PageHeader` (eyebrow, title, description, action)
- `Badge` (verified, pending, jarak)
- `Stars` (input + display)
- `Avatar`

**Domain**

- `ItemCard` — anatomi tetap di atas
- `BarterCard` — dua foto punya/mau
- `OrgCard` — **cover image wajib**, badge verified, jarak, source
- `OrgGallery` — hero + thumbs `galleryUrls`
- `ClaimReasonModal` — textarea min 20
- `ShippingChooser` — pickup vs kurir + ringkasan ongkir dari `suggestedShipping` / `grossAmount`
- `TrackingStepper` — `awaiting_method` → … → `delivered`
- `LocationPicker` — Leaflet OSM, 1-tap geolocation, pin draggable, attribution OSM
- `OrgMap` — marker organisasi, klik → highlight card
- `NotificationTray` — list `GET /notifications`, mark read
- `BeryBot` — FAB + drawer
- `AppShell` — nav 5 tab + tray + bot
- `ProtectedRoute`, `AdminRoute`, `PublicOnly`

---

## 7. State

**Redux**

- `auth`: `access_token`, `user` (`GET /me` bootstrap). Logout hapus token.
- `notifications`: list + unread count dari REST dan socket `new_notification`

Thunk/slice lain: items, requests, organizations, conversations, history, admin.

**Context**

- `SocketProvider`: handshake token, join user room
- `UiProvider`: toast, bot open, reduced-motion

Jangan duplikasi `user` di Context.

Axios interceptor: pasang Bearer; 401 → logout; 403 banned → logout; tampilkan `error.response.data.message`.

---

## 8. Enum (salin persis)

```
User.role: user | organization | admin
User.status: active | warned | banned
Item.type: public | organization | barter
Item.condition: new | like_new | good | fair
Item.category: clothes | books | electronics | furniture | toys | kitchen | other
Item.status: available | pending | completed | cancelled
Request.type: claim | org_offer | barter | credit
Request.status: pending | accepted | rejected | completed
Request.shippingMethod: pickup | courier_agent
Shipment.paymentStatus: not_required | unpaid | paid
Shipment.trackingStatus: awaiting_method | awaiting_payment | ready_for_pickup | preparing | in_transit | delivered
Organization.type: orphanage | volunteer | community | other
Organization.verified: unverified | pending | approved | rejected
Organization.source: manual | openstreetmap | google_places
Notification.type: claim | offer | accepted | rejected | message | shipping_required | payment_required | tracking_updated | delivered | warning | banned
```

JSON camelCase. Token login field-nya `access_token` (snake_case).

---

## 9. Endpoint yang frontend pakai

Base `VITE_API_URL`. Auth Bearer kecuali yang ditandai public.

| Method | Path | Catatan |
|---|---|---|
| POST | `/register` | public, 201, tanpa token |
| POST | `/login` | public, 201 `{ access_token, user }` |
| POST | `/google-login` | public |
| GET/PATCH | `/me` | PATCH: username, photoUrl, lat+lng |
| GET | `/users/:id` | publik profil |
| GET | `/users/:id/reviews` | |
| GET | `/images/auth` | ImageKit signature |
| GET | `/items` | pagination object `{ data, page, limit, total, totalPages }` |
| GET | `/items/mine` | array |
| GET | `/items/:id` | + claims jika owner |
| POST/PATCH/DELETE | `/items`, `/items/:id` | DELETE → cancelled |
| POST | `/requests` | claim / org_offer / barter / credit |
| GET | `/requests/incoming`, `/outgoing` | |
| PATCH | `/requests/:id` | accepted / rejected / completed |
| POST | `/requests/:id/shipping` | setelah accept, oleh penerima |
| POST | `/requests/:id/pay` | Snap Midtrans |
| PATCH | `/requests/:id/tracking` | simulasi |
| POST | `/requests/:id/redeem-credit` | barter rejected |
| GET | `/history` | |
| GET | `/organizations` | kirim lat/lng |
| GET | `/organizations/:id` | foto + gallery |
| POST | `/organizations` | role organization |
| POST | `/organizations/claim` | `{ googlePlaceId: "osm:node:…" }` |
| GET/POST | `/conversations`, `/conversations/:id/messages` | |
| GET/PATCH | `/notifications`, `/notifications/:id/read` | |
| POST | `/reviews`, `/reports` | |
| POST | `/ai/chat`, `/ai/match` | |
| GET | `/admin/stats`, `/admin/organizations`, `/admin/reports` | admin |
| PATCH | `/admin/organizations/:id`, `/admin/reports/:id` | |
| POST | `/admin/users/:id/warn`, `/ban`, `/admin/ai/organization` | |

Webhook `/midtrans/notification` **jangan** dipanggil dari browser.

Jangan panggil `/places/photo`.

Socket events: `new_notification`, `new_message`. Client emit: `join_conversation`, `send_message`.

---

## 10. Aturan privasi & gambar

- Jangan render lat/lng kecuali API mengirim (accepted/completed / milik sendiri).
- Semua upload: URL ImageKit. URL lain → `Invalid image url`.
- Foto org: URL https langsung (Wikimedia / Unsplash / ImageKit).
- Attribution Unsplash di UI jika cover dari `images.unsplash.com`.

---

## 11. Akun seed (lokal)

| Email | Password | Role |
|---|---|---|
| `admin@berybox.com` | `Admin123!` | admin |
| `alice@mail.com` | `Alice123!` | user, kredit 100 |
| `bob@mail.com` | `Bob123!` | user |
| `panti@mail.com` | `Panti123!` | organization, profil pending |

Backend: `cd server && npm run dev` di `http://localhost:3000`.

---

## 12. Urutan kerjakan

1. Vite + Tailwind + Router + axios + token + design tokens
2. Landing, login, register + LocationPicker
3. AppShell 5 tab + ItemCard + home feed + detail + klaim popup
4. Unggah barang + ImageKit (termasuk barter punya/mau)
5. Aktivitas: accept → shipping → Midtrans → tracking → review
6. Organisasi: peta + card foto + detail gallery + claim OSM + offer
7. Inbox + socket
8. BeryBot + `/barter` AI match
9. Profil, history, laporan
10. Admin CMS
11. Empty/skeleton/toast di semua halaman utama

Selesai satu halaman, cocokkan JSON dengan `server/README.md`. Kalau ragu field, baca controller di `server/controllers/` — jangan invent.

---

## 13. Yang tidak dikerjakan

- Google Maps SDK
- Kurir nyata (JNE/GoSend)
- Pencairan kredit ke uang
- Upload lewat server
- Dark mode cyber v1 (light hangat dulu)
- Mengubah backend
