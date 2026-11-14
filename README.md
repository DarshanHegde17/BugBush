# BugBash

> **Smart Coding. Better Assessment.**  
> Next-generation AI-powered coding assessment platform for colleges and companies.

---

## ⚡ Quick Start (Run Full Project)

Run the full project (Frontend UI + Backend API + Docs) with **one single command**:

```bash
python run.py
```

> **Windows shortcut:** You can simply type:
> ```cmd
> run
> ```

This single command automatically:
- Checks and installs any missing dependencies
- Launches the unified FastAPI server with hot-reload enabled
- Serves the **Frontend UI** at `http://127.0.0.1:8000/`
- Serves the **Backend API** at `http://127.0.0.1:8000/api/`
- Serves interactive **Swagger API Docs** at `http://127.0.0.1:8000/docs`
- Opens your default web browser to the landing page automatically

---

## Directory Structure

```text
BugBash/
│
├── frontend/
│   ├── index.html
│   ├── pages/
│   ├── css/
│   │   ├── style.css
│   │   └── responsive.css
│   ├── js/
│   │   ├── config.js
│   │   ├── theme.js
│   │   └── main.js
│   └── assets/
│       ├── icons/
│       │   └── logo.svg
│       └── images/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config/
│   │   ├── database/
│   │   │
│   │   ├── models/
│   │   │   ├── super_admin/
│   │   │   ├── organization_admin/
│   │   │   ├── college/
│   │   │   ├── company/
│   │   │   ├── student/
│   │   │   ├── candidate/
│   │   │   └── common/
│   │   │
│   │   ├── schemas/
│   │   ├── routers/
│   │   ├── services/
│   │   ├── authentication/
│   │   ├── permissions/
│   │   ├── ml_engine/
│   │   ├── code_execution/
│   │   ├── monitoring/
│   │   └── utils/
│   │
│   ├── requirements.txt
│   └── .env.example
│
├── desktop_app/
├── tests/
├── docker/
├── run.py          # Unified one-command runner
├── run.bat         # Windows shortcut
└── README.md
```

---

## Alternative Manual Setup

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend (Static Browser Open)
Open `frontend/index.html` directly in your browser or serve using:
```bash
python -m http.server 8080 --directory frontend
```
