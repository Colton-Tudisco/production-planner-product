from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path
import shutil
import json

from data_processor import process_all, OUTPUT_FILE, UPLOAD_DIR

app = FastAPI(title="SEM Production Planner API")

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
    files = {
        "sales_orders": (UPLOAD_DIR / "Open_Sales_Orders.xlsx").exists(),
        "inventory": (UPLOAD_DIR / "all_inventory_on_hand.xlsx").exists(),
        "bom": (UPLOAD_DIR / "BOM.xlsx").exists(),
        "open_pos": (UPLOAD_DIR / "Open_POs.xlsx").exists(),
        "closed_pos": (UPLOAD_DIR / "Closed_POs.csv").exists(),
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