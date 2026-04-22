import os
import pandas as pd
import json
from datetime import datetime, date
from pathlib import Path

try:
    from supabase_client import supabase
    SUPABASE_ENABLED = True
except Exception:
    SUPABASE_ENABLED = False

DEV_MODE = os.environ.get("DEV_MODE", "true").lower() == "true"

UPLOAD_DIR = Path(__file__).parent / "data" / "uploads"
TEST_DIR    = Path(__file__).parent / "data" / "test_data"
OUTPUT_FILE = Path(__file__).parent / "data" / "app_data.json"

def get_file(name):
    """Return test_data path in DEV_MODE, otherwise uploads path."""
    if DEV_MODE:
        return TEST_DIR / name
    return UPLOAD_DIR / name


def safe_val(v):
    if pd.isna(v) if not isinstance(v, (list, dict, bool)) else False:
        return None
    if isinstance(v, (datetime, date, pd.Timestamp)):
        return str(v)[:10]
    if isinstance(v, float) and v != v:
        return None
    return v


def process_all():
    errors = []

    # ── LOAD FILES ────────────────────────────────────────────────────────────
    try:
        df_so = pd.read_excel(get_file("Open_Sales_Orders.xlsx"))
    except Exception as e:
        errors.append(f"Sales Orders: {e}")
        df_so = pd.DataFrame()

    try:
        df_inv = pd.read_excel(get_file("all_inventory_on_hand.xlsx"))
    except Exception as e:
        errors.append(f"Inventory: {e}")
        df_inv = pd.DataFrame()

    try:
        df_bom = pd.read_excel(get_file("BOM.xlsx"))
    except Exception as e:
        errors.append(f"BOM: {e}")
        df_bom = pd.DataFrame()

    try:
        df_po = pd.read_excel(get_file("Open_POs.xlsx"))    
    except Exception as e:
        errors.append(f"Open POs: {e}")
        df_po = pd.DataFrame()

    try:
        df_hist = pd.read_csv(get_file("Closed_POs.csv"), encoding="latin-1")
    except Exception as e:
        errors.append(f"Closed POs: {e}")
        df_hist = pd.DataFrame()

    # ── SALES ORDERS ──────────────────────────────────────────────────────────
    if not df_so.empty:
        so = df_so[[
            "SO: Order", "SO: Line", "SO: Rel",
            "SO: Part", "SO: Part Description",
            "remaining Qty", "SO: Ship By", "SO: Need By",
            "Cust. ID", "Name", "SO: UOM"
        ]].copy()
        so.columns = ["OrderNum", "OrderLine", "OrderRel", "PartNum", "PartDescription",
                      "RemainingQty", "ShipBy", "NeedBy", "CustID", "CustomerName", "UOM"]
        so = so[so["RemainingQty"].notna() & (so["RemainingQty"] > 0)]
        so["ShipBy"] = pd.to_datetime(so["ShipBy"], errors="coerce")
        so["NeedBy"] = pd.to_datetime(so["NeedBy"], errors="coerce")
        so["ShipDate"] = so["ShipBy"].combine_first(so["NeedBy"])
        so = so[so["ShipDate"].notna()]
        so["ShipDateStr"] = so["ShipDate"].dt.strftime("%Y-%m-%d")
        so["RemainingQty"] = pd.to_numeric(so["RemainingQty"], errors="coerce").fillna(0)
        so_records = [{k: safe_val(v) for k, v in r.items()}
                      for r in so[["OrderNum", "OrderLine", "OrderRel", "PartNum",
                                   "PartDescription", "RemainingQty", "ShipDateStr",
                                   "CustID", "CustomerName", "UOM"]].to_dict("records")]
    else:
        so_records = []

    # ── INVENTORY ─────────────────────────────────────────────────────────────
    if not df_inv.empty:
        inv = df_inv[[
            "產品物料編碼/Part", "產品物料描述Description",
            "類別描述/Part Class Desc", "庫存量/On Hand", "庫存單位/Inventory UOM"
        ]].copy()
        inv.columns = ["PartNum", "Description", "ClassDesc", "OnHand", "UOM"]
        inv["OnHand"] = pd.to_numeric(inv["OnHand"], errors="coerce").fillna(0)
        inv_agg = inv.groupby("PartNum").agg(
            OnHand=("OnHand", "sum"),
            Description=("Description", "first"),
            ClassDesc=("ClassDesc", "first"),
            UOM=("UOM", "first")
        ).reset_index()
        inv_records = [{k: safe_val(v) for k, v in r.items()} for r in inv_agg.to_dict("records")]
    else:
        inv_records = []

    # ── BOM ───────────────────────────────────────────────────────────────────
    if not df_bom.empty:
        bom = df_bom[df_bom["Level"] == 0][[
            "HUMAN PARENT PART", "HUMAN MATERIAL PART",
            "Material_Desc", "Qty/Parent", "Material Part UOM"
        ]].copy()
        bom.columns = ["ParentPart", "MaterialPart", "MaterialDesc", "QtyPer", "UOM"]
        bom["QtyPer"] = pd.to_numeric(bom["QtyPer"], errors="coerce").fillna(0)
        bom = bom.groupby(["ParentPart", "MaterialPart"]).agg(
            QtyPer=("QtyPer", "sum"),
            MaterialDesc=("MaterialDesc", "first"),
            UOM=("UOM", "first")
        ).reset_index()
        bom_records = [{k: safe_val(v) for k, v in r.items()} for r in bom.to_dict("records")]
    else:
        bom_records = []

    # ── OPEN POs ──────────────────────────────────────────────────────────────
    if not df_po.empty:
        po = df_po[[
            "PO: PO", "PO: Line", "PO: Part Num", "PO: Description",
            "PO Rel: Remaining Qty", "PO Line: Due Date", "PO: Supplier Name", "PO: IUM"
        ]].copy()
        po.columns = ["PONum", "POLine", "PartNum", "Description",
                      "RemainingQty", "DueDate", "SupplierName", "UOM"]
        po = po[po["RemainingQty"].notna() & (po["RemainingQty"] > 0)]
        po["DueDate"] = pd.to_datetime(po["DueDate"], errors="coerce")
        po["RemainingQty"] = pd.to_numeric(po["RemainingQty"], errors="coerce").fillna(0)
        po_agg = po.groupby("PartNum").agg(
            TotalOpenQty=("RemainingQty", "sum"),
            Description=("Description", "first"),
            EarliestDue=("DueDate", "min"),
            LatestDue=("DueDate", "max"),
            SupplierName=("SupplierName", "first"),
            UOM=("UOM", "first")
        ).reset_index()
        po_agg["EarliestDueStr"] = po_agg["EarliestDue"].dt.strftime("%Y-%m-%d")
        po_agg["LatestDueStr"] = po_agg["LatestDue"].dt.strftime("%Y-%m-%d")
        po_records = [{k: safe_val(v) for k, v in r.items()}
                      for r in po_agg[["PartNum", "TotalOpenQty", "Description",
                                       "EarliestDueStr", "LatestDueStr",
                                       "SupplierName", "UOM"]].to_dict("records")]
    else:
        po_records = []

    # ── PO HISTORY ────────────────────────────────────────────────────────────
    if not df_hist.empty:
        today_str = datetime.today().strftime("%Y-%m-%d")
        df_hist["PO: Order Date"] = pd.to_datetime(df_hist["PO: Order Date"], errors="coerce")
        ph = df_hist.groupby("PO: Part Num").agg(
            LastPODate=("PO: Order Date", "max"),
            TotalQtyOrdered=("PO Line: Our Qty", "sum"),
            POCount=("PO: PO", "nunique"),
            LastSupplier=("PO: Supplier Name", "last"),
            Description=("PO: Description", "first"),
            LastUnitPrice=("PO: Unit Price", "last"),
            UOM=("PO: IUM", "first")
        ).reset_index()
        ph.columns = ["PartNum", "LastPODate", "TotalQtyOrdered", "POCount",
                      "LastSupplier", "Description", "LastUnitPrice", "UOM"]
        ph["LastPODateStr"] = ph["LastPODate"].dt.strftime("%Y-%m-%d").where(
            ph["LastPODate"].notna() & (ph["LastPODate"].dt.strftime("%Y-%m-%d") <= today_str), None)
        ph_records = [{k: safe_val(v) for k, v in r.items() if k != "LastPODate"}
                      for r in ph.to_dict("records")]
    else:
        ph_records = []

    # ── CLASSIFY PARTS ────────────────────────────────────────────────────────
    today = datetime.today()
    so_parts = set(r["PartNum"] for r in so_records)
    bom_parents = set(r["ParentPart"] for r in bom_records)
    po_hist_parts = set(r["PartNum"] for r in ph_records)

    # Load overrides from Supabase
    overrides = {}  # part_num -> override_type
    if SUPABASE_ENABLED:
        try:
            res = supabase.table("part_overrides").select("part_num,override_type").execute()
            for row in res.data:
                overrides[row["part_num"]] = row["override_type"]
        except Exception as e:
            print(f"Warning: Could not load overrides from Supabase: {e}")

    # Apply overrides before classification
    for pn, otype in overrides.items():
        if otype == "purchased":
            bom_parents.discard(pn)       # remove from BOM-driven if present
            po_hist_parts.add(pn)          # force into purchased
        elif otype == "bom_driven":
            po_hist_parts.discard(pn)      # remove from purchased if present
            bom_parents.add(pn)            # force into BOM-driven
        # "hidden" is handled below

    no_bom_purchased = (so_parts - bom_parents) & po_hist_parts
    needs_bom_attn = ((so_parts - bom_parents) - po_hist_parts) - set(p for p,t in overrides.items() if t == "hidden")

    ph_idx = {r["PartNum"]: r for r in ph_records}
    so_by_part = {}
    for r in so_records:
        so_by_part.setdefault(r["PartNum"], []).append(r)

    # BOM attention records
    attn_records = []
    for p in needs_bom_attn:
        orders = so_by_part.get(p, [])
        total_open = sum(r["RemainingQty"] for r in orders)
        earliest = min((r["ShipDateStr"] for r in orders), default=None)
        customers = list(set(r["CustomerName"] for r in orders))
        desc = orders[0]["PartDescription"] if orders else ""
        attn_records.append({
            "PartNum": p, "Description": desc,
            "OpenOrders": len(orders), "TotalOpenQty": total_open,
            "EarliestDue": earliest, "Customers": customers
        })
    attn_records.sort(key=lambda x: (x["EarliestDue"] or "9999", -x["TotalOpenQty"]))

    # Purchased parts records
    purchased_records = []
    for p in no_bom_purchased:
        ph = ph_idx.get(p, {})
        orders = so_by_part.get(p, [])
        total_open = sum(r["RemainingQty"] for r in orders)
        earliest = min((r["ShipDateStr"] for r in orders), default=None)
        last_po = ph.get("LastPODateStr")
        stale = False
        days_since = None
        if last_po:
            lp = datetime.strptime(last_po, "%Y-%m-%d")
            days_since = (today - lp).days
            if total_open > 0 and days_since > 540:
                stale = True
        elif total_open > 0:
            stale = True
        purchased_records.append({
            "PartNum": p,
            "Description": ph.get("Description") or (orders[0]["PartDescription"] if orders else ""),
            "LastPODate": last_po,
            "DaysSinceLastPO": days_since,
            "LastSupplier": ph.get("LastSupplier", ""),
            "LastUnitPrice": ph.get("LastUnitPrice"),
            "UOM": ph.get("UOM", ""),
            "POCount": ph.get("POCount", 0),
            "TotalQtyOrdered": ph.get("TotalQtyOrdered", 0),
            "OpenOrders": len(orders),
            "TotalOpenQty": total_open,
            "EarliestDue": earliest,
            "Stale": stale
        })
    purchased_records.sort(key=lambda x: (0 if x["Stale"] else 1, x["EarliestDue"] or "9999"))

    # ── WRITE OUTPUT ──────────────────────────────────────────────────────────
    output = {
        "salesOrders": so_records,
        "inventory": inv_records,
        "bom": bom_records,
        "openPos": po_records,
        "poHistory": ph_records,
        "bomAttention": attn_records,
        "purchasedParts": purchased_records,
        "processedAt": datetime.now().isoformat()
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, separators=(",", ":"), default=str)

    # ── WRITE TO SUPABASE ─────────────────────────────────────────────────────
    if SUPABASE_ENABLED:
        try:
            # Helper to chunk large lists (Supabase has a row limit per request)
            def chunks(lst, n=500):
                for i in range(0, len(lst), n):
                    yield lst[i:i+n]

            # Sales orders — delete all and reinsert
            supabase.table("sales_orders").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
            so_rows = [{
                "order_num": str(r["OrderNum"]),
                "order_line": str(r["OrderLine"]),
                "order_rel": str(r.get("OrderRel", "")),
                "part_num": r["PartNum"],
                "part_description": r.get("PartDescription", ""),
                "remaining_qty": r["RemainingQty"],
                "ship_date_str": r["ShipDateStr"],
                "cust_id": r.get("CustID", ""),
                "customer_name": r.get("CustomerName", ""),
                "uom": r.get("UOM", "")
            } for r in so_records]
            for chunk in chunks(so_rows):
                supabase.table("sales_orders").insert(chunk).execute()

            # Inventory — upsert by part_num
            inv_rows = [{
                "part_num": r["PartNum"],
                "description": r.get("Description", ""),
                "class_desc": r.get("ClassDesc", ""),
                "on_hand": r.get("OnHand", 0),
                "uom": r.get("UOM", "")
            } for r in inv_records]
            for chunk in chunks(inv_rows):
                supabase.table("inventory").upsert(chunk, on_conflict="part_num").execute()

            # BOM — delete all and reinsert
            supabase.table("bom").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
            bom_rows = [{
                "parent_part": r["ParentPart"],
                "material_part": r["MaterialPart"],
                "material_desc": r.get("MaterialDesc", ""),
                "qty_per": r.get("QtyPer", 0),
                "uom": r.get("UOM", "")
            } for r in bom_records]
            for chunk in chunks(bom_rows):
                supabase.table("bom").insert(chunk).execute()

            # Open POs — delete all and reinsert
            supabase.table("open_pos").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
            po_rows = [{
                "part_num": r["PartNum"],
                "total_open_qty": r.get("TotalOpenQty", 0),
                "description": r.get("Description", ""),
                "earliest_due_str": r.get("EarliestDueStr", ""),
                "latest_due_str": r.get("LatestDueStr", ""),
                "supplier_name": r.get("SupplierName", ""),
                "uom": r.get("UOM", "")
            } for r in po_records]
            for chunk in chunks(po_rows):
                supabase.table("open_pos").insert(chunk).execute()

            # Purchased parts — upsert by part_num
            pp_rows = [{
                "part_num": r["PartNum"],
                "description": r.get("Description", ""),
                "last_po_date": r.get("LastPODate", ""),
                "days_since_last_po": r.get("DaysSinceLastPO"),
                "last_supplier": r.get("LastSupplier", ""),
                "last_unit_price": r.get("LastUnitPrice"),
                "uom": r.get("UOM", ""),
                "po_count": r.get("POCount", 0),
                "total_qty_ordered": r.get("TotalQtyOrdered", 0),
                "open_orders": r.get("OpenOrders", 0),
                "total_open_qty": r.get("TotalOpenQty", 0),
                "earliest_due": r.get("EarliestDue", ""),
                "stale": r.get("Stale", False)
            } for r in purchased_records]
            for chunk in chunks(pp_rows):
                supabase.table("purchased_parts").upsert(chunk, on_conflict="part_num").execute()

            # BOM attention — upsert by part_num
            attn_rows = [{
                "part_num": r["PartNum"],
                "description": r.get("Description", ""),
                "open_orders": r.get("OpenOrders", 0),
                "total_open_qty": r.get("TotalOpenQty", 0),
                "earliest_due": r.get("EarliestDue", ""),
                "customers": r.get("Customers", [])
            } for r in attn_records]
            for chunk in chunks(attn_rows):
                supabase.table("bom_attention").upsert(chunk, on_conflict="part_num").execute()

        except Exception as e:
            errors.append(f"Supabase write error: {e}")
            print(f"Supabase write error: {e}")

    return {
        "success": True,
        "errors": errors,
        "counts": {
            "salesOrders": len(so_records),
            "inventory": len(inv_records),
            "bom": len(bom_records),
            "openPos": len(po_records),
            "poHistory": len(ph_records),
            "bomAttention": len(attn_records),
            "purchasedParts": len(purchased_records)
        }
    }


if __name__ == "__main__":
    result = process_all()
    print(json.dumps(result, indent=2))