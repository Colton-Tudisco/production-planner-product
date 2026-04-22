from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager
from pathlib import Path
import shutil
import json
import os
from datetime import datetime

from data_processor import process_all, OUTPUT_FILE, UPLOAD_DIR
from pydantic import BaseModel

try:
    from supabase_client import supabase
    SUPABASE_ENABLED = True
except Exception:
    SUPABASE_ENABLED = False

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
    """Return processed data from Supabase if available, fallback to JSON"""
    if SUPABASE_ENABLED:
        try:
            so = supabase.table("sales_orders").select("*").execute().data
            inv = supabase.table("inventory").select("*").execute().data
            bom = supabase.table("bom").select("*").execute().data
            pos = supabase.table("open_pos").select("*").execute().data
            pp = supabase.table("purchased_parts").select("*").execute().data
            attn = supabase.table("bom_attention").select("*").execute().data

            # Remap to the field names the frontend expects
            sales_orders = [{
                "OrderNum": r["order_num"],
                "OrderLine": r["order_line"],
                "OrderRel": r.get("order_rel", ""),
                "PartNum": r["part_num"],
                "PartDescription": r.get("part_description", ""),
                "RemainingQty": r["remaining_qty"],
                "ShipDateStr": r["ship_date_str"],
                "CustID": r.get("cust_id", ""),
                "CustomerName": r.get("customer_name", ""),
                "UOM": r.get("uom", "")
            } for r in so]

            inventory = [{
                "PartNum": r["part_num"],
                "Description": r.get("description", ""),
                "ClassDesc": r.get("class_desc", ""),
                "OnHand": r.get("on_hand", 0),
                "UOM": r.get("uom", "")
            } for r in inv]

            bom_data = [{
                "ParentPart": r["parent_part"],
                "MaterialPart": r["material_part"],
                "MaterialDesc": r.get("material_desc", ""),
                "QtyPer": r.get("qty_per", 0),
                "UOM": r.get("uom", "")
            } for r in bom]

            open_pos = [{
                "PartNum": r["part_num"],
                "TotalOpenQty": r.get("total_open_qty", 0),
                "Description": r.get("description", ""),
                "EarliestDueStr": r.get("earliest_due_str", ""),
                "LatestDueStr": r.get("latest_due_str", ""),
                "SupplierName": r.get("supplier_name", ""),
                "UOM": r.get("uom", "")
            } for r in pos]

            purchased_parts = [{
                "PartNum": r["part_num"],
                "Description": r.get("description", ""),
                "LastPODate": r.get("last_po_date", ""),
                "DaysSinceLastPO": r.get("days_since_last_po"),
                "LastSupplier": r.get("last_supplier", ""),
                "LastUnitPrice": r.get("last_unit_price"),
                "UOM": r.get("uom", ""),
                "POCount": r.get("po_count", 0),
                "TotalQtyOrdered": r.get("total_qty_ordered", 0),
                "OpenOrders": r.get("open_orders", 0),
                "TotalOpenQty": r.get("total_open_qty", 0),
                "EarliestDue": r.get("earliest_due", ""),
                "Stale": r.get("stale", False)
            } for r in pp]

            bom_attention = [{
                "PartNum": r["part_num"],
                "Description": r.get("description", ""),
                "OpenOrders": r.get("open_orders", 0),
                "TotalOpenQty": r.get("total_open_qty", 0),
                "EarliestDue": r.get("earliest_due", ""),
                "Customers": r.get("customers", [])
            } for r in attn]

            return {
                "salesOrders": sales_orders,
                "inventory": inventory,
                "bom": bom_data,
                "openPos": open_pos,
                "poHistory": [],
                "bomAttention": bom_attention,
                "purchasedParts": purchased_parts,
                "processedAt": datetime.now().isoformat()
            }
        except Exception as e:
            print(f"Supabase read error, falling back to JSON: {e}")

    # Fallback to local JSON
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

# ── OVERRIDES ─────────────────────────────────────────────────────────────────

class OverrideIn(BaseModel):
    part_num: str
    override_type: str  # "purchased", "bom_driven", or "hidden"
    note: str = ""

@app.get("/api/overrides")
def get_overrides():
    if not SUPABASE_ENABLED:
        return []
    try:
        res = supabase.table("part_overrides").select("*").execute()
        return res.data
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/overrides")
def upsert_override(body: OverrideIn):
    if not SUPABASE_ENABLED:
        return JSONResponse(status_code=503, content={"error": "Supabase not configured"})
    allowed = {"purchased", "bom_driven", "hidden"}
    if body.override_type not in allowed:
        return JSONResponse(status_code=400, content={"error": f"override_type must be one of {allowed}"})
    try:
        res = supabase.table("part_overrides").upsert({
            "part_num": body.part_num,
            "override_type": body.override_type,
            "note": body.note,
            "updated_at": datetime.now().isoformat()
        }, on_conflict="part_num").execute()
        return res.data
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.delete("/api/overrides/{part_num}")
def delete_override(part_num: str):
    if not SUPABASE_ENABLED:
        return JSONResponse(status_code=503, content={"error": "Supabase not configured"})
    try:
        supabase.table("part_overrides").delete().eq("part_num", part_num).execute()
        return {"success": True}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# ── JOBS ──────────────────────────────────────────────────────────────────────

class JobIn(BaseModel):
    job_id: str
    part_num: str
    part_description: str = ""
    total_qty: float
    to_make: float
    orders: list
    materials: list
    status: str = "active"
    notes: str = ""

@app.get("/api/jobs")
def get_jobs():
    if not SUPABASE_ENABLED:
        return []
    try:
        res = supabase.table("jobs").select("*").eq("status", "active").order("created_at").execute()
        return res.data
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/jobs")
def save_job(body: JobIn):
    if not SUPABASE_ENABLED:
        return JSONResponse(status_code=503, content={"error": "Supabase not configured"})
    try:
        res = supabase.table("jobs").upsert({
            "job_id": body.job_id,
            "part_num": body.part_num,
            "part_description": body.part_description,
            "total_qty": body.total_qty,
            "to_make": body.to_make,
            "orders": body.orders,
            "materials": body.materials,
            "status": body.status,
            "notes": body.notes,
            "updated_at": datetime.now().isoformat()
        }, on_conflict="job_id").execute()
        return res.data
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: str):
    if not SUPABASE_ENABLED:
        return JSONResponse(status_code=503, content={"error": "Supabase not configured"})
    try:
        supabase.table("jobs").delete().eq("job_id", job_id).execute()
        return {"success": True}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})