# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

Three independent apps at repo root (no workspaces/turbo — each has own `package.json`, `node_modules`, `bun.lock`):

- `api/` — Express backend. Bun for dev, Node for prod. Prisma on MariaDB via `@prisma/adapter-mariadb`. Port 3002. Base path `/api/v1` (webhooks at `/api/webhooks`).
- `web/` — Next.js 16 (App Router, React 19, Tailwind 4) customer storefront. Port 3000.
- `admin/` — Next.js 16 admin panel. Port 3001.
- `prompts/` — feature spec drafts (gitignored). `.zip` files at root are deployment snapshots (`web.zip`, `api.zip`, `admin.zip`, numbered history) — gitignored.

Deploy target: Hostinger (prod) + Vercel (`pagz.vercel.app`, `admin-pagz.vercel.app`). Prod domains `pagz.in` / `admin.pagz.in`.

## Common commands

Run inside each app dir (`cd api` / `cd web` / `cd admin`).

```bash
# api
bun run dev                # watch mode, port 3002
bun run build              # prisma generate + tsup -> dist/
bun run start              # node dist/index.js (prod)
bun run lint               # eslint --max-warnings 0
bun run check-types        # tsc --noEmit
bun run db:generate        # prisma generate -> api/generated/prisma
bun run db:migrate         # prisma migrate dev
bun run db:migrate:deploy  # prod migration
bun run db:push            # push schema without migration
bun run db:studio          # prisma studio
bun run db:test-connection # scripts/test-db-connection.ts (NOTE: script file missing; same for check-imports, openapi:generate, db:seed — package.json lists them but scripts/ only has delete-combinations-pricing-rule.ts)

# web / admin (identical scripts)
bun run dev                # next dev (web:3000, admin:3001)
bun run build
bun run start
bun run lint
bun run check-types        # next typegen && tsc --noEmit
```

Lint/typecheck are the only automated checks — no test suite exists.

`api` `postinstall` runs `npm run build` (prisma generate + tsup). Fresh `bun install` in `api/` requires DB env vars reachable or prisma generate will log warnings (the TS codegen still completes).

## Architecture big picture

### Backend (`api/src/index.js`)

Entrypoint is **`.js`** (not TS) — it imports `.js` from TS source files (Node ESM resolution; controllers/routes are `.ts` compiled via `tsup` for prod, run directly by Bun in dev). Do not rename to `.ts`.

Route tree mounted in `src/index.js`:
- `/api/v1/auth` — customer + admin auth (Supabase primary, JWT fallback)
- `/api/v1/admin` — everything admin-gated via `adminAuth` middleware (`routes/admin.ts` is the large mega-router for CRUD over products, categories, orders, coupons, reviews, uploads, carousels, templates, page controller, user management)
- `/api/v1` — public routes (`routes/public.ts`)
- `/api/v1/{cart,wishlist,reviews,coupons,customer,upload,ftp}` — customer-authenticated
- `/api/v1/payment` — PhonePe init/verify (customer auth)
- `/api/webhooks` — PhonePe webhook (public, signature-verified)
- `/api/docs` (Redoc) + `/api/playground` (Swagger UI), both served from `openapi.yaml` at repo root of `api/`

Controllers live in `src/controllers/*.ts` and are large (several are 1.5k–2.5k lines). Two dominant ones:
- `categoryController.ts` (~2.5k) — categories, specifications, specification options, pricing rules, configuration, images, publishing a pricing rule as a `Product`, syncing category changes back to published products.
- `orderController.ts` (~2.5k) — order lifecycle, status history, invoices (PDF via `pdfkit`), tracking, refunds, admin export.
- `couponController.ts` (~2k), `paymentController.ts` (~1.6k), `productController.ts` (~1.5k), `userController.ts` (~1.4k), `reviewController.ts` (~1.5k).

Services in `src/services/`:
- `prisma.ts` — `PrismaClient` with **MariaDB adapter** (schema declares `provider = "mysql"`, but runtime uses `@prisma/adapter-mariadb` with separate `DATABASE_HOST/USER/PASSWORD/NAME` env vars, NOT `DATABASE_URL`). Generated client emitted to `api/generated/prisma/` (not `node_modules`).
- `supabase.ts` — Supabase admin client; optional (auth falls back to JWT if not configured).
- `phonepe.ts` — payment gateway (README still says Razorpay; **code and schema use PhonePe**, fields like `phonePeOrderId`, `phonePeTransactionId`).
- `ftp.ts` — primary file storage. Uploads to Hostinger via `basic-ftp` into `public_html`. Files served back via `https://pagz.in/...`. Temp staging in `api/uploads/ftp-temp/`.
- `s3.ts` — legacy AWS S3 support (old records still have S3 URLs; `next.config.js` of both web and admin keep `*.amazonaws.com` remote patterns for that reason).
- `email.ts`, `otp.ts`, `pdfGenerator.ts`.

Auth middleware (`middleware/auth.ts`):
- `customerAuth` — tries Supabase `getUser(token)` first; if that fails, verifies local JWT with `type: "customer"`. Auto-creates a local `User` row on first Supabase login (keyed by `supabaseId`).
- `adminAuth` — same dual path, then checks `user.isAdmin`. Uses the same `User` table (no separate `Admin` model); `isAdmin`/`isSuperAdmin` flags on `User`.

### Database (`api/prisma/schema.prisma`)

940-line schema. Notable patterns:
- **Dynamic per-category product model**: `Category` → `CategorySpecification` (e.g. "Paper Size") → `CategorySpecificationOption` (e.g. "A4"). `CategoryPricingRule` defines prices keyed by spec combinations (`specificationValues` JSON). A pricing rule can be **published** as a concrete `Product` (`productId` FK, `isPublished`, `generatedFromPricingRule` flag on Product) and resynced. Don't treat `Product` and `CategoryPricingRule` as independent — they're two views of the same thing for "service" categories (print jobs) vs "product" categories (physical SKUs).
- `CategoryTemplate` + `CategoryTemplateForm` (JSON `fields`) drive dynamic form UI on the web frontend.
- `CategoryPageControllerRule` — max-pages limits that depend on selected specification option values (e.g. PDF page count caps per paper size).
- `Order` / `OrderItem` store `metadata` JSON for pricing breakdown, addons, copies, pageCount. `customDesignUrl` on `OrderItem` is a JSON **array** of URLs (multiple uploaded files).
- `PaymentStatus`, `OrderStatus`, `RefundStatus`, `CancelledBy` enums drive status transitions. `OrderStatusHistory` is append-only.
- Addons modeled as many-to-many from `OrderItem`/`CartItem` back to `CategoryPricingRule` (relation name `OrderItemAddons` / `CartItemAddons`) with `PricingRuleType.ADDON`.

Schema changes: after editing `schema.prisma`, run `bun run db:generate` (regenerates into `generated/prisma/`, which `services/prisma.ts` imports via relative path — moving the output breaks imports).

### Frontend — `web/`

- App Router with route groups `(account)` (logged-in area: addresses, orders, profile, settings, wishlist, my-coupons) and public routes (products, cart, checkout, services, offers, coupons, auth, ftp-upload, payment, plus policy pages).
- `contexts/AuthContext.tsx`, `contexts/CartContext.tsx`, `contexts/ProductConfigContext.tsx` are the three provider contexts wrapped at the root layout.
- Data fetching split: `lib/api/*.ts` are raw fetch wrappers per resource; `lib/hooks/use-*.ts` and `hooks/{cart,checkout,orders,products,...}/` are React Query hooks on top of those. Use the hooks from components — don't call `lib/api/*` directly from components.
- `lib/api-client.ts` is the shared fetch wrapper. It reads token from `auth_token` cookie (with legacy fallback to `refreshToken` cookie — don't remove that migration path). Supabase session tokens are mirrored into `auth_token` so the same Bearer flows through to the API.
- Pending-purchase flow: `lib/utils/pending-purchase.ts` persists unauthenticated add-to-cart intent in session storage (product or service, incl. files meta). `lib/utils/auth-redirect.ts` + `lib/utils/pending-cart-intent.ts` handle post-login redirect to `/cart`. See `prompts/feature-auth-post-login-redirect-to-cart.md` for the design.
- `next.config.js` has `trailingSlash: true` — **required**: Hostinger adds server-side redirects for some paths (notably `/orders`) that create `/orders` ↔ `/orders/` loops and break RSC payloads. Don't flip it off.
- Custom webpack `splitChunks` config is present to mitigate chunk-loading errors in prod (dev uses Turbopack).
- Images: primary host is `pagz.in` (FTP-served); legacy `*.s3.*.amazonaws.com` kept in `remotePatterns`.

### Frontend — `admin/`

- Same App Router pattern with `(auth)/login` and `(dashboard)/*` route groups.
- `lib/api/*.service.ts` — client-side resource services; `lib/server/*-data.ts` — server-side fetchers for RSC pages.
- `lib/api/api-client.ts` decodes JWT locally to check expiry before each request (doesn't verify — just reads `exp`). Token lives in a cookie set by admin login.
- `admin/next.config.js` allows **any HTTPS domain** in `remotePatterns` (fallback `hostname: "**"`) — admin previews arbitrary DB-stored image URLs.

### API base URL

Web & admin both read `NEXT_PUBLIC_API_URL`, default `http://localhost:3002/api/v1`. Prod points at the deployed api.

## Cross-cutting conventions

- **Don't trust the api README** — it's stale in two places: says "PostgreSQL" (actually MariaDB) and "Razorpay" (actually PhonePe). Schema + services are the source of truth.
- Controllers return via `utils/response.ts` (`sendSuccess`/`sendError`) and throw from `utils/errors.ts` (`UnauthorizedError`, `ForbiddenError`, etc.) — `middleware/errorHandler.ts` catches at the end of the chain.
- Add new admin endpoints to `routes/admin.ts` (already mounted under `adminAuth`); don't re-add auth middleware per-route.
- Add new customer endpoints under an existing resource router (`cart.ts`, `wishlist.ts`, etc.) so `customerAuth` coverage stays consistent.
- CORS origins are hard-coded in `src/index.js` (localhost, `pagz.in`, `admin.pagz.in`, Vercel previews, two Hostinger staging subdomains). New deploy origins go there plus/or via `CORS_ORIGINS` env.
- File uploads: prefer FTP (`services/ftp.ts`, `middleware/upload-ftp.ts`). S3 middleware (`upload-s3.ts`) exists but is legacy.
- When deleting dead code, remember `.zip` snapshots at repo root are historical build artifacts — ignore them; don't treat as source.

make sure all the code should be super high optimization and super reusable and super  maintainable and super higly refactored
