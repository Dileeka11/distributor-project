# MediStock — Distributor Management System

Full distributor system: inventory, suppliers, customers, cash & credit invoicing,
goods-received notes (GRN), outstanding settlement and live theming.

- **Backend** — Laravel 11 + Sanctum (cookie SPA auth) + MySQL
- **Frontend** — React 19 + TypeScript + Tailwind CSS 3 + Vite + Zustand + axios + react-router

```
distributor-project/
├─ backend/      # Laravel API
└─ frontend/     # React SPA
```

## 1. Backend setup

Prerequisites: PHP 8.2+, Composer, MySQL (XAMPP works).

```bash
cd backend
composer install

# Start XAMPP MySQL, then create the DB:
#   mysql -u root -e "CREATE DATABASE distributor CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

php artisan migrate --seed
php artisan serve              # http://localhost:8000
```

Demo user (seeded):
- **email** — `admin@medistock.lk`
- **password** — `demo1234`

### Environment notes
`backend/.env` is preconfigured for:
- `DB_CONNECTION=mysql`, host `127.0.0.1:3306`, db `distributor`, user `root`, blank password (XAMPP defaults)
- `SANCTUM_STATEFUL_DOMAINS=localhost:5173,localhost,127.0.0.1:5173,127.0.0.1`
- `SESSION_DOMAIN=localhost`, `SESSION_DRIVER=cookie`
- `FRONTEND_URL=http://localhost:5173`

## 2. Frontend setup

Prerequisites: Node 18+.

```bash
cd frontend
npm install
npm run dev                    # http://localhost:5173
```

The Vite dev server proxies `/api` and `/sanctum` to `http://localhost:8000`, so the SPA uses Sanctum's stateful cookie auth out of the box.

Production build:
```bash
npm run build
npm run preview
```

## 3. Architecture

### Backend layout
```
backend/app/
├─ Http/
│  ├─ Controllers/         # Auth, Dashboard, Items, Suppliers, Customers, Invoices, Grn, Settlements, Settings, Categories
│  └─ Requests/            # FormRequest validation per resource
├─ Models/                 # Eloquent models with relations
└─ Services/
   └─ NumberService.php    # Concurrent-safe sequence generator (INV-, GRN-, RCP-, PAY-)
```

Key design choices:
- **Sanctum SPA cookie auth** — CSRF-protected, no token storage in JS.
- **Throttled login** — `throttle:6,1` on `/api/auth/login`.
- **Transactional writes** — `DB::transaction` + `lockForUpdate` for stock, balances, sequence numbers.
- **JSON errors** — `bootstrap/app.php` returns structured JSON for validation (422), auth (401), 5xx on `/api/*`.
- **Centralised settings** — single key/value store with a cached accessor.

### Frontend layout
```
frontend/src/
├─ components/
│  ├─ ui/                  # Button, Badge, Field, Modal, Common
│  ├─ Charts.tsx           # SVG charts — theme-aware
│  ├─ AppShell.tsx         # Sidebar + topbar
│  └─ PageHead.tsx
├─ lib/
│  ├─ http.ts              # axios + Sanctum CSRF bootstrap
│  ├─ format.ts            # money / date helpers
│  ├─ cn.ts                # clsx + tailwind-merge
│  └─ toast.ts
├─ pages/                  # LoginPage, DashboardPage, ItemsPage, SuppliersPage, CustomersPage, InvoicesPage, GrnsPage, OutstandingPage, SettingsPage
├─ store/
│  ├─ auth.ts              # zustand
│  └─ settings.ts          # zustand + live CSS-var theming
├─ types.ts
├─ App.tsx
├─ main.tsx
└─ index.css               # tailwind + design-system tokens (oklch palette)
```

Highlights:
- **CSS custom properties + Tailwind tokens** — accent / surface / text / status colours are CSS vars, so accent and dark-mode changes apply instantly.
- All transactions show live totals/exposure before commit.
- Live favicon generated from accent + monogram.

## 4. Domain model

| Resource | Endpoint(s) | Notes |
|---|---|---|
| Categories | `GET /api/categories` | Read-only list. |
| Items | `GET/POST/PUT/DELETE /api/items` | Manual code, category, distributor/wholesale/retail price, stock. |
| Suppliers | `GET/POST/PUT/DELETE /api/suppliers` | Running `payable`. |
| Customers | `GET/POST/PUT/DELETE /api/customers` | Running `balance` + `credit_limit`. |
| Invoices | `GET/POST /api/invoices`, `GET /api/invoices/{id}` | Cash or credit, **customer only**. Decrements stock. Credit posts unpaid balance to receivable. |
| GRNs | `GET/POST /api/grns`, `GET /api/grns/{id}` | Cash or credit, supplier-side. Increments stock. Credit posts unpaid balance to payable. |
| Outstanding | `GET /api/outstanding` | Receivables (customers) + payables (suppliers). |
| Settlements | `GET/POST /api/settlements` | Receipt or payment — clears balance + applies oldest-first to credit invoices/GRNs. |
| Settings | `GET/PUT /api/settings` | Theme/branding/billing/company. |

## 5. Security notes

- Sanctum SPA cookie auth (HttpOnly session, CSRF via `XSRF-TOKEN` cookie).
- All writes are CSRF-protected and validated via `FormRequest`.
- Login is rate-limited (6/min).
- All transactional writes use DB transactions + `lockForUpdate`.
- Error responses sanitised in production (`APP_ENV=production`).

## 6. Development tips

- `php artisan migrate:fresh --seed` to wipe + reseed.
- `npm run lint` / `npx tsc -p tsconfig.app.json --noEmit`.
- Change accent or dark mode in Settings → Appearance; updates live across the app.
