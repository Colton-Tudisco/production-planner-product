# SEM Production Planner

An internal production planning web app for **Schlegel Electronic Materials (SEM)** that turns raw Epicor ERP exports into actionable dashboards for buyers, planners, and production managers. Designed to scale into a standalone SaaS product.

---

## What It Does

The app ingests five Epicor exports, processes them through a material coverage engine, and surfaces five operational views:

| Tab | Purpose |
|-----|---------|
| **Order Status** | All open sales orders with days-to-ship, FG on-hand, material coverage %, and can-ship status |
| **Job Planning** | Select a part, configure a production window, and generate a job card with full raw material requirements |
| **Purchasing Alerts** | Consolidated raw material demand vs. on-hand + open POs, with net short/covered status per material |
| **Purchased Parts** | Confirmed buy-parts with PO history, stale flags (no PO in 540+ days), and open demand |
| **Material Inventory** | Raw material on-hand vs. total demand across all open orders |

A **BOM Attention** side panel flags parts with open orders but no BOM and no PO history — things that need to be either classified or have a BOM loaded in Epicor.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite), Axios |
| Backend | FastAPI (Python 3), Uvicorn |
| Data processing | pandas |
| Dev ports | Frontend: `localhost:5173` · Backend: `localhost:8000` |

---

## Project Structure

```
production-planner-product/
├── backend/
│   ├── main.py              # FastAPI app — upload, process, status endpoints
│   ├── data_processor.py    # Core processing logic — BOM explosion, coverage calc, stale flags
│   ├── data/
│   │   ├── uploads/         # Uploaded Epicor exports land here (git-ignored)
│   │   └── app_data.json    # Processed output served to frontend (git-ignored)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Root app, tab routing, analysis engine (useMemo)
│   │   ├── utils/api.js     # Axios wrapper for all backend calls
│   │   ├── index.css        # CSS variables, global styles
│   │   └── components/
│   │       ├── Header.jsx
│   │       ├── DataBar.jsx           # File upload + Process Data button
│   │       ├── OrdersTab.jsx         # Individual and grouped order views
│   │       ├── JobPlanningTab.jsx    # Job builder with material breakdown
│   │       ├── PurchasingTab.jsx     # Consolidated material demand
│   │       ├── PurchasedPartsTab.jsx # Buy-part history and stale flags
│   │       ├── MaterialsTab.jsx      # RM inventory vs demand
│   │       └── BomAttentionPanel.jsx # Slide-out panel for unclassified parts
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## Data Sources (Epicor Exports)

All files are uploaded through the app UI. The backend saves them to `backend/data/uploads/`.

### `Open_Sales_Orders.xlsx`
Open customer order lines with remaining qty and ship dates.

Key columns used:
- `SO: Order` — order number
- `SO: Line` — line number
- `SO: Part` — part number
- `SO: Part Description` — part description
- `remaining Qty` — quantity still to ship
- `SO: Ship By` / `SO Rel Ship By` — ship date
- `Name` — customer name
- `SO: UOM` — unit of measure

### `all_inventory_on_hand.xlsx`
Current stock levels across all warehouses, bins, and lots. Uses Traditional Chinese column headers.

Key columns used:
- `產品物料編碼/Part` — part number
- `產品物料描述Description` — part description
- `庫存量/On Hand` — on-hand quantity
- `類別描述/Part Class Desc` — part class
- `庫存單位/Inventory UOM` — unit of measure

Inventory is **aggregated by part number** across all rows (warehouses/bins/lots).

### `BOM.xlsx`
Bill of materials — Level 0 direct components only.

Key columns used:
- `HUMAN PARENT PART` — finished good / parent part number
- `HUMAN MATERIAL PART` — raw material / component part number
- `Material_Desc` — material description
- `Qty/Parent` — quantity of material per parent unit
- `Material Part UOM` — unit of measure
- `Level` — BOM level (0 = direct component)

### `Open_POs.xlsx`
Outstanding purchase orders with remaining quantities and due dates.

Key columns used:
- `PO: Part Num` — part number
- `PO: Description` — description
- `PO Rel: Remaining Qty` — qty still on order
- `PO Line: Due Date` — expected receipt date
- `PO: Supplier Name` — vendor
- `PO: PO` — PO number

### `Closed_POs.csv`
Historical purchase order data. Encoded `cp1252`. Used to classify parts as confirmed purchased parts and to flag stale purchasing activity.

Key columns used:
- `PO: Part Num` — part number
- `PO: Supplier Name` — last known supplier
- `PO Line: Due Date` — last PO date (used to compute days since last purchase)
- `PO: Open` / `PO Line: Open` — used to confirm closure

### `Routing.xlsx` *(loaded but not yet used in UI)*
Manufacturing routing steps per part.

Key columns:
- `HUMAN PART` — part number
- `Opr` — operation sequence
- `OpDesc` — operation description
- `Prod. Std` — production standard (hours/unit)

---

## Business Logic

### Part Classification
Every part on an open sales order is classified as one of three types:

| Type | Condition | Handling |
|------|-----------|---------|
| **BOM-driven** | Part has a BOM entry in `BOM.xlsx` | Material coverage is calculated; appears in Job Planning |
| **Purchased directly** | No BOM, but has PO history in `Closed_POs.csv` | Appears in Purchased Parts tab |
| **Needs BOM attention** | No BOM and no PO history | Flagged in BOM Attention panel |

### Material Coverage Calculation
For each BOM-driven sales order line:

```
toMake      = max(0, remainingQty - fgOnHand)
materialNeed = toMake × QtyPer
coverage    = min(1, (onHand + openPO) / materialNeed)
```

Coverage across all BOM components is the **minimum** of individual component coverage (`wc`). An order has a **material gap** (`hasGap`) if any component's coverage < 1.

### Can-Ship Status
| Status | Condition |
|--------|-----------|
| `YES` | FG on hand ≥ remaining qty |
| `MAKE` | FG short but all materials available |
| `PARTIAL` | Some material coverage (0 < wc < 1) |
| `NO` | No material coverage |
| `NOBOM` | No BOM and FG insufficient |

### Order Tiering
| Tier | Condition |
|------|-----------|
| 🔴 Critical | ≤ 7 days to ship date, or NO/PARTIAL status within 14–21 days |
| 🟡 At Risk | 8–21 days to ship date |
| 🟢 On Track | > 21 days to ship date |

### Stale Flag
A purchased part is flagged **Stale** if:
- It has at least one open sales order
- No PO activity (no closed PO) in the last **540 days**

---

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/status` | Which files are uploaded; last processed timestamp |
| `POST` | `/api/upload/{file_type}` | Upload a single Epicor export |
| `POST` | `/api/process` | Run the data processor; generates `app_data.json` |
| `GET` | `/api/data` | Return the full processed JSON to the frontend |

Valid `file_type` values: `sales_orders`, `inventory`, `bom`, `open_pos`, `closed_pos`

---

## Workflow

1. Export the five reports from Epicor
2. Open the app at `localhost:5173`
3. Click each button in the **Data Bar** and upload the corresponding file
4. Click **▶ Process Data**
5. All tabs populate with live data

---

## Roadmap / Planned Features

- [ ] Routing-based lead time calculation (capacity vs. demand)
- [ ] Supplier lead time tracking per part
- [ ] Export job cards and purchasing summaries to Excel
- [ ] Email/Slack alert digest for critical orders
- [ ] Historical order fulfillment tracking (on-time vs. late)
- [ ] Multi-user support with role-based views (buyer vs. production manager)
- [ ] SaaS packaging — multi-tenant, hosted deployment

---

## Notes

- All uploaded files and processed JSON are git-ignored — no ERP data is committed to the repo
- The inventory file uses Traditional Chinese column headers as exported from Epicor; the processor handles this directly
- The `Routing.xlsx` file is accepted and stored but not yet surfaced in the UI — reserved for future capacity planning features
