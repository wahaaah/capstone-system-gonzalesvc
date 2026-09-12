# How to run and verify Gonzales Vision Clinic system

`node_modules` folders were excluded from this zip (they're large and were
built for a different OS/architecture, which is what broke the production
build earlier). Run `npm install` in each folder as shown below — it only
takes a minute.

## 1. Database

Requires MySQL or MariaDB installed and running locally.

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql      # optional but recommended — see accounts below
```

`schema.sql` creates the database and all 9 tables. `seed.sql` adds three test
login accounts (one per role), one sample patient, and two sample inventory
products, so you have something to click around immediately.

**Test accounts (from seed.sql):**
| Username | Password | Role | Access |
|---|---|---|---|
| `superadmin` | `admin123` | super_admin | Account management + System monitoring ONLY |
| `adminuser` | `admin123` | admin | Full operation: patients, appointments, POS, frames + product inventory |
| `staffuser` | `staff123` | staff | Appointment scheduling + Frames inventory only |

> **Role split:**
> - **Admin** — runs the entire clinic operation: patients, appointments, POS, frames inventory, medical products inventory.
> - **Super-Admin** — scoped to account maintenance (create/activate/deactivate Admin & Staff accounts) and read-only system monitoring (patient/appointment/revenue/stock counts). Cannot touch patient records, POS, or inventory.
> - **Staff** — scheduling + frames inventory only.

## 2. Backend

```bash
cd backend
npm install
```

Check `backend/.env` — it should have:
```
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=         <- set this to your actual MySQL/MariaDB root password
DB_NAME=gonzales_vision_clinic
```

Then start it:
```bash
node server.js
```

You should see `✅ Loaded:` for all seven route files and `Server status: running active on port 5000`.

Quick sanity check from a second terminal:
```bash
curl http://localhost:5000/api/patients
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"username":"superadmin","password":"admin123"}'
```

## 4. Landing page (Guest Virtual Try-On — no login required)

Open `landing/index.html` directly in a browser while the backend is running.

The landing page is a standalone HTML file that:
- Fetches `Converted` frames from the backend API (`/api/frames`) and displays them as clickable cards
- When a guest clicks "Try On", the 3D model loads in a webcam modal using face tracking
- Requires no login or account — this is the public-facing guest module
- Links to the admin portal (`http://localhost:5173`) for booking appointments

> **Important:** The backend must be running first (step 2). The landing page reads
> `data-api="http://localhost:5000"` from the `<body>` tag — change this to your
> server's actual URL/IP if deploying to a different machine.

> **For the VTO to show frames:** add a frame in the admin system (Frames inventory),
> then use the "Convert to 3D" button to mark it as Converted and supply a `.glb` model
> URL. Only `Converted` frames with a `model_3d_url` appear on the landing page.

## 5. File upload (images for frames and products)

Both the Frames inventory and Medical products inventory now have an **Add image** button
instead of a URL text box. Click it to pick a file from your computer — it uploads
immediately and the URL is stored automatically. Uploaded files are served from
`/uploads/` and are visible to both the admin system and the landing page.


```bash
cd frontend/capstone-system
npm install
npm run dev
```

> Note: Tailwind CSS (v4, via `@tailwindcss/vite`) is now installed and
> configured. Previously the components used Tailwind class names but
> Tailwind itself was never installed, so the app would have rendered
> unstyled. This is fixed — `npm run build` produces a real CSS bundle
> containing the actual utility classes used (`bg-blue-600`, `rounded-xl`,
> etc.), verified directly.

Open the URL it prints (usually `http://localhost:5173`). You should land on
a login screen — log in with one of the test accounts above.

## What to click through to verify each feature

- **Login** — log in as `staffuser`; confirm the sidebar only shows
  "Appointment scheduling" and "Frames inventory."
  Log out, log in as `adminuser`; confirm you see the full operational menu
  (Patient info, Scheduling, POS, Frames inventory, Medical products inventory).
  Log out, log in as `superadmin`; confirm you see ONLY "Account management"
  and "System monitoring."
- **Account management** (super-admin only) — create another Admin or Staff
  account, then log out and log in as it to confirm it works. Deactivate
  `adminuser` and confirm it can no longer log in; reactivate it afterward
  so the other steps below still work.
- **System monitoring** (super-admin only) — confirm the dashboard shows
  live counts (patients, appointments, transactions, revenue, frames,
  products, low-stock alerts) and the accounts-by-role breakdown.
- **Patient information** (admin only) — add/edit a patient via the
  directory, then click into their profile. Confirm it shows their real
  name, contact, age, gender, status, and last visit (not placeholder
  text), and that "Clinical Appointment Logs" / "Prescription Records"
  below it show their actual booked appointments and prescriptions.
- **Appointment scheduling** (admin/staff) — book a slot for `P001`,
  confirm it appears on the calendar and can't be double-booked. Then click
  the pencil icon on that booking to open the edit modal: change the time
  to a free slot and confirm it moves; try moving it onto an already-taken
  slot and confirm it's blocked; use "Cancel appointment" and confirm the
  slot frees up again.
- **Point of Sale** (admin only) — pick the appointment you just booked,
  add the seeded products to the cart, checkout. Confirm the total is
  correct and stock quantity drops afterward.
- **Frames inventory** (admin/staff) — add a frame with a description and
  image URL, confirm the thumbnail and description show in the table,
  click "Convert to 3D," confirm status flips to "Converted." (Simulated
  workflow, not a real image-processing pipeline — see code comments.)
- **Medical products inventory** (admin only) — add a product with
  quantity, description, and image URL; confirm it renders as a card with
  the photo, description, and a "low stock" badge once quantity drops to 5
  or below. Edit and delete both work from the card.

## Theme

White-and-blue throughout (Tailwind `blue-*` palette on a white/`slate-50`
base) — this replaced the original indigo/purple accent color used across
every page and component.

## If something doesn't work

- Blank page / network errors in the browser console → backend probably
  isn't running, or `DB_PASSWORD` in `.env` doesn't match your MySQL setup.
- `ECONNREFUSED` from the backend → MySQL/MariaDB isn't running.
- Login fails for the seeded accounts → confirm `seed.sql` actually ran
  (`SELECT * FROM users;` in your DB should show 3 rows).
