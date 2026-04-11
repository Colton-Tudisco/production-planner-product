from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager
from pathlib import Path
import shutil
import json
import os

from data_processor import process_all, OUTPUT_FILE, UPLOAD_DIR

@asynccontextmanager
async def lifespan(app):
    if os.environ.get("DEV_MODE", "true").lower() == "true":
        try:
            process_all()
            print("DEV_MODE: Auto-processed test data on startup")
        except Exception as e:
            print(f"DEV_MODE: Auto-process failed: {e}")
    yield

app = FastAPI(title="SEM Production Planner API", lifespan=lifespan)

# Allow React frontend to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── DATA ENDPOINTS ────────────────────────────────────────────────────────────

@app.get("/api/data")
def get_data():
    """Return the processed app data JSON"""
    if not OUTPUT_FILE.exists():
        return JSONResponse(
            status_code=404,
            content={"error": "No data found. Please upload and process your Epicor exports first."}
        )
    with open(OUTPUT_FILE) as f:
        return json.load(f)


@app.post("/api/upload/{file_type}")
async def upload_file(file_type: str, file: UploadFile = File(...)):
    """Accept a single file upload by type"""
    allowed = {
        "sales_orders": "Open_Sales_Orders.xlsx",
        "inventory": "all_inventory_on_hand.xlsx",
        "bom": "BOM.xlsx",
        "open_pos": "Open_POs.xlsx",
        "closed_pos": "Closed_POs.csv",
    }
    if file_type not in allowed:
        return JSONResponse(status_code=400, content={"error": f"Unknown file type: {file_type}"})

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    dest = UPLOAD_DIR / allowed[file_type]
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    return {"success": True, "saved_as": allowed[file_type]}


@app.post("/api/process")
def process_data():
    """Process all uploaded files and generate app_data.json"""
    result = process_all()
    return result


@app.get("/api/status")
def status():
    """Check which data files are present"""
    from data_processor import TEST_DIR, DEV_MODE as dev_mode
    def file_exists(filename):
        if dev_mode and (TEST_DIR / filename).exists():
            return True
        return (UPLOAD_DIR / filename).exists()

    files = {
        "sales_orders": file_exists("Open_Sales_Orders.xlsx"),
        "inventory": file_exists("all_inventory_on_hand.xlsx"),
        "bom": file_exists("BOM.xlsx"),
        "open_pos": file_exists("Open_POs.xlsx"),
        "closed_pos": file_exists("Closed_POs.csv"),
        "processed": OUTPUT_FILE.exists(),
    }
    processed_at = None
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE) as f:
            d = json.load(f)
            processed_at = d.get("processedAt")
    return {"files": files, "processedAt": processed_at}


# ── HEALTH CHECK ──────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}