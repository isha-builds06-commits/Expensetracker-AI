# ExpenseTracker AI

Personal finance web app: transactions, monthly budget monitor with category breakdown,
Piggy Bank savings challenges, insights, reports (print to PDF), CSV import/export.

## Files
| File | What it is |
|---|---|
| `index.html` | The whole app (HTML + CSS + JavaScript in one file) |
| `server.js` | Backend: serves the app, stores data in `data.json`, REST API, `/admin` data viewer |
| `package.json` | Project info (no packages to install) |
| `start.bat` / `start.sh` | One-click start for Windows / Mac & Linux |

## Run it with the backend (recommended)
1. Install Node.js 18 or newer from https://nodejs.org (one time).
2. Windows: double-click `start.bat`. Mac/Linux: run `sh start.sh`.
   Or in any terminal inside this folder: `node server.js`
3. Open http://localhost:3000 (the start scripts open it for you).
4. See everything that is stored: http://localhost:3000/admin

Your data is saved in `data.json` next to `server.js`. Delete that file to wipe server data.

## Run it without the backend
Just double-click `index.html`. The app works fully and saves in your browser only
(the sidebar shows "Offline · saved in this browser only").

## Using the app
- First screen: sign in, create an account, or press **Try the demo**.
- **Home**: balance, **Add expense** / **Add income**, monthly budget status.
- **Budgets**: set a monthly budget (this month only or every month), see where money went,
  which transactions pushed you over budget, and category limits.
- **Self-test**: runs 22 built-in checks on isolated data (your data is never touched).

## Notes
- The sign-in is a lock for this device only; it is not online account security.
- Insights are rule-based calculations on your own data (no external AI is connected).
- API: `GET/PUT/DELETE /api/state`, `GET /api/summary`, `/api/transactions`,
  `/api/budgets`, `/api/challenges`, `/api/notifications`, `/api/health`.
