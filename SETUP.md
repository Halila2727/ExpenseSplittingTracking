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
python init_db.py
```

Start the Flask server:

```bash
python app.py
```

The backend will be running on `http://localhost:5000`

### 2. Frontend Setup

Navigate to the frontend directory and serve the files:

```bash
cd frontend
python -m http.server 8000
npx serve .
```

The frontend will be available at `http://localhost:8000`

### 3. Testing the Application

1. Open `http://localhost:8000` in your browser
2. Click "Start Tracking Now" or "Get Started For Free"
3. Create a new account or use existing account.
4. After login, you'll be redirected to the dashboard

## Features Implemented

## API Endpoints

- `POST /auth/signup` - User registration
- `POST /auth/login` - User login
- `POST /auth/verify` - Token verification
- `GET /ping` - Health check