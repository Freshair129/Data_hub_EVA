# V School CRM - System Overview

## Project Summary
A comprehensive Customer Relationship Management (CRM) system built with **Next.js** for **V School** (Japanese Culinary Academy). The system provides a 360° view of customer engagement, sales, inventory, and analytics using a high-performance hybrid architecture.

---

## High-Level Architecture

The V-School CRM is built on a hybrid architecture that balances ease of use (JSON Flat Files) with professional reliability (PostgreSQL/Prisma).

```mermaid
graph TD
    A[Facebook Webhook] --> B[Next.js API Route]
    B --> C{DB Adapter}
    C -->|json| D[Local Filesystem]
    C -->|prisma| E[PostgreSQL / Supabase + Adapter]
    B --> F[Redis Queue]
    F --> G[Python Worker]
    G --> H[AI Engine: Gemini]
    G --> I[Meta Graph API]
    G --> J[Logic Integrity Check]
```

### Hybrid Architecture (Node.js + Python) 🐍🛡️

The system utilizes a dual-engine approach:

| Engine | Role | Primary Tech |
|--------|------|--------------|
| **Core (Web)** | UI, API, Hooks | Next.js (Node.js 20+) |
| **Worker (AI)** | Sync, OCR, AI, Messaging | Python 3.12+ |
| **Bridge** | JSON IPC / Redis | Redis (BullMQ / Python-RQ) |

### Marketing Sync Architecture 🔄

This flow describes how marketing data is synced from external APIs to the local JSON cache for high-performance retrieval.

```mermaid
graph TD
    FB[Facebook Marketing API] -->|Bulk Fetch| PY[marketing_sync.py]
    PY -->|SQL Upsert| DB[(PostgreSQL)]
    PY -->|Trigger| API[Next.js API sync]
    API -->|Queue Job| BQ[BullMQ / Redis]
    BQ -->|Process| WK[cacheSyncWorker.js]
    WK -->|Read| DB
    WK -->|Write| JSON[Local JSON Cache]
    UI[Dashboard UI] -->|Direct Read| JSON
```

---

## Core Data Flow

```mermaid
flowchart LR
    subgraph Input["📥 Input"]
        REG["Registration Modal"]
        STORE["Store / Checkout"]
        TOPUP["Wallet Top-up"]
        FBW["Facebook Webhook"]
    end

    subgraph Core["💾 Core Data"]
        PROFILE["Customer Profile"]
        WALLET["Wallet"]
        INV["Inventory / Cart"]
        TL["Timeline / Chat"]
    end

    subgraph Output["📊 Output"]
        CARD["Customer Card"]
        ANALYTICS["Analytics Dashboard"]
        DASH["Executive Dashboard"]
    end

    REG -->|"Creates"| PROFILE
    REG -->|"Assigns"| WALLET
    STORE -->|"Adds Items"| INV
    STORE -->|"Logs Order"| TL
    STORE -->|"Updates Spend"| PROFILE
    TOPUP -->|"Credits"| WALLET
    TOPUP -->|"Logs Transaction"| TL
    FBW -->|"Sync Chat"| TL

    PROFILE --> CARD
    WALLET --> CARD
    INV --> CARD
    TL --> CARD

    PROFILE --> ANALYTICS
    TL --> ANALYTICS
    INV --> DASH
```

---

## Core Modules

| Module | Responsibility | Tech Stack |
|--------|----------------|------------|
| **Customer 360** | Profile, Wallet, Inventory, Intelligence, Timeline | `CustomerCard.js` |
| **Facebook Ads** | Real-time Ad Monitoring, Budget Tracking, AI Insights | `FacebookAds.js` |
| **Analytics** | 8-Tab Dashboard (Sales, CLV, Funnel, ROI) | `Analytics.js` |
| **Store & Cart** | Persistence, Course & Package Sales (Database-First) | `StoreGrid.js` / Prisma |
| **Knowledge Base**| Semantic Search (RAG) & AI Context | Python / Gemini |
| **Observability** | Error Logging & Auditing | `errorLogger.js` |

---

## Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    CUSTOMER ||--|| PROFILE : has
    CUSTOMER ||--|| WALLET : owns
    CUSTOMER ||--o{ INVENTORY : contains
    CUSTOMER ||--o{ TIMELINE : logs
    CUSTOMER ||--o{ CART_ITEM : "stores items"
    
    INVENTORY ||--o{ COUPON : stores
    INVENTORY ||--o{ COURSE_CREDIT : stores
    
    TIMELINE ||--o{ ORDER : records
    TIMELINE ||--o{ TOPUP : records
    TIMELINE ||--o{ MESSAGE : records
    
    CATALOG ||--o{ PRODUCT : lists
    CATALOG ||--o{ PACKAGE : lists
    PACKAGE ||--o{ PRODUCT : includes
    
    EMPLOYEE ||--o{ CUSTOMER : manages

    CUSTOMER {
        string customer_id PK
        string member_id UK
    }
    CART_ITEM {
        int quantity
    }
    PROFILE {
        string first_name
        string last_name
        string membership_tier
    }
    WALLET {
        float balance
        int points
    }
```

---

## 🛡️ Data Backup & Safety

The system implements automated backups during critical maintenance operations:

| Feature | Mechanism | Destination |
|---------|-----------|-------------|
| **Customer Backup** | Automatic snapshot before ID refactoring | `customer_backup_[TIMESTAMP]/` |
| **ID Mapping** | Tracks old (FB/Line) IDs to new (TVS-CUS) IDs | `docs/customer_id_mapping.json` |

---

## ID System (Standard V7)

| ID Type | Format | Example | Purpose |
|---------|--------|---------|---------|
| **Customer ID** | `TVS-CUS-[CH]-[YY]-[SEQ]` | `TVS-CUS-FB-26-0001` | **Immutable** Academy Primary Key |
| **Member ID** | `MEM-YYYY-XXXX` | `MEM-2024-0001` | Customer-Facing ID |
| **Order ID** | `ORD-[DATE]-[NUM]` | `ORD-20240217-001` | Sales of Courses/Packages |
| **Transaction ID** | `TRX-[DATE]-[ID]` | `TRX-20240217-W01` | Payments, Wallet Top-ups |
| **Course ID** | `TVS-[GRP]-[FC]-[QUAL]-[SEQ]` | `TVS-JP-2FC-HC-01` | Product Catalog |

---

## 📂 Project Structure

### Root Directory (`data_hub/`)
| Path | Description |
|------|-------------|
| `crm-app/` | Main Next.js application source code |
| `node_env/` | **Portable Node.js Runtime** (Do not delete) |
| `customer/` | Account Data & Timelines (Legacy JSON) |
| `employee/` | Staff Profiles & Activity Logs |
| `marketing/` | Ad Performance Logs & Compliance Data |
| `products/` | Granular Product JSON files (Source of Truth for DB) |
| `catalog.json.bak` | Legacy Master Products & Packages (Phased Out) |
| `รันระบบ_NextJS.command`| One-click Startup script |

### App Directory (`crm-app/`)
| Path | Description |
|------|-------------|
| `src/app/api/` | API Routes (Marketing, Customers, Cart) |
| `src/workers/` | Background Workers (Node Sync & Python AI) |
| `src/lib/` | Shared utilities (DB Adapter, Cache Sync) |
| `prisma/` | Database schema (PostgreSQL) |
| `cache/` | Local JSON Cache for high performance |

---

## 🛡️ Observability & Reliability

The system implements a multi-layer logging strategy for traceability:

| Layer | Path | Purpose |
|-------|------|---------|
| **Error Logs** | `logs/errors_*.jsonl` | Technical failures. |
| **Audit Logs** | `logs/audit.jsonl` | Critical business actions (Records who did what). |
| **Compliance** | `marketing/logs/compliance/` | PDPA & Data Consent logs. |
| **Forensic** | `marketing/logs/forensic/` | Tamper-proof signatures for log integrity. |
| **Incidents** | `docs/incidents/` | Detailed "Post-Mortems" for failures. |

---

## Running the Application

```bash
cd /Users/ideab/Desktop/data_hub/crm-app
npm run dev
# Access at http://localhost:3000
# Login: admin@vschool.co.th / admin123
```
