# PHP + MySQL API (Hostinger Shared Hosting)

This folder contains a lightweight JSON API you can upload to Hostinger and connect to your Hostinger MySQL database.

## Files you upload

Upload everything under:
- `backend/php/public/` (as the web root for the API)
- `backend/php/src/` (one level above web root, so it isn’t publicly accessible)

Typical Hostinger layout:
- `public_html/api/`  → contents of `backend/php/public/`
- `kpt-api-src/`      → contents of `backend/php/src/`

Then edit `public/index.php` to point to the correct `src/bootstrap.php` path if you place `src/` elsewhere.

## Configure credentials (important)

Do **not** put MySQL credentials in the frontend `.env` (`VITE_*` variables get exposed to browsers).

Create `backend/php/src/config.local.php` on the server (not committed) by copying the example:
- `backend/php/src/config.example.php`

`config.local.php` must `return [...]` and include:
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
- `JWT_SECRET` (random string)
- `API_CORS_ORIGIN` (your frontend domain)

## Endpoints (current)

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/signup`
- `GET /api/auth/me`
- `POST /api/auth/change-password`
- `GET /api/student/dashboard`
- `GET /api/student/marks`
- `GET /api/student/attendance`

## Frontend switch

Set this in your Vite frontend `.env`:

`VITE_API_BASE_URL=https://your-domain.com`

(If you accidentally set `VITE_API_BASE_URL` to a URL ending in `/api`, the frontend client will still try to normalize it.)

Then the frontend will use this API for:
- login/signup/profile (AuthContext via `src/services/authService.js`)
- student dashboard/marks/attendance (via `src/services/studentService.ts`)
