import os
import sys
import webbrowser

# Ensure workspace root is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Auto-check dependencies
try:
    import fastapi
    import uvicorn
except ImportError:
    import subprocess
    print("Installing required dependencies...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "backend/requirements.txt"])
    import uvicorn

if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", 8000))
    url = f"http://{host}:{port}"

    print("=" * 55)
    print("           BugBash Assessment Platform  ")
    print("         Smart Coding. Better Assessment.        ")
    print("=" * 55)
    print(f"🚀 Full Project (UI + API): {url}")
    print(f"📖 API Documentation:        {url}/docs")
    print("=" * 55)

    # Open browser automatically
    try:
        webbrowser.open(url)
    except Exception:
        pass

    # Run unified FastAPI + Frontend server
    uvicorn.run("backend.app.main:app", host=host, port=port, reload=True)

