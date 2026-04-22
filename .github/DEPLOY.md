# Hostinger FTP Deployment

Three GitHub Actions auto-deploy to Hostinger on push to `main`:

- `.github/workflows/deploy-api.yml` — triggered by changes in `api/`
- `.github/workflows/deploy-web.yml` — triggered by changes in `web/`
- `.github/workflows/deploy-admin.yml` — triggered by changes in `admin/`

Each workflow builds the app, prunes to production deps, and FTPs the result to Hostinger. All three also support manual runs from the Actions tab (`workflow_dispatch`).

## One-time setup

Add these secrets in **GitHub → Settings → Secrets and variables → Actions**:

### Shared (all three workflows)

| Secret | Purpose | Example |
|---|---|---|
| `HOSTINGER_FTP_HOST` | FTP hostname | `files.000webhost.com` / `ftp.pagz.in` |
| `HOSTINGER_FTP_USERNAME` | FTP user | `u741493420` |
| `HOSTINGER_FTP_PASSWORD` | FTP password | (from hPanel) |
| `HOSTINGER_FTP_PORT` | Optional, defaults to `21` | `21` / `22` |
| `HOSTINGER_FTP_PROTOCOL` | Optional, defaults to `ftp`. Use `ftps` for explicit TLS or `sftp` if Hostinger exposes SSH | `ftps` |

### Target directories

| Secret | Purpose | Example |
|---|---|---|
| `HOSTINGER_API_DIR` | Absolute path on server to upload api/ into | `/public_html/api/` |
| `HOSTINGER_WEB_DIR` | Path for web/ | `/public_html/` |
| `HOSTINGER_ADMIN_DIR` | Path for admin/ | `/public_html/admin/` |

### Web build-time env (injected at build, baked into client bundle)

| Secret | Purpose |
|---|---|
| `WEB_NEXT_PUBLIC_API_URL` | `https://pagz.in/api/v1` |
| `WEB_NEXT_PUBLIC_UPLOADS_BASE_URL` | `https://pagz.in` |
| `WEB_NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (or empty if unused) |
| `WEB_NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (or empty) |

### Admin build-time env

| Secret | Purpose |
|---|---|
| `ADMIN_NEXT_PUBLIC_API_URL` | `https://pagz.in/api/v1` |

## Things NOT uploaded (left on server)

Each workflow excludes `.env*` files — so your server-side `.env` with DB credentials, Fast2SMS keys, PhonePe creds etc. stays intact across deploys.

Also excluded:
- `node_modules` **source** (CI uploads a fresh production-pruned install)
- `prisma/migrations/**` for api (run `bun run db:migrate:deploy` manually)
- `.next/cache/**` for web/admin
- Source TypeScript, maps, configs

## Triggering a deploy

- **Automatic:** push to `main` with changes under `api/`, `web/`, or `admin/`
- **Manual:** GitHub → Actions → pick workflow → "Run workflow"

## Rollback

Push a revert commit, or re-run a previous successful workflow run from the Actions UI.

## Notes

- If Hostinger uses SFTP (VPS plan), set `HOSTINGER_FTP_PROTOCOL=sftp` and `HOSTINGER_FTP_PORT=22`.
- First deploy is slow (full upload). Subsequent deploys only sync changed files.
- Node.js app on Hostinger must be restarted separately after api deploys (usually via hPanel Node.js Application → Restart).
- DB migrations are **not** auto-run. Apply with `cd api && bun run db:migrate:deploy` from a trusted machine before relying on schema-dependent code paths.
