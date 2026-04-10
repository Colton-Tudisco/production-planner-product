# SEM Production Planner — Roadmap & Feature Notes

> This document is the organized version of the raw brain-dump notes for the SEM Production Planner app.
> It is intended as a living reference for the developer, Claude, and Claude Code.
> The original unedited notes are preserved in `Plan_notes_for_changes__fixes__and_improvements.md`.

---

## 🔴 Priority 1 — Bugs to Fix (Broken Logic)

### 1.1 "To Produce = 0" Bug in Job Planning
- **Problem:** Some parts show a remaining qty (e.g. 84 pcs) on an open order, but when selected in Job Planning the "To Produce" value shows 0 and the raw material needs all calculate as 0.
- **Known example:** Part `23-73H50BKQFR-121.00-C` — overdue, 84 pcs remaining, but To Produce = 0.
- **Expected behavior:** Selecting an order should correctly calculate To Produce = RemainingQty - FG On Hand, and BOM material needs should reflect that quantity.
- **Note:** Some BOM components for this part are boxes/bags which are irrelevant — may need a way to exclude packaging components from material calculations.

### 1.2 Data Classification Errors (Part Misclassified as Buy vs Make)
- **Problem:** Some parts that are manufactured in-house are being flagged as "Create PO" because they have no BOM loaded in Epicor and no closed PO history.
- **Known example:** Part `23-19N4P48BKQFR-C` is a make part but shows up as needing a PO.
- **Fix needed:** A data correction/override system — ability to tag a part as "manufactured" or "purchased" manually and persist that override so it survives future data reloads.
- **Storage idea:** A local overrides file (JSON or similar) that gets applied on top of every data processing run.

---

## 🟡 Priority 2 — High Value, Relatively Quick Wins

### 2.1 Description Visibility
- **Problem:** Part descriptions are too dim/faint, especially in the Job Planning tab.
- **Fix:** Increase font color contrast for description text throughout the app, particularly in job planning rows and BOM material rows.

### 2.2 Ready-to-Ship Section
- **What it is:** A dedicated view showing orders where we already have enough finished goods on hand — no production needed, just ship.
- **Why it matters:** When against the clock, need to instantly see what can go out the door today.
- **Features needed:**
  - Printable / exportable list
  - Can be handed or sent to shipping directly
  - Should NOT appear in Job Planning (already covered)

### 2.3 Late PO Filter + Checkoff (Purchasing Action Items)
- **What it is:** A filter in the Purchasing tab showing only POs that are going to arrive late relative to the sales order due dates.
- **Why it matters:** George (purchasing) needs a clear action item list each day.
- **Features needed:**
  - Filter to show only late POs
  - Ability to check off items as George addresses them
  - Checked items should persist until data is refreshed

### 2.4 Hide / Ignore Items in BOM Attention
- **Problem:** Some parts appear in BOM Attention that don't actually need attention — e.g. parts we do purchase but haven't bought since before Epicor, so they have no closed PO history.
- **Fix:** Ability to hide/ignore specific parts in the BOM Attention panel, with that preference saved so it persists across data reloads.

### 2.5 Customizable Job Quantity
- **What it is:** When creating a job in Job Planning, the quantity should default to the calculated value (as it does now) but be editable before finalizing.
- **Why:** Sometimes you want to run a different quantity than what's strictly needed.

---

## 🟠 Priority 3 — Medium Term Features

### 3.1 On-Hold Jobs with Notes
- **What it is:** A section (likely within or adjacent to Job Scheduling) where jobs can be placed "on hold" with a reason — e.g. waiting for materials, line down, staffing issues.
- **Features needed:**
  - Reason/note field (free text + possibly preset categories: waiting on materials, line down, out sick, etc.)
  - Held jobs are remembered and can be resumed / put back on the schedule
  - Timestamp of when the hold was created
- **Storage:** Needs to persist across sessions — not just in-memory.

### 3.2 PO Line-Level Structure
- **Problem:** Current logic treats entire POs as open or closed, but some POs have a mix of open and closed lines. This may cause incorrect classification.
- **Fix:** Rework PO processing to operate at the PO Line level, not just the PO level.
- **Note:** Needs discussion and testing before implementing — could affect a lot of downstream logic.

### 3.3 Internal / China-Sourced Parts Separation
- **What it is:** Some parts without a BOM have POs going to "Schlegel" — meaning they are sourced from the China location (either shipped to US or drop-shipped). These are effectively internal transfers, not external purchases.
- **Fix:** Detect POs where supplier = Schlegel and separate those into their own category rather than mixing with external purchased parts.

### 3.4 Remove Tooling and Fees from Views
- **Problem:** Tooling charges and fees are appearing in parts/order views where they shouldn't be.
- **Fix:** Filter out any parts/lines classified as tooling or fees from all planning views.

### 3.5 Sample Parts / Sample Orders — Separate Section
- **What it is:** Sample orders and sample parts should be completely separated from production orders.
- **Fix:** Detect and route sample orders into their own isolated section so they don't pollute production planning views.

---

## 🔵 Priority 4 — Major Features (Larger Scope)

### 4.1 Production Scheduling Tab
- **What it is:** A full interactive scheduling board where jobs created in Job Planning can be scheduled, rearranged, and viewed by the production team.
- **Key features:**
  - Drag-and-drop job scheduling
  - Multiple view types: day, week, month, hour-level
  - Ability to stretch jobs across multiple days
  - Printable schedule
  - Floor display mode — send/show current day's schedule on a TV or monitor on the production floor for the team to see in real time
  - Possibly separate by department
  - Auto-schedule suggestion based on due dates + material availability
  - Manual override / full editing after auto-schedule
- **Development approach:** Build and perfect this as a standalone artifact/prototype first, then wire into the full app. This is the most complex feature and needs to be exactly right.

### 4.2 Data Override / Correction System
- **Broader version of bug 1.2 above.**
- **What it is:** A persistent layer that sits on top of the raw Epicor data and allows corrections that survive every data reload.
- **Use cases:**
  - Tag a part as manufactured (make) or purchased (buy)
  - Override a BOM entry
  - Hide a part from a specific view permanently
  - Correct misclassified parts
- **Storage:** Likely a `overrides.json` or small local database that is applied during `process_all()` after raw data is loaded.

### 4.3 Real-Time Data Updates
- **What it is:** Various parts of the app should update in real time or near-real time rather than requiring a manual re-upload and re-process.
- **Details TBD** — needs more discussion to define exactly what "real time" means in this context (auto-refresh? websocket? polling?).

### 4.4 Streamlined File Import
- **What it is:** Simplify and improve the file import process, including support for CSV in addition to XLSX.
- **Possibly:** Automatic import on app open, or watching a folder for new exports.
- **Timeline:** Closer to final build — not a priority during active development.

---

## ⚙️ Dev / Infrastructure Notes

### DEV_MODE — Test Data Setup ✅ (Completed)
- Sample files committed to `backend/data/test_data/`
- `DEV_MODE=true` in `data_processor.py` auto-loads test data on startup
- No manual file upload needed during development
- Switch `DEV_MODE=false` for production

### PO Suggestions
- Placeholder: explore auto-generating PO suggestions based on material gaps and lead times. Details TBD.

---

## 📝 Open Questions / To Discuss
- Best storage mechanism for overrides/corrections (JSON file vs SQLite vs other)
- Real-time update strategy (polling interval, websocket, file watcher)
- Whether scheduling tab separates by department or stays unified
- Whether to keep `.xlsx` format long-term or migrate exports to `.csv`
- PO line-level restructure — impact on existing logic needs careful review before touching
