# Social-Feed

A full-stack social platform (React + Express + MongoDB + Socket.IO) with its own brand, a dark/light design system and a security-first API. Everything runs on free tiers.


## 1. Stack (and why)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 18 + Vite, React Router, plain CSS design tokens | No UI library, small bundle. JavaScript (not TypeScript) to keep the code approachable. |
| Backend | Node 18+ / Express 4, REST + Socket.IO | `routes → services → models`, central error handler, zod validation. |
| Database | MongoDB Atlas (Mongoose) | One database only. Relationships (likes, follows, bookmarks) are separate collections with unique indexes. |
| Realtime | Socket.IO | Writes go through REST; sockets carry presence, typing and server→client pushes. |
| Media | Cloudinary (free) with local-disk fallback | Behind `services/storage.js`; swappable. |
| E-mail | Resend (free) with console fallback | Behind `services/mailer.js`; swappable. |
| Hosting | Vercel (frontend) + Render (backend) | See section 7. |

## 2. Free-tier services and limits

Quotas change; **verify them on each provider's pricing page before launch.** Approximate state at time of writing:

| Service | Used for | Free-tier caveats |
|---|---|---|
| MongoDB Atlas M0 | Database | ~512 MB storage, shared CPU, limited connections. |
| Cloudinary | Images/video, auto-format delivery | Credit-based monthly allowance for storage + bandwidth + transforms. |
| Render (free web service) | API + WebSockets | Sleeps after ~15 min idle (30–60 s cold start); local `uploads/` is wiped on redeploy, so use Cloudinary in production. |
| Vercel Hobby | Frontend | Intended for personal / non-commercial use. |
| Resend | Verification & reset e-mails | Small daily/monthly cap; without a verified domain it can only send to your own account address. |

Not used (not needed yet): Firebase push, Sentry, SendGrid. Add them behind the same service-wrapper pattern if you need them.

## 3. Features implemented

- **Accounts:** register, log in (e-mail or username), e-mail verification, forgot/reset password, change password, sign out of all devices, deactivate (log in again to reactivate), permanent delete with cascade, JSON data export.
- **Posts (full CRUD):** text up to 500 chars, up to 4 images/videos, hashtags, @mentions (with notifications), replies and threads, quote posts, reposts (undo), likes, bookmarks, share link, edit within 60 min ("edited" label), delete, pin to profile, sensitive-media blur, report.
- **Feeds:** *For you* (ranked) and *Following* (chronological), Explore, hashtag pages, cursor-based infinite scroll.
- **Social graph:** follow/unfollow, followers/following lists, suggestions, profiles (avatar, cover, bio, location, website, tabs: posts / replies / media / likes), block, mute, muted words.
- **Discovery:** search (posts via full-text, people, hashtags), typeahead, recent searches (stored only in your browser), trending hashtags.
- **Lists:** private curated lists with their own timeline.
- **Realtime chat:** 1-to-1 and group chats, online presence (only shared with people you chat with), typing indicator, read receipts ("Seen"), unread counts, image/video sharing, edit (15 min) and delete of own messages, older-message pagination, "who can message me" setting.
- **Notifications:** like, reply, repost, quote, follow, mention. Live toast + unread badge, preferences per type, Mentions filter.
- **UX:** dark/light/system theme, larger-text option, skeleton loaders, empty/error states, toasts, optimistic updates, responsive (desktop, icon-rail tablet, bottom-nav phone), accessible dialogs/menus/tabs, reduced-motion support.
- **Brand:** original "S" ribbon mark + wordmark, gradient palette, favicon (`client/public/favicon.svg`), logo variants in `components/Logo.jsx` (`LogoMark`, tile, full wordmark).

## 4. Setup

Requirements: Node 18+, a free MongoDB Atlas cluster. Cloudinary and Resend are optional in development.

**MongoDB Atlas:** create an M0 cluster → *Database Access*: add a user → *Network Access*: allow `0.0.0.0/0` (needed for Render) → *Connect → Drivers*: copy the URI, put your password in it and add `/social-feed` before the `?`.

```bash
# backend
cd server
cp .env.example .env     # fill MONGO_URI and JWT_SECRET (see comments in the file)
npm install
npm test                 # unit tests (8)
npm run dev              # http://localhost:5000

# frontend (second terminal)
cd client
cp .env.example .env     # VITE_API_URL=http://localhost:5000
npm install
npm run dev              # http://localhost:5173
```

Without Cloudinary keys uploads are stored in `server/uploads/`. Without a Resend key, verification and reset links are **printed in the server console**.

## 5. Environment variables (`server/.env.example`)

`MONGO_URI`, `JWT_SECRET` (≥ 32 chars in production), `CLIENT_URL` (CORS allow-list + e-mail links), `PUBLIC_URL`, `REQUIRE_VERIFIED_EMAIL` (true = unverified users can't post/message), `CLOUDINARY_*`, `RESEND_API_KEY`, `MAIL_FROM`, `TRENDING_MIN_AUTHORS`. Frontend: `VITE_API_URL`. Secrets are never committed (`.gitignore`), and the server refuses to start if required ones are missing.

## 6. Smoke test (do this first, ~10 minutes)

1. Register two users in two browsers. Check the server console for the verification link and open it.
2. User A posts with a photo and `#hello`; B follows A and sees it in *Following*; B likes, reposts, quotes, replies and bookmarks. A sees live notifications.
3. Open Messages: B messages A. Verify typing indicator, "Seen", edit/delete, an image, then create a group chat.
4. A blocks B: B can no longer open A's profile or message A. Unblock in Settings → Privacy.
5. Settings: change password (other browser is signed out), export data, mute a word.

## 7. Deploy

1. Push to GitHub.
2. **Render:** *New Web Service*, root `server`, build `npm install`, start `npm start`, plan Free. Add all env vars, `NODE_ENV=production`, `PUBLIC_URL` = the Render URL, and Cloudinary keys (local disk is ephemeral there).
3. **Vercel:** import the repo, root `client`, framework Vite, env `VITE_API_URL` = the Render URL. (`vercel.json` already rewrites routes to the SPA.)
4. Put the Vercel URL into `CLIENT_URL` on Render and redeploy. Both sites are served over HTTPS by default.
5. Run `npm audit` in both folders regularly and update dependencies.

## 8. Architecture, API and security notes

```
server/src
  config/       env validation, db
  middleware/   auth (JWT + tokenVersion), validate (zod), sanitize, rateLimit, upload, error
  models/       User, Post, edges (Like/Bookmark/Follow), Notification, Chat, misc (List/Report)
  services/     feed (populate + viewer state + pagination), storage, mailer, notify, trending, access, account
  routes/       auth users posts bookmarks lists search notifications conversations reports
  utils/        pure, unit-tested helpers (text, sanitize, fileType, ranking, toggle)
client/src
  context/      Auth (session + socket), UI (theme, toasts, dialogs)
  components/   design-system pieces, PostCard, Composer, Layout …
  pages/        one file per screen; hooks/useInfinite for cursor scrolling
```

All responses are JSON; errors are `{ "message": "…" }` with proper status codes (400 validation, 401 auth, 403 forbidden, 404, 409 duplicate, 413 too large, 429 rate limit). All routes except register/login/forgot/reset/verify require `Authorization: Bearer <jwt>`.

| Area | Endpoints (permission) |
|---|---|
| Auth `/api/auth` | `POST register, login, verify-email, forgot-password, reset-password` (public, rate-limited) · `GET me`, `POST resend-verification, change-password, logout-all, deactivate`, `DELETE account` (owner; destructive ones re-ask the password) |
| Users `/api/users` | `GET /:username, /:username/followers, /:username/following, /suggestions` · `PUT /me`, `/me/settings`, `/me/muted-words` · `GET /me/blocked, /me/muted, /me/export` · `POST /:id/follow, /:id/block, /:id/mute` |
| Posts `/api/posts` | `POST /` (multipart) · `GET /feed?mode=top\|latest, /explore, /tag/:tag, /user/:id?tab=, /:id, /:id/replies` · `PUT /:id`, `DELETE /:id`, `POST /:id/pin` (**author only**) · `POST /:id/like, /:id/repost, /:id/bookmark` |
| Others | `GET /api/bookmarks` · `/api/lists` CRUD + members + timeline (owner only) · `GET /api/search?q&type`, `/search/suggest`, `/search/trending` · `/api/notifications` (own only) · `POST /api/reports` |
| Chat `/api/conversations` | `GET /`, `POST /`, `GET/POST /:id/messages`, `PUT /:id/read`, `DELETE /:id/leave` (**members only**), `PATCH/DELETE /messages/:id` (sender only) |
| Socket events | server→client: `message:new, message:update, message:read, notification, conversation:new, presence:list, presence:update, typing` · client→server: `typing` |

**Feed ranking ("For you")** = `(likes + 2·reposts + 1.5·replies + 2·quotes + 1) ÷ (ageHours + 2)^1.5` over the last 72 h of posts from people you follow plus any post from the last 24 h with ≥ 2 likes. **Trending** = hashtags in the last 24 h scored `3·distinctAuthors + posts + 0.5·engagement`, needing ≥ `TRENDING_MIN_AUTHORS` different authors, cached 60 s. Both formulas live in `utils/ranking.js` and are unit-tested.

**Security measures implemented**
- bcrypt (cost 12); timing-equalised login; per-IP rate limits and per-account lockout (5 failures → 15 min); reset/verify tokens stored only as SHA-256 hashes; generic answer on "forgot password" (no account enumeration); JWT carries `tokenVersion` so password change / "sign out everywhere" revokes all sessions.
- Input: zod schemas on every body; operator-key stripping (`$ne`, `$where`, dotted keys) on body/query/params; ObjectId params validated; user text escaped before use in regexes; safe fields only on public profiles (never e-mail/settings).
- Authorisation on the server for every write: ownership checks (posts, comments, lists, messages), conversation membership, two-way block checks, DM privacy setting re-checked on each send.
- Uploads: real file type detected from magic bytes (SVG/HTML/executables rejected), size and count limits, random server-side file names, `nosniff` + restrictive CSP on local uploads.
- Helmet, explicit CORS allow-list, request size limit, compression, no stack traces in production, logs never include bodies.
- XSS: React escaping only; post text is rendered from elements, never `dangerouslySetInnerHTML`; external links get `rel="noopener noreferrer nofollow ugc"`.
- CSRF: not applicable by design: authentication uses an `Authorization` header, not cookies.
- **Trade-off:** the JWT is kept in `localStorage`, which an XSS bug could read. The app avoids XSS vectors, but if you need stronger protection move to httpOnly cookies (then add CSRF tokens and `SameSite` handling for the Vercel↔Render cross-site setup).

**Tests:** `cd server && npm test` runs 8 unit tests (text parsing, NoSQL-operator sanitiser, magic-byte detection incl. fake files, feed/trending ranking). These pass.

## 9. Known limitations and outstanding work

**Not tested:** API routes and the React screens were not run against a live MongoDB/browser by the author; there are no integration, component, socket or rate-limit tests yet. Plan: add `supertest` + `mongodb-memory-server` for API/authorisation tests, Vitest + Testing Library for components, and a Playwright run for the smoke test above.

**Not implemented (from the brief):** OAuth (Google/Apple) and multi-factor auth · private accounts and follow requests · communities · polls · link previews · drafts/scheduled posts · "delivered" receipts (only sent/seen) · notifications for direct messages (unread badge instead) · e-mail/push notification delivery (in-app only) · admin/moderation UI (reports are saved to the `reports` collection) · creator analytics · PWA/offline · Sentry monitoring · bookmark collections · data-retention jobs · background job queue.

**Known design limits:** muted-word filtering happens after a page is fetched, so a page can come back with fewer than 15 items (infinite scroll just loads the next one); the "For you" ranking is computed in memory over ≤ 200 candidates, fine for a small/medium community but should move to a precomputed index at scale; Socket.IO runs in one process (add the Redis adapter before scaling to several instances); uploads that fail validation after other files saved can leave orphans in storage.
