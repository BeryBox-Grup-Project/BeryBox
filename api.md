# BeryBox API

Base URL: `http://localhost:3000` — tanpa prefix `/api`. JSON camelCase, token login: `access_token`. Error: `{ "message": "English short message" }`. Auth: `Authorization: Bearer <token>`.

Client (5173) dan CMS (4174) memakai path yang sama.

## Enum

- `User.role`: `user` | `organization` | `admin`
- `User.status`: `active` | `warned` | `banned`
- `Item.type`: `public` | `organization` | `barter`
- `Item.status`: `available` | `pending` | `completed` | `cancelled`
- `Request.type`: `claim` | `org_offer` | `barter` | `credit`
- `Request.status`: `pending` | `accepted` | `rejected` | `completed`
- `shipping method`: `pickup` | `courier_agent`
- `Organization.verified`: `unverified` | `pending` | `approved` | `rejected`
- `Notification.type`: `claim` | `offer` | `accepted` | `rejected` | `message` | `shipping_required` | `payment_required` | `tracking_updated` | `delivered` | `warning` | `banned`

## Pagination

`GET /items` dan `GET /organizations` mengembalikan `{ data, page, limit, total, totalPages }`. Query: `page` (default 1), `limit` (default 12, max 50).

## Auth & users

| Method | Path | Auth | Catatan |
|---|---|---|---|
| POST | `/register` | no | role `user` atau `organization` |
| POST | `/login` | no | 201 `{ access_token, user }` |
| POST | `/google-login` | no | body `{ id_token, latitude, longitude }` |
| GET | `/me` | yes | profil + `photoUrl`, `status`, `organization` |
| PATCH | `/me` | yes | username, foto, lokasi |
| GET | `/users/:id` | yes | profil publik + `photoUrl` |
| GET | `/users/:id/reviews` | yes | |
| GET | `/images/auth` | yes | ImageKit signature |

## Items

| Method | Path | Auth |
|---|---|---|
| GET | `/items` | yes — filter `type`, `category`, `q`, `sort`, `ownerId`, `lat`, `lng` |
| GET | `/items/mine` | yes |
| GET | `/items/:id` | yes |
| POST | `/items` | yes |
| PATCH | `/items/:id` | owner |
| POST | `/items/:id/complete` | owner (kebutuhan organisasi) |
| DELETE | `/items/:id` | owner — cancel |

## Requests & history

| Method | Path | Auth |
|---|---|---|
| POST | `/requests` | yes — `claim`, `org_offer`, `barter`, `credit` |
| GET | `/requests/incoming` | yes |
| GET | `/requests/outgoing` | yes |
| GET | `/history` | yes |
| PATCH | `/requests/:id` | yes — `{ status }` `accepted` / `rejected` / `completed` |
| POST | `/requests/:id/shipping` | yes — `{ method, payer? }` |
| POST | `/requests/:id/pay` | yes — Midtrans Snap |
| POST | `/requests/:id/pay/confirm` | yes |
| PATCH | `/requests/:id/tracking` | yes |
| POST | `/requests/:id/redeem-credit` | yes |
| POST | `/midtrans/notification` | no — webhook |

## Organizations

| Method | Path | Auth |
|---|---|---|
| GET | `/places/photo` | yes — proxy foto Places |
| GET | `/organizations` | yes |
| GET | `/organizations/:id` | yes |
| POST | `/organizations` | role organization |
| POST | `/organizations/claim` | role organization — `{ googlePlaceId }` |

## Inbox & notifications

| Method | Path | Auth |
|---|---|---|
| POST | `/conversations` | yes — `{ otherUserId, itemId? }` |
| GET | `/conversations` | yes — `otherUser.photoUrl` |
| GET | `/conversations/:id/messages` | participant |
| POST | `/conversations/:id/messages` | participant — `{ body }` |
| GET | `/notifications` | yes |
| PATCH | `/notifications/:id/read` | yes |
| PATCH | `/notifications/read-all` | yes — `{ scope: "inbox" \| "activity" }` |

## AI, reviews, reports

| Method | Path | Auth |
|---|---|---|
| POST | `/ai/chat` | yes — `{ message, lat?, lng? }` |
| POST | `/ai/match` | yes |
| POST | `/reviews` | yes |
| POST | `/reports` | yes |

## Admin CMS

| Method | Path | Auth |
|---|---|---|
| GET | `/admin/stats` | admin |
| GET | `/admin/organizations` | admin — `?q=` |
| POST | `/admin/organizations` | admin — langsung `approved` |
| PATCH | `/admin/organizations/:id` | admin — `{ verified }` |
| GET | `/admin/reports` | admin |
| PATCH | `/admin/reports/:id` | admin — `{ status: "resolved" }` |
| POST | `/admin/users/:id/warn` | admin |
| POST | `/admin/users/:id/ban` | admin |
| DELETE | `/admin/items/:id` | admin |
| POST | `/admin/ai/organization` | admin |

## Socket.io

Same origin as API. Auth `{ token }`. Events: `join_conversation`, `new_message`, `typing` / `stop_typing`, `new_notification`.
