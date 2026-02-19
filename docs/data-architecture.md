# Data Architecture — VSchool CRM

> เอกสารอธิบาย Architecture ของระบบ Data Flow, Local Cache, และ Analytics Pipeline

---

## 1. Overview

```
[ USER / UI ]
      |
 (1) Read Request
      |
+-----v--------+    FOUND    +-------------------------+
| Local JSON   |------------>|  UI Displays (Instant)  |
|    Cache     |             +----------^--------------+
+-----+--------+                        |
      |                      (4) Background Refresh
+-----v--------+             +-------------------------+
|   Main DB    |------------>|  UI Displays (Postgres) |
|  (Supabase)  |             +----------+--------------+
+--------------+                        |
      |                      (4) [Legacy] Write to JSON Cache
      v                                 |
+--------------+     (3) Job Picked Up     +------------------+
|    Redis     |-------------------------->|  Cache Worker    |
|  (BullMQ)   |                           | (cacheSyncWorker)|
+--------------+                          +--------+---------+
                                                   |
                                       Write JSON to Path:
                                    crm-app/cache/{entity}/{id}.json
```

**Step-by-step:**
1. **Read Request** → เช็ก Local JSON Cache ก่อนเสมอ
2. **Cache Hit** → ส่งข้อมูลทันที + trigger Background Refresh
3. **Cache Miss** → ดึงจาก DB/API → เขียน Cache → ส่ง UI
4. **DB Write** → emit BullMQ job → Worker เขียน Cache ให้ sync

---

## 2. Cache Folder Structure

```
crm-app/
├── cache/
│   ├── customer/
│   │   └── TVS-CUS-FB-26-0002.json     ← profile ลูกค้าแต่ละคน
│   │
│   ├── ads/
│   │   ├── campaign/
│   │   │   ├── campaigns_last_30d.json  ← snapshot by date range
│   │   │   └── {campaignId}.json        ← แต่ละ campaign
│   │   ├── ad_set/
│   │   │   └── {adSetId}.json
│   │   └── ad/
│   │       └── {adId}.json
│   │
│   ├── ad_logs/
│   │   ├── daily/     ← ตัวเลขโฆษณา รายวัน
│   │   ├── monthly/   ← ตัวเลขโฆษณา รายเดือน
│   │   ├── yearly/    ← ตัวเลขโฆษณา รายปี
│   │   └── hourly/    ← ตัวเลขโฆษณา รายชั่วโมง
│   │
│   ├── employee/
│   │   └── {employeeId}.json
│   │
│   ├── products/
│   │   ├── __all__.json        ← snapshot รายการสินค้าทั้งหมด
│   │   ├── courses/
│   │   ├── packages/
│   │   ├── cooking_eqt/
│   │   ├── menu/
│   │   └── packages_picture/
│   │
│   └── analytics/                      ← [TODO] Pre-computed
│       ├── summary.json                ← Revenue, ROAS, CAC รวม
│       ├── daily_{date}.json           ← KPI รายวัน
│       └── monthly_{month}.json        ← KPI รายเดือน
│
└── src/
    ├── lib/
    │   └── cacheSync.js                ← Read/Write/Invalidate utility
    └── workers/
        └── cacheSyncWorker.js          ← BullMQ Consumer + Emitter
```

---

## 3. Storage Layer

| Layer | Technology | Role |
|---|---|---|
| **Local Cache** | JSON Files (`cache/`) | Instant read for static entities (Legacy for Products) |
| **Main DB** | Supabase PostgreSQL | Source of truth (Products, Customers, Marketing) |
| **Queue** | Redis + BullMQ | Event-driven sync trigger |
| **Worker** | Node.js (`cacheSyncWorker`) | Writes cache after DB events |

---

## 4. API Routes — Cache Status

| Route | Entity | Cache Status |
|---|---|---|
| `GET /api/customers` | `customer/` | ✅ Cache-first |
| `GET /api/catalog` | `Database` | ✅ DB-First |
| `GET /api/marketing/campaigns` | `ads/campaign/` | ✅ Cache-first |
| `GET /api/employees` | `employee/` | 🔲 TODO |
| `GET /api/marketing/daily` | `ad_logs/daily/` | 🔲 TODO |
| `GET /api/marketing/insights` | `analytics/` | 🔲 TODO |
| Orders / Transactions | `orders/` | 🔲 TODO (no route yet) |

---

## 5. Analytics Pipeline — Status

### ✅ มีแล้ว
- Customer profiles (basic info, segment, tags)
- Campaign-level metrics (spend, clicks, impressions)
- Product catalog

### ❌ ยังขาด (จำเป็นสำหรับ Analytics)

| ขาด | ใช้คำนวณ |
|---|---|
| Orders / Transactions | Revenue, AOV, Conversion Rate |
| Ad Daily Logs | Trend chart, Cost-per-day, ROAS |
| Pre-computed Summary | Dashboard KPI (instant load) |

### แผน Analytics Cache Worker
```
[Orders + Ads Daily] → AggregatorWorker → cache/analytics/summary.json
                                        → cache/analytics/daily_{date}.json
```

---

## 6. Principles

- **Cache-First**: UI อ่าน local เสมอ (instant) → background sync
- **Event-Driven**: ทุก DB Write → emit BullMQ job → update cache
- **Stale-While-Revalidate**: แสดง stale data ก่อน ขณะที่ fresh data โหลดอยู่
- **Offline Read**: ถ้า DB หรือ API ล่ม UI ยังอ่านจาก cache ได้
- **No Redundant Queries**: ข้อมูลที่อ่านบ่อยจะโดน cache ไว้ ลด DB load