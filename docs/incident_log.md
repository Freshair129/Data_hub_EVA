# 🚨 Incident Log & Post-Mortems

This document records significant logic errors, system failures, and their resolutions to prevent recurrence.

---

## 📅 2026-02-18: Shabu (Dinner) Campaign Misattribution
**Ref ID**: `LOGIC-ERR-20260218-01`
**Changelog ID**: `FIX-ATTR-001` (See `dinner_performance_report.md` update)
**Resolution Quality**: `FULL_FIX` (Logic updated to distinguish Cross-Sell)

### 🔴 The Problem (อาการ)
*   **Reported**: "Dinner Campaign" calculated a high ROAS (Return on Ad Spend) with 34,000 THB revenue.
*   **Actual**: The "Dinner" product (Shabu) had **0 THB** direct revenue.
*   ** Discrepancy**: The system (and Analyst) attributed a "Ramen Course" purchase to the "Dinner Ad" because the customer *entered* via the Dinner Ad.

### 🔍 Root Cause (สาเหตุ)
1.  **Loose Attribution Logic**: The initial query grouped "All Revenue from Customer X" under "Campaign Y" simply because Customer X's *first interaction* was with Campaign Y.
2.  **Product Agnostic**: The reporting logic did not filter revenue by `product_category`. It treated "Any Money" as "Campaign Success".
3.  **Cross-Sell Blindness**: Failed to distinguish between "Direct Conversion" (Ad -> Same Product) and "Cross-Sell" (Ad -> Different Product).

### ✅ The Solution (วิธีแก้)
1.  **Schema Distinction**:
    *   Added **"Direct Revenue"** vs **"Cross-Sell Revenue"** columns in reports.
    *   Strictly check `order_items` against `campaign_objective_product`.
2.  **Code/Logic Update**:
    *   *Correction in Report*: Manually split the 34k into "Indirect/Cross-Sell".
    *   *Future Query Rule*: When calculating ROAS for a specific product ad, **exclude** revenue from unrelated categories unless explicitly labeled "Cross-Sell".
3.  **Prevention**:
    *   Before declaring "Campaign Success", cross-reference `purchased_product_id` with `ad_target_product_id`.

### 🔗 Related Artifacts
*   **Raw Incident Report**: [ERR-20260218-001](file:///Users/ideab/Desktop/data_hub/ERR-20260218-001)
*   **Report**: [dinner_performance_report.md](file:///Users/ideab/.gemini/antigravity/brain/de816c42-9d1b-4e77-899d-b65cf3fc76f3/dinner_performance_report.md)
*   **Fix Implementation**: [Corrected Analysis logic in Report](file:///Users/ideab/.gemini/antigravity/brain/de816c42-9d1b-4e77-899d-b65cf3fc76f3/dinner_performance_report.md#L10)

---

## 📅 2026-02-18: Assistant Tool Failure (Directory "18")
**Ref ID**: `SYS-ERR-20260218-02`
**Status**: `INVESTIGATING`

### 🔴 The Problem (อาการ)
*   **Observed**: In doc [ERR-20260218-001](file:///Users/ideab/Desktop/data_hub/ERR-20260218-001#L17-20), the assistant attempted to list a directory named `18` which did not exist, resulting in a tool failure message.

### 🔍 Root Cause (สาเหตุ)
*   **Potential**: Likely a misinterpretation of a line number or a dynamic variable in a `list_dir` or `view_file` call from a previous session. The assistant "hallucinated" a path or used a line count as a directory name.

### ✅ The Solution (วิธีแก้)
*   **Current Action**: Reviewing tool call logs to ensure no code in the current session uses hardcoded integers for directory listing.
*   **Prevention**: Always verify path existence before executing bulk analysis.

---

## 📅 2026-02-18: Final Verification of Context Logic
**Ref ID**: `INC-20260218-ST0H`
**Task ID**: `TASK-CONTEXT-FINAL-FIX`
**Status**: `ERROR`
**Report**: [INC-20260218-ST0H.md](./incidents/INC-20260218-ST0H.md)

## 📅 2026-02-18: Task System Linkage Test
**Ref ID**: `INC-20260218-AIZT`
**Task ID**: `TSK-1771434108537-UHKL`
**Status**: `FULL_FIX`
**Report**: [INC-20260218-AIZT.md](./incidents/INC-20260218-AIZT.md)
