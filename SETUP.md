# Centsible Setup Guide

## Quick Start

### 1. Backend Setup

Navigate to the backend directory and set up the environment:

```bash
cd backend
pip install -r requirements.txt
```

Initialize the database and start server:

```bash
python3 init_db.py
python3 app.py
```

The database will be created with the complete, up-to-date schema.
The backend will be running on `http://localhost:5000`

### 2. Frontend Setup

Navigate to the frontend directory and serve the files:

```bash
cd frontend
python3 -m http.server 8000
```

The frontend will be available at `http://localhost:8000`

## Database

The backend uses a SQLite database stored as `test.db` in the `backend` directory.

- The database file persists between sessions and all data is saved automatically.
- To reset the database, simply delete `test.db` and run `python3 init_db.py` again to create a fresh database with the latest schema.