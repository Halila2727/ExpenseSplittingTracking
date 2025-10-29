# Centsible Setup Guide

## Quick Start

### 1. Backend Setup

Navigate to the backend directory and set up the environment:

```bash
cd backend
pip install -r requirements.txt
```

Initialize the database:

```bash
python3 init_db.py
```

If you're upgrading an existing local database from an older version, run the migrations instead of re-initializing:

```bash
# run migrations (idempotent; safe to re-run)
python3 migrate_db.py           # adds new expense fields (note, date, category, currency, split_method)
python3 migrate_join_codes.py   # adds and populates group join codes
```

Start the Flask server:

```bash
python3 app.py
```

The backend will be running on `http://localhost:5000`

### 2. Frontend Setup

Navigate to the frontend directory and serve the files:

```bash
cd frontend
python3 -m http.server 8000
npx serve .
```

The frontend will be available at `http://localhost:8000`

## Database Migrations

The backend uses a SQLite database stored as `test.db` in the `backend` directory.

- **Fresh setup**: run `python3 init_db.py` to create all tables. You'll be prompted whether to insert sample data.
- **Existing setup (upgrade)**: when pulling new changes that modify the schema, run the migration scripts from `backend/`:

```bash
cd backend
# optional backup
cp test.db test.db.bak

# apply migrations (safe to run multiple times)
python3 migrate_db.py
python3 migrate_join_codes.py
```

Notes:
- Migrations are idempotent and will skip changes already applied.
- Ensure the Flask server is stopped while running migrations to avoid locking issues.
