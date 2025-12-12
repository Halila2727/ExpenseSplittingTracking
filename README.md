# Centsible
![logo](https://github.com/Halila2727/ExpenseSplittingTracking/blob/main/images/CentsibleLogoAlternate.png)
## The Idea

Centsible is a web application designed to simplify expense sharing and cost-splitting among groups. Whether you're splitting bills with roommates, tracking travel expenses with friends, or managing shared costs with family, Centsible makes it easy to keep track of who paid what and who owes whom.

### Key Features

- **Flexible Expense Splitting**: Split expenses equally, by percentage, exact amounts, or custom configurations to match your group's needs
- **Multiple Groups**: Manage expenses across different groups simultaneously - from roommates to travel buddies
- **Automatic Balance Calculation**: The app automatically calculates net balances, showing who owes money and who is owed
- **Receipt Scanning**: Upload receipts and let OCR technology extract expense details automatically
- **Payment Tracking**: Record payments as they happen to keep balances up-to-date and transparent
- **Categorized Expenses**: Organize expenses by categories (food, transportation, utilities, etc.) for better tracking
- **Activity Feed**: View recent expense and payment activity across all your groups
- **Export Reports**: Generate PDF reports of your expense history and balances

Centsible eliminates the awkwardness of asking friends to pay you back by providing a transparent, automated system for tracking and settling shared expenses.

## Technologies Used:

### Frontend
- **HTML5** - Structure and markup
- **CSS3** - Styling and responsive design
- **JavaScript** - Client-side logic and interactivity
- **GSAP (GreenSock Animation Platform)** - Animations and scroll effects
- **Lenis** - Smooth scrolling library for enhanced scroll animations
- **Three.js** - 3D graphics library for interactive 3D model rendering
- **Google Model Viewer** - 3D logo rendering
- **jsPDF** - PDF report generation

### Backend
- **Python 3** - Server-side programming language
- **Flask** - Web framework and API server
- **Flask-CORS** - Cross-origin resource sharing
- **SQLite** - Relational database management
- **bcrypt** - Password hashing and security
- **PyJWT** - JSON Web Token authentication
- **python-dotenv** - Environment variable management
- **Werkzeug** - WSGI utilities and file handling

### Receipt OCR & Image Processing
- **EasyOCR** - Optical character recognition for receipt text extraction
- **Pillow (PIL)** - Image processing and manipulation
- **pdf2image** - PDF to image conversion
- **Poppler** - PDF rendering utilities

## Setting Up

> **Note:** These instructions are for WSL (Windows Subsystem for Linux) or Linux systems.

### Prerequisites

Install the following prerequisites:

- **Python 3** (comes with pip3)
- **Node.js** and npm

#### Installing Prerequisites
```bash
sudo apt install python3 python3-pip nodejs npm -y
```
For PDF/image OCR functionality, install system binaries:

```bash
sudo apt install poppler-utils -y
```

### Quick Start

#### 1. Backend Setup

Navigate to the backend directory and set up the environment:

```bash
cd backend
pip3 install -r requirements.txt
```

**Initialize the database and start server:**

```bash
python3 init_db.py
python3 app.py
```

The database will be created with the complete, up-to-date schema.
The backend will be running on `http://localhost:5000`

#### 2. Frontend Setup

Navigate to the frontend directory and serve the files:

```bash
cd frontend
python3 -m http.server 8000
```

The frontend will be available at `http://localhost:8000`

### Database

The backend uses a SQLite database stored as `test.db` in the `backend` directory.

- The database file persists between sessions and all data is saved automatically.
- To reset the database, simply delete `test.db` and run `python3 init_db.py` again to create a fresh database with the latest schema.

Currently, uploaded files are stored under `backend/uploads/expenses/<expense_id>/`. Might switch to cloud storage in the future.

## Team Members:
	- Halil Akca
	- Tony Lin
	- Zara Amer
	- Justin Zeng
	- Ahnaf Ahmed