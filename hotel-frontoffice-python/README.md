# Hotel FrontOffice+ Dashboard — Python Edition

Local full-stack dashboard using HTML, CSS, JavaScript, FastAPI and SQLite. This avoids the native `better-sqlite3` package that failed to compile on your Windows setup.

## Requirements
- Python 3.11 or newer recommended
- VS Code
- Internet connection for Chart.js CDN (charts), but the backend and SQLite run locally

## Run on Windows / VS Code
1. Extract the ZIP.
2. In VS Code, choose **File → Open Folder** and open the `hotel-frontoffice-python` folder (the one containing `backend` and `frontend`).
3. Open Terminal.
4. Enter the backend folder:
   ```powershell
   cd backend
   ```
5. Create a virtual environment:
   ```powershell
   python -m venv .venv
   ```
6. Activate it:
   ```powershell
   .\.venv\Scripts\Activate.ps1
   ```
   If PowerShell blocks activation, run this for the current terminal only, then activate:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   .\.venv\Scripts\Activate.ps1
   ```
7. Install packages:
   ```powershell
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   ```
8. Start the app:
   ```powershell
   uvicorn main:app --reload
   ```
9. Open `http://127.0.0.1:8000` in your browser.
10. API documentation: `http://127.0.0.1:8000/docs`

## Demo login
- Email: `manager@hotel.test`
- Password: `ChangeMe123!`

The app creates `backend/hotel.db` and seeds demo data on first startup.

## What works
- Login/logout with hashed passwords and signed HTTP-only session cookie
- Dashboard metrics and Chart.js graphs
- Employee list and adding an employee (persisted to SQLite)
- Guest review themes, sample AI insight panel, CSV export
- Responsive English interface

## Important
This is a local development starter, not a production-ready hotel management system. Revenue, room, review, and occupancy figures are sample data. The AI panel contains sample rule-based text, not a connected AI model. Before public deployment, set a long random `HOTEL_SECRET_KEY`, use HTTPS, add CSRF protection, rate limiting, proper user administration/roles, audit logs, backups, and real data integrations. Do not put guest personal data into the sample database without appropriate permission and security controls.


## Upselling workflow upgrade (prototype)

This version adds a manual upselling register with pending/approved/rejected states. Only approved transactions are included in the approval summary. The workflow uses the current legacy manager login and employee list for local demonstration. It is **not yet production-ready multi-tenant SaaS**: employee-specific login, hotel-scoped queries across every endpoint, and subscription enforcement still require a dedicated follow-up phase. Do not expose this prototype to real hotels or public internet.

### Run
1. Back up `backend/hotel.db`.
2. Install dependencies from `backend/requirements.txt` in your Python environment.
3. From the `backend` folder run `python -m uvicorn main:app --host 127.0.0.1 --port 8000`.
4. Sign in with the local demo credentials shown on the login page.
5. Open **Upselling Entry & Approvals**, submit a transaction, and approve/reject it as the demo manager.

SQLAlchemy creates the new `upselling_transactions` table at startup. Existing data is not deleted. The default demo password must never be used for a public deployment.
