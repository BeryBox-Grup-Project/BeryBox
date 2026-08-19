# BeryBox Server — Backend PRD & API Contract

Baca file ini **sebelum** menulis kode. Ini kontrak antara backend dan frontend.

Frontend dikerjakan orang lain, paralel. Kalau path, nama field, enum, atau status code berubah, frontend rusak.

---

## Aturan untuk AI / implementer (wajib)

1. **Jangan ganti** path, method, nama field JSON, enum, atau HTTP status di dokumen ini.
2. **Jangan invent** endpoint, field, atau package di luar daftar. Kalau kurang, tanya dulu.
3. **Jangan pakai** Google Maps, Cloudinary, Midtrans, Redis, MongoDB, TypeScript, atau prefix `/api`.
4. Base URL lokal: `http://localhost:3000` — path langsung `/login`, **bukan** `/api/login`.
5. JSON **camelCase**, kecuali token login: `access_token`.
6. Error body selalu `{ "message": "English short message" }`. Jangan kirim stack trace ke client.
7. `app.js` **export app tanpa `listen`**. `listen` hanya di `bin/www` atau `server.js`.
8. Jangan commit `.env`. Private key Gemini & ImageKit hanya di server.
9. Tes **jangan** hit jaringan nyata (mock Gemini, ImageKit, Nominatim, Socket.io).
10. Coverage statements / branches / functions / lines **> 90%**.

---

## Stack (jangan diganti)

| Pakai | Jangan pakai |
|---|---|
| Node.js, Express, Sequelize, PostgreSQL (`pg`) | MySQL, Mongo, Prisma |
| `dotenv`, `jsonwebtoken`, `bcryptjs` | cookie-session, passport |
| `socket.io` | ws murni |
| Jest + Supertest | Mocha, Vitest |
| `@google/generative-ai`, `imagekit` | OpenAI SDK, Cloudinary |
| `cors`, `helmet`, `express-rate-limit`, `nodemon` | — |

`package.json` sudah berisi express/sequelize/pg/jwt/bcrypt/dotenv. **Tambah** package di atas. `config/config.json` masih template MySQL — **wajib diubah ke postgres** dan baca env.

Scripts yang harus ada:

```json
{
  "start": "node bin/www",
  "dev": "nodemon bin/www",
  "test": "jest --runInBand --forceExit --detectOpenHandles",
  "test:coverage": "jest --runInBand --forceExit --detectOpenHandles --coverage"
}
```

---

## Folder (wajib)

```
server/
  app.js                 # express app, module.exports = app
  bin/www                # http.createServer + socket.io attach + listen
  config/config.json     # postgres, env-based
  controllers/
  routes/index.js
  middlewares/
    authentication.js    # JWT → req.user
    authorization.js     # owner / admin / org
    errorHandler.js
  helpers/
    jwt.js
    bcrypt.js
    haversine.js
    shipping.js
    eligibility.js
    credit.js
    conversationPair.js
    imagekit.js
    nominatim.js
    geoPrivacy.js
  models/
  migrations/
  seeders/
  __tests__/
  .env                   # gitignored
  .env-example.txt
```

---

## Environment

Salin `.env-example.txt` → `.env`. Database:

- development: `berybox_development`
- test: `berybox_test`

Jalankan: `npx sequelize-cli db:create` (kedua env) lalu `db:migrate` dan `db:seed:all`.

Tidak perlu API key untuk Nominatim. Wajib header:

`User-Agent: BeryBox/1.0 (contact@berybox.local)`

---

## Enum (frozen)

Salin persis. String lowercase. Selain ini → `400`.

| Field | Values |
|---|---|
| `User.role` | `user` \| `organization` \| `admin` |
| `Item.type` | `public` \| `organization` \| `barter` |
| `Item.condition` | `new` \| `like_new` \| `good` \| `fair` |
| `Item.category` | `clothes` \| `books` \| `electronics` \| `furniture` \| `toys` \| `kitchen` \| `other` |
| `Item.status` | `available` \| `pending` \| `completed` \| `cancelled` |
| `Request.type` | `claim` \| `org_offer` \| `barter` |
| `Request.status` | `pending` \| `accepted` \| `rejected` \| `completed` |
| `Request.shippingMethod` | `pickup` \| `gosend` \| `jne` \| `jnt` |
| `Organization.type` | `orphanage` \| `volunteer` \| `community` \| `other` |
| `Organization.verified` | `pending` \| `approved` \| `rejected` |
| `Review.rating` | integer `1`–`5` |
| `Report.targetType` | `item` \| `user` \| `organization` |
| `Report.status` | `open` \| `resolved` |
| Notification `type` | `claim` \| `offer` \| `accepted` \| `rejected` \| `message` |

`POST /register` `role` hanya `user` atau `organization`. Default `user`. Role `admin` **hanya** dari seeder.

---

## Models & associations

Semua model Sequelize. Timestamp `createdAt` / `updatedAt` default. Password **jangan** pernah di-return (`defaultScope` exclude `password`).

### User

| Field | Type | Notes |
|---|---|---|
| id | INTEGER PK | auto |
| username | STRING | unique, required |
| email | STRING | unique, required, email format |
| password | STRING | hashed bcrypt (salt 10) |
| role | STRING | enum di atas |
| latitude | FLOAT | required |
| longitude | FLOAT | required |
| addressLabel | STRING | dari Nominatim, bukan input user |
| creditBalance | INTEGER | default `0`, tidak boleh negatif |
| ratingAvg | FLOAT | default `0` |

### Organization

| Field | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| userId | INTEGER FK User | unique: satu user org = satu org profile |
| name | STRING | required |
| type | STRING | enum Organization.type |
| description | TEXT | min 20 chars |
| verified | STRING | default `pending` |
| latitude | FLOAT | |
| longitude | FLOAT | |
| addressLabel | STRING | |

### Item

| Field | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| ownerId | INTEGER FK User | |
| type | STRING | |
| title | STRING | required |
| description | TEXT | min 20 chars |
| condition | STRING | |
| category | STRING | |
| creditValue | INTEGER | default `0`, min `0` |
| latitude | FLOAT | |
| longitude | FLOAT | |
| addressLabel | STRING | |
| imageUrl | STRING | harus URL ImageKit |
| status | STRING | default `available` |

### Request

| Field | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| type | STRING | |
| fromUserId | INTEGER FK User | pemohon |
| toUserId | INTEGER FK User | pemilik item / akun org |
| itemId | INTEGER FK Item | item yang diminta / ditawarkan |
| targetItemId | INTEGER FK Item | nullable; **wajib** jika type `barter` |
| reason | TEXT | wajib min 20 chars jika type `claim`; selain itu nullable |
| shippingMethod | STRING | nullable sampai `accepted`/`completed` |
| status | STRING | default `pending` |

### Conversation

| Field | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| userAId | INTEGER FK User | **selalu** `min(userId1, userId2)` |
| userBId | INTEGER FK User | **selalu** `max(userId1, userId2)` |
| itemId | INTEGER FK Item | nullable |

Unique index `(userAId, userBId)`.

### Message

| Field | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| conversationId | INTEGER FK | |
| senderId | INTEGER FK User | |
| body | TEXT | required, min 1, max 2000 |

### Review

| Field | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| requestId | INTEGER FK | |
| fromUserId | INTEGER FK | |
| toUserId | INTEGER FK | |
| rating | INTEGER | 1–5 |
| comment | TEXT | min 5 chars |

Unique `(requestId, fromUserId)`.

### Report

| Field | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| reporterId | INTEGER FK User | |
| targetType | STRING | |
| targetId | INTEGER | |
| reason | TEXT | min 10 chars |
| status | STRING | default `open` |

### Associations

```
User.hasMany(Item, { foreignKey: "ownerId" })
Item.belongsTo(User, { as: "owner", foreignKey: "ownerId" })

User.hasOne(Organization, { foreignKey: "userId" })
Organization.belongsTo(User, { foreignKey: "userId" })

User.hasMany(Request, { as: "outgoingRequests", foreignKey: "fromUserId" })
User.hasMany(Request, { as: "incomingRequests", foreignKey: "toUserId" })
Request.belongsTo(User, { as: "fromUser", foreignKey: "fromUserId" })
Request.belongsTo(User, { as: "toUser", foreignKey: "toUserId" })
Request.belongsTo(Item, { foreignKey: "itemId" })
Request.belongsTo(Item, { as: "targetItem", foreignKey: "targetItemId" })

User.hasMany(Conversation, { foreignKey: "userAId" })
Conversation.belongsTo(User, { as: "userA", foreignKey: "userAId" })
Conversation.belongsTo(User, { as: "userB", foreignKey: "userBId" })
Conversation.hasMany(Message)
Message.belongsTo(Conversation)
Message.belongsTo(User, { as: "sender", foreignKey: "senderId" })

Request.hasMany(Review)
Review.belongsTo(Request)
```

Tidak ada tabel `City`. Lokasi = GPS nyata.

---

## Helper (wajib, mudah ditest)

### `haversineKm(lat1, lng1, lat2, lng2)` → number

Rumus Haversine, hasil kilometer, 1 desimal di response (`1.2`).

### `suggestShipping(distanceKm)` → `string[]`

- `distanceKm < 10` → `["pickup", "gosend"]`
- selain itu → `["jne", "jnt"]`

Konstanta: `NEARBY_KM = 10`.

### `isItemEligible({ condition, category, description })`

Return `{ eligible: boolean, message: string }`.

Tolak jika:

- `condition` bukan enum
- `category` bukan enum
- `description` < 20 karakter
- `description` (lowercase) mengandung kata: `obat`, `medicine`, `senjata`, `weapon`, `expired`, `kadaluarsa`, `narkoba`, `underwear`, `pakaian dalam`

### `settleCredit(valueA, valueB)` → `{ payer, receiver, amount }`

`payer` = sisi nilai **lebih kecil**, `receiver` = nilai **lebih besar**, `amount = abs(valueA - valueB)`. Jika sama: `amount = 0`.

Saat barter di-accept: potong `amount` dari `creditBalance` payer, tambah ke receiver. Jika payer `creditBalance < amount` → **jangan** accept, `400` `{ "message": "Insufficient credit" }`.

### `normalizeConversationPair(id1, id2)` → `{ userAId, userBId }`

`userAId = Math.min`, `userBId = Math.max`. Jika `id1 === id2` throw error yang jadi `400` `"Cannot chat with yourself"`.

### `isImageKitUrl(url)` → boolean

`url` harus start with `process.env.IMAGEKIT_URL_ENDPOINT`.

### `nominatim.reverse(lat, lng)` → `addressLabel`

Fetch OSM reverse geocode. Timeout wajar. Jika gagal: fallback `"Unknown location"`. **Jangan** unggah lat/lng user ke log.

Parser label: pakai `suburb` / `village` / `city_district` + `city` / `town` / `county`. Contoh: `"Coblong, Bandung"`.

### `stripCoordinates(itemOrUser)` untuk response publik

Hapus `latitude` dan `longitude` sebelum `res.json`, kecuali:

- user melihat `/me` (punya sendiri)
- peserta request berstatus `accepted` atau `completed` melihat detail request/item untuk pickup

Tambah `distanceKm` jika query `lat` & `lng` ada.

---

## State machine (wajib sama dengan frontend)

### Item

```
available  --claim/offer/barter accepted-->  pending
pending    --request completed------------>  completed
available  --owner delete/cancel---------->  cancelled
```

Hanya item `available` yang bisa di-claim / di-offer / di-barter. `PATCH`/`DELETE` item hanya jika status `available` dan requester = owner.

### Claim (`Request.type = claim`)

1. `POST /requests` → status `pending`. Item tetap `available` (boleh banyak claim).
2. Owner `PATCH` `{ "status": "accepted", "shippingMethod": "pickup" }`:
   - request ini → `accepted`
   - **semua** claim `pending` lain untuk `itemId` yang sama → `rejected`
   - item → `pending`
   - find-or-create `Conversation` pair owner + claimer
   - emit `new_notification` type `accepted` ke claimer, `rejected` ke yang lain
3. Owner atau claimer `PATCH` `{ "status": "completed" }` → request `completed`, item `completed`.
4. Baru boleh `POST /reviews`.

### Org offer (`org_offer`)

1. Target `toUserId` harus user `role=organization` yang `Organization.verified === "approved"`.
2. Item type boleh `public` atau `organization`, status `available`.
3. Accept oleh akun org: sama seperti claim (item `pending`, conversation, notif).
4. Org `pending` / `rejected` → `403` `"Organization is not verified"`.

### Barter

1. `POST /requests` `{ type: "barter", itemId, targetItemId }`
   - `itemId` = barang **pemohon** (fromUser harus owner)
   - `targetItemId` = barang **lawan**, type `barter`, status `available`
   - kedua owner berbeda
2. Lawan accept:
   - hitung `settleCredit(item.creditValue, targetItem.creditValue)`
   - jika amount > 0 dan saldo payer kurang → `400` `"Insufficient credit"`
   - jika cukup: pindahkan credit, kedua item `completed`, request `completed`
   - conversation pair
3. Lawan reject → request `rejected`, item tetap `available`.
4. Setelah **rejected**, pemohon boleh `POST /requests/:id/redeem-credit`:
   - bayar `targetItem.creditValue` dari saldo pemohon
   - jika kurang → `400` `"Insufficient credit"`
   - `targetItem` → `completed`, item pemohon tetap `available`
   - request status → `completed`
   - conversation pair

### Organization profile

Register `role=organization` **tidak** membuat row Organization. User harus `POST /organizations` (verified `pending`). Admin `PATCH /admin/organizations/:id` `{ "verified": "approved" }` dulu baru bisa terima offer.

### Selesai transaksi → rating

`POST /reviews` hanya jika request `completed`. Satu review per `(requestId, fromUserId)`. Boleh kedua belah pihak. Setelah create, hitung ulang `User.ratingAvg` milik `toUserId` = rata-rata semua review yang dia terima.

---

## HTTP & auth

| Kode | Kapan |
|---|---|
| 200 | GET, PATCH, DELETE sukses |
| 201 | POST create sukses (termasuk login & register) |
| 400 | validasi, enum salah, saldo kurang, body tidak lengkap |
| 401 | tidak ada / JWT invalid |
| 403 | bukan owner / bukan admin / org belum verified |
| 404 | entity tidak ada |

Header auth: `Authorization: Bearer <access_token>`.

Rate limit:

- `POST /login` max 10 / 15 menit / IP
- `POST /conversations/:id/messages` max 60 / menit / user

CORS origin: `CLIENT_ORIGIN` dan `CMS_ORIGIN` saja. `helmet()` nyala.

JWT payload: `{ id, email, role }`. Expire dari `JWT_EXPIRES_IN`.

---

## API

Semua JSON. Field yang tidak ada di contoh **jangan ditambah** ke response publik (boleh ada `createdAt` / `updatedAt`).

Urutan route Express: `/items/mine` **sebelum** `/items/:id`.

### Auth

#### `POST /register` — public — 201

Body:

```json
{
  "username": "alice",
  "email": "alice@mail.com",
  "password": "Alice123!",
  "role": "user",
  "latitude": -6.8915,
  "longitude": 107.6107
}
```

- `role` opsional, default `"user"`. Nilai lain selain `user`/`organization` → 400.
- `password` min 8 karakter.
- Server panggil Nominatim, simpan `addressLabel`.
- Jangan simpan password plain.

Response:

```json
{
  "id": 2,
  "username": "alice",
  "email": "alice@mail.com",
  "role": "user",
  "creditBalance": 0,
  "ratingAvg": 0,
  "addressLabel": "Coblong, Bandung",
  "latitude": -6.8915,
  "longitude": 107.6107
}
```

Tidak mengembalikan `access_token`. Client login setelah register.

#### `POST /login` — public — 201

Body:

```json
{
  "email": "alice@mail.com",
  "password": "Alice123!"
}
```

Response:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "username": "alice",
    "email": "alice@mail.com",
    "role": "user",
    "creditBalance": 0,
    "ratingAvg": 0,
    "addressLabel": "Coblong, Bandung",
    "latitude": -6.8915,
    "longitude": 107.6107
  }
}
```

Salah email/password → `401` `{ "message": "Invalid email or password" }`.

#### `GET /me` — JWT — 200

Shape sama seperti `user` di login (koordinat **boleh**, karena milik sendiri).

---

### Users

#### `GET /users/:id` — JWT — 200

Profil publik. **Tanpa** email, password, latitude, longitude.

```json
{
  "id": 2,
  "username": "alice",
  "role": "user",
  "ratingAvg": 4.5,
  "addressLabel": "Coblong, Bandung"
}
```

---

### ImageKit

#### `GET /images/auth` — JWT — 200

Pakai SDK resmi: `imagekit.getAuthenticationParameters()`.

```json
{
  "token": "xxxx",
  "expire": 1710000000,
  "signature": "yyyy"
}
```

Jangan expose `IMAGEKIT_PRIVATE_KEY`.

---

### Items

Query `lat` & `lng` opsional tapi **wajib** untuk `distanceKm` dan sort terdekat. Jika keduanya ada: sort `distanceKm ASC`. Jika tidak: sort `createdAt DESC`.

#### `GET /items` — JWT — 200

Query: `type` (`public` \| `organization` \| `barter`), `lat`, `lng`, `category`.

Response: **array**. Setiap elemen:

```json
{
  "id": 10,
  "type": "public",
  "title": "Meja belajar",
  "description": "Meja kayu masih kokoh untuk sekolah.",
  "condition": "good",
  "category": "furniture",
  "creditValue": 50,
  "addressLabel": "Coblong, Bandung",
  "distanceKm": 1.2,
  "pendingClaimCount": 2,
  "imageUrl": "https://ik.imagekit.io/demo/meja.jpg",
  "status": "available",
  "owner": {
    "id": 1,
    "username": "fitria",
    "ratingAvg": 4.5
  }
}
```

- `pendingClaimCount`: jumlah `Request` type `claim` status `pending` untuk item itu. Type lain tetap kirim angka `0`.
- **Jangan** kirim `latitude` / `longitude`.
- Default filter: `status=available`. Tidak perlu query status.

#### `GET /items/mine` — JWT — 200

Semua item `ownerId = req.user.id` (semua status). Array, boleh ada koordinat sendiri.

#### `GET /items/:id` — JWT — 200

Shape seperti list **plus**:

- `suggestedShipping`: hasil `suggestShipping(distanceKm)` jika query `lat`/`lng` ada, else `[]`
- jika `req.user.id === ownerId`: field tambahan `claims` (hanya type public):

```json
{
  "claims": [
    {
      "id": 3,
      "fromUserId": 2,
      "reason": "untuk adik yang sekolah, butuh meja belajar",
      "status": "pending",
      "fromUser": { "id": 2, "username": "alice", "ratingAvg": 0 }
    }
  ]
}
```

User lain **tidak** dapat `claims` dan tidak dapat alasan orang lain. Mereka hanya lihat `pendingClaimCount`.

Jika request terkait user ini sudah `accepted`/`completed`, boleh sertakan `latitude` dan `longitude` item.

#### `POST /items` — JWT — 201

Body:

```json
{
  "type": "public",
  "title": "Meja belajar",
  "description": "Meja kayu masih kokoh untuk sekolah.",
  "condition": "good",
  "category": "furniture",
  "creditValue": 50,
  "latitude": -6.8915,
  "longitude": 107.6107,
  "imageUrl": "https://ik.imagekit.io/demo/meja.jpg"
}
```

Validasi: `isItemEligible`, `isImageKitUrl`, geocode → `addressLabel`. Owner = `req.user.id`. Status `available`.

#### `PATCH /items/:id` — JWT, owner, status available — 200

Body parsial: `title`, `description`, `condition`, `category`, `creditValue`, `imageUrl`, `latitude`, `longitude`. Jika lat/lng berubah, geocode ulang.

#### `DELETE /items/:id` — JWT, owner, status available — 200

Soft: set `status` `"cancelled"`. Response `{ "message": "Item cancelled" }`. Jangan hard delete (FK request).

---

### Requests

#### `POST /requests` — JWT — 201

Tiga bentuk body **hanya** ini:

```json
{
  "type": "claim",
  "itemId": 10,
  "reason": "untuk adik yang sekolah, butuh meja belajar"
}
```

```json
{
  "type": "org_offer",
  "itemId": 10,
  "toUserId": 5
}
```

```json
{
  "type": "barter",
  "itemId": 11,
  "targetItemId": 20
}
```

Aturan:

- tidak bisa ke item sendiri / `toUserId` diri sendiri → 400 `"Cannot request your own item"`
- item harus `available`
- claim: `reason` min 20, item type `public`, `toUserId` diisi owner item
- satu user tidak boleh claim ganda yang masih `pending` pada item yang sama → 400 `"Claim already exists"`

Response request:

```json
{
  "id": 3,
  "type": "claim",
  "fromUserId": 2,
  "toUserId": 1,
  "itemId": 10,
  "targetItemId": null,
  "reason": "untuk adik yang sekolah, butuh meja belajar",
  "shippingMethod": null,
  "status": "pending"
}
```

Emit `new_notification` ke `toUserId`.

#### `GET /requests/incoming` — JWT — 200

Array request `toUserId = me`, include `fromUser` (id, username, ratingAvg), `item` (tanpa koordinat kecuali accepted).

#### `GET /requests/outgoing` — JWT — 200

Array `fromUserId = me`.

#### `PATCH /requests/:id` — JWT — 200

Hanya `toUserId` yang boleh `accepted` / `rejected`.  
`completed` boleh `fromUserId` atau `toUserId`, dan status sekarang harus `accepted` (kecuali barter accept yang langsung `completed` — lihat state machine).

Body:

```json
{
  "status": "accepted",
  "shippingMethod": "pickup"
}
```

`accepted` **wajib** `shippingMethod` dan harus salah satu dari `suggestShipping(jarak antara item dan fromUser)`. Jika tidak termasuk → 400 `"Invalid shipping method"`.

#### `POST /requests/:id/redeem-credit` — JWT — 200

Hanya `fromUserId`, hanya jika type `barter` dan status `rejected`. Lihat state machine. Response = request terbaru.

---

### Organizations

#### `GET /organizations` — JWT — 200

Hanya `verified=approved`. Query `lat`, `lng` untuk sort. Array:

```json
{
  "id": 1,
  "userId": 5,
  "name": "Panti Asuhan Melati",
  "type": "orphanage",
  "description": "Panti untuk anak sekolah dasar di Bandung.",
  "verified": "approved",
  "addressLabel": "Cicendo, Bandung",
  "distanceKm": 2.4
}
```

Tanpa koordinat.

#### `GET /organizations/:id` — JWT — 200

Sama + `suggestedShipping` jika ada lat/lng query. Koordinat hanya jika ada request accepted dengan org ini.

#### `POST /organizations` — JWT, role organization — 201

Body:

```json
{
  "name": "Panti Asuhan Melati",
  "type": "orphanage",
  "description": "Panti untuk anak sekolah dasar di Bandung.",
  "latitude": -6.91,
  "longitude": 107.60
}
```

`verified` selalu `pending`. Satu user satu org → jika sudah ada: 400 `"Organization already exists"`.

---

### Conversations (DM kapan saja)

#### `POST /conversations` — JWT — 201 jika baru, 200 jika sudah ada

Body:

```json
{
  "otherUserId": 1,
  "itemId": 10
}
```

`itemId` opsional. Find-or-create pair. Response:

```json
{
  "id": 7,
  "userAId": 1,
  "userBId": 2,
  "itemId": 10
}
```

#### `GET /conversations` — JWT — 200

Inbox: conversation di mana saya `userA` atau `userB`, include `lastMessage` (`id`, `body`, `senderId`, `createdAt`) dan `otherUser` `{ id, username, ratingAvg }`. Sort `updatedAt DESC`.

#### `GET /conversations/:id/messages` — JWT, peserta — 200

Array chronological:

```json
{
  "id": 1,
  "conversationId": 7,
  "senderId": 2,
  "body": "halo, barangnya masih ada?",
  "createdAt": "2026-08-19T10:00:00.000Z"
}
```

#### `POST /conversations/:id/messages` — JWT, peserta — 201

Body: `{ "body": "halo, barangnya masih ada?" }`

Persist, emit socket `new_message` ke room, emit `new_notification` type `message` ke lawan. Response = message object.

---

### AI

#### `POST /ai/chat` — JWT — 200

Body: `{ "message": "ke mana donasi buku anak dekat sini?" }`

Server:

1. Ambil org `approved` + item `public` `available` terdekat (Haversine, max 5).
2. Kirim ke Gemini sebagai konteks + standar barang layak. Model: `process.env.GEMINI_MODEL`.
3. Jangan biarkan model mengarang id. `suggestions` **hanya** dari query DB.

Response **persis**:

```json
{
  "reply": "Dekat kamu ada Panti Asuhan Melati yang sering menerima buku anak.",
  "suggestions": [
    {
      "kind": "organization",
      "id": 1,
      "name": "Panti Asuhan Melati",
      "distanceKm": 2.4
    },
    {
      "kind": "item",
      "id": 10,
      "title": "Meja belajar",
      "distanceKm": 1.2
    }
  ]
}
```

`suggestions` boleh `[]`. Gemini gagal → 502 `{ "message": "AI service unavailable" }`.

System prompt wajib menyebut: jangan sarankan makanan kedaluwarsa, obat, senjata; sarankan hanya id yang ada di konteks.

---

### Reviews & reports

#### `POST /reviews` — JWT — 201

```json
{
  "requestId": 3,
  "rating": 5,
  "comment": "penyerahan cepat dan barang sesuai"
}
```

`toUserId` = lawan di request. Response review + `ratingAvg` terbaru tidak wajib di body (frontend bisa GET /me).

#### `POST /reports` — JWT — 201

```json
{
  "targetType": "item",
  "targetId": 10,
  "reason": "foto tidak sesuai dengan deskripsi barang"
}
```

---

### Admin CMS (role admin)

Semua 403 `{ "message": "Admin access required" }` jika bukan admin.

#### `GET /admin/organizations` — 200

Array **semua** status, termasuk pending. Boleh ada koordinat (internal).

#### `PATCH /admin/organizations/:id` — 200

```json
{ "verified": "approved" }
```

Hanya `approved` atau `rejected`.

#### `GET /admin/reports` — 200

Array, filter query `status` opsional.

#### `PATCH /admin/reports/:id` — 200

```json
{ "status": "resolved" }
```

---

## Socket.io

Attach ke HTTP server yang sama (port 3000).

Handshake:

```js
io.use(async (socket, next) => {
  // socket.handshake.auth.token = access_token tanpa prefix Bearer
});
```

Tanpa token / invalid → tolak koneksi.

Room name: `conversation:{id}` contoh `conversation:7`.

| Arah | Event | Payload |
|---|---|---|
| client → server | `join_conversation` | `{ "conversationId": 7 }` |
| client → server | `send_message` | `{ "conversationId": 7, "body": "halo" }` |
| server → client | `new_message` | `{ "id", "conversationId", "senderId", "body", "createdAt" }` |
| server → client | `new_notification` | `{ "type", "requestId", "conversationId", "message" }` |

`join_conversation`: verifikasi peserta, else ignore.  
`send_message`: sama dengan logika `POST /conversations/:id/messages` (persist + broadcast).

`new_notification.message` contoh: `"alice claimed your item"`. Field `requestId` / `conversationId` boleh `null` jika tidak relevan.

User join personal room `user:{userId}` untuk notifikasi.

---

## Pesan error (pakai string ini)

| Kondisi | message |
|---|---|
| validasi umum | `Validation error` |
| email sudah ada | `Email already registered` |
| username sudah ada | `Username already taken` |
| login gagal | `Invalid email or password` |
| no token | `Invalid token` |
| token rusak | `Invalid token` |
| bukan owner | `Forbidden` |
| bukan admin | `Admin access required` |
| tidak ketemu | `Not found` |
| claim sendiri | `Cannot request your own item` |
| chat sendiri | `Cannot chat with yourself` |
| org belum verify | `Organization is not verified` |
| saldo kurang | `Insufficient credit` |
| item tidak layak | `Item does not meet donation standards` |
| URL gambar salah | `Invalid image url` |
| claim dobel | `Claim already exists` |
| shipping tidak valid | `Invalid shipping method` |
| AI down | `AI service unavailable` |

---

## Seed (wajib, password sudah di-hash)

| Email | Password | Role | Catatan |
|---|---|---|---|
| `admin@berybox.com` | `Admin123!` | admin | untuk CMS |
| `alice@mail.com` | `Alice123!` | user | Bandung, creditBalance `100` |
| `bob@mail.com` | `Bob123!` | user | Bandung |
| `panti@mail.com` | `Panti123!` | organization | buat Organization `Panti Asuhan Melati`, **verified pending** |

Alice punya 1 item `public` available supaya frontend langsung lihat home.

---

## Tes

- Jest + Supertest, `--runInBand`, database `berybox_test`, migrate di `beforeAll`.
- Mock: Gemini, ImageKit `getAuthenticationParameters`, `fetch` Nominatim, socket emit.
- Coverage: `collectCoverageFrom` controllers, helpers, middlewares, routes. Exclude `bin/`, `migrations/`, `seeders/`, `models/index.js`.
- Threshold 90 semua metrik di `jest.config.js`.
- Minimal skenario: register/login, create item invalid ditolak, claim + acc menolak claim lain, nearby sort, strip koordinat, ImageKit url ditolak, org unverified 403, admin approve, DM, insufficient credit, AI mock.

---

## Di luar scope (jangan dikerjakan)

- Integrasi GoSend / JNE / JNT nyata
- Payment / e-wallet / pencairan credit jadi uang
- Upload file lewat server (multer) — client upload ke ImageKit
- Email, OTP, Google OAuth
- Pagination (belum)
- Prefix `/api`
- Google Maps SDK

---

## Urutan implementasi yang disarankan

1. Postgres config + env + `app.js` + errorHandler + CORS
2. Models, migrations, seed
3. Auth + middlewares
4. Items + nearby + claimCount + geoPrivacy + ImageKit auth
5. Requests (claim → org_offer → barter/credit)
6. Conversations + socket
7. Organizations + admin
8. Reviews + reports
9. AI chat
10. Tes sampai coverage > 90%

Selesai satu endpoint, bentuk JSON harus **copy-paste cocok** dengan contoh di dokumen ini.
