/**
 * Database Adapter Layer (Strategy Pattern)
 * ─────────────────────────────────────────
 * Supports 3 backends seamlessly:
 *   1. JSON Files   (Current - Zero Setup)
 *   2. PostgreSQL   (Local - via Prisma)
 *   3. Supabase     (Cloud - via Prisma + Supabase URL)
 * 
 * Switch by setting DB_ADAPTER in .env.local:
 *   DB_ADAPTER=json      (default, current behavior)
 *   DB_ADAPTER=prisma    (PostgreSQL / Supabase)
 * 
 * When DB_ADAPTER=prisma, set DATABASE_URL:
 *   Local PG:  postgresql://user:pass@localhost:5432/vschool_crm
 *   Supabase:  postgresql://postgres:[PASS]@db.[REF].supabase.co:5432/postgres
 */

import fs from 'fs';
import path from 'path';

const DB_ADAPTER = process.env.DB_ADAPTER || 'json';
const DATA_DIR = path.join(process.cwd(), '..');

// ─── Lazy Prisma Loader ────────────────────────────────────
let _prisma = null;
export async function getPrisma() {
    if (!_prisma) {
        try {
            const { PrismaClient } = await import('@prisma/client');
            _prisma = new PrismaClient();
            console.log('[DB] Connected via Prisma (PostgreSQL/Supabase)');
        } catch (e) {
            console.warn('[DB] Prisma not available, falling back to JSON:', e.message);
            return null;
        }
    }
    return _prisma;
}

// ═══════════════════════════════════════════════════════════
//  CUSTOMERS
// ═══════════════════════════════════════════════════════════

export async function getAllCustomers() {
    if (DB_ADAPTER === 'prisma') {
        const prisma = await getPrisma();
        if (prisma) {
            return prisma.customer.findMany({
                include: { orders: true, inventory: true, timeline: true }
            });
        }
    }
    // JSON Fallback
    return getAllCustomersFromJSON();
}

export async function getCustomerById(customerId) {
    if (DB_ADAPTER === 'prisma') {
        const prisma = await getPrisma();
        if (prisma) {
            return prisma.customer.findUnique({
                where: { customerId },
                include: { orders: { include: { transactions: true } }, inventory: true, timeline: true }
            });
        }
    }
    return getCustomerFromJSON(customerId);
}

export async function upsertCustomer(data) {
    if (DB_ADAPTER === 'prisma') {
        const prisma = await getPrisma();
        if (prisma) {
            return prisma.customer.upsert({
                where: { customerId: data.customer_id || data.customerId },
                create: mapCustomerToPrisma(data),
                update: mapCustomerToPrisma(data)
            });
        }
    }
    return saveCustomerToJSON(data);
}

// ═══════════════════════════════════════════════════════════
//  EMPLOYEES
// ═══════════════════════════════════════════════════════════

export async function getAllEmployees() {
    if (DB_ADAPTER === 'prisma') {
        const prisma = await getPrisma();
        if (prisma) return prisma.employee.findMany();
    }
    return getAllEmployeesFromJSON();
}

export async function getEmployeeByEmail(email) {
    if (DB_ADAPTER === 'prisma') {
        const prisma = await getPrisma();
        if (prisma) return prisma.employee.findUnique({ where: { email } });
    }
    // JSON lookup
    const employees = await getAllEmployeesFromJSON();
    return employees.find(e => e.contact_info?.email === email || e.email === email) || null;
}

// ═══════════════════════════════════════════════════════════
//  PRODUCTS
// ═══════════════════════════════════════════════════════════

export async function getAllProducts() {
    if (DB_ADAPTER === 'prisma') {
        const prisma = await getPrisma();
        if (prisma) return prisma.product.findMany({ where: { isActive: true } });
    }
    return getProductsFromJSON();
}

// ═══════════════════════════════════════════════════════════
//  AUDIT LOG
// ═══════════════════════════════════════════════════════════

export async function writeAuditLog(entry) {
    if (DB_ADAPTER === 'prisma') {
        const prisma = await getPrisma();
        if (prisma) {
            return prisma.auditLog.create({ data: entry });
        }
    }
    // JSON Fallback: Append to JSONL
    const logDir = path.join(DATA_DIR, 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, 'audit.jsonl');
    fs.appendFileSync(logFile, JSON.stringify({ ...entry, created_at: new Date().toISOString() }) + '\n');
}

// ═══════════════════════════════════════════════════════════
//  ERROR LOG (Hybrid: Prisma + JSONL Fallback)
// ═══════════════════════════════════════════════════════════

export async function writeErrorLog(entry) {
    if (DB_ADAPTER === 'prisma') {
        const prisma = await getPrisma();
        if (prisma) {
            try {
                return prisma.errorLog.create({ data: entry });
            } catch (e) {
                console.error('[DB] Prisma write failed, falling back to JSON:', e.message);
            }
        }
    }
    // JSON Fallback
    const logDir = path.join(DATA_DIR, 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    // Rotate logs strictly by date to keep file size manageable
    const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const logFile = path.join(logDir, `errors_${dateStr}.jsonl`);

    fs.appendFileSync(logFile, JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n');
}

export async function getErrorLogs(filter = {}) {
    if (DB_ADAPTER === 'prisma') {
        const prisma = await getPrisma();
        if (prisma) {
            return prisma.errorLog.findMany({
                where: filter,
                orderBy: { timestamp: 'desc' },
                take: 100
            });
        }
    }
    // JSON Read (Last 100 lines from today's log)
    const logDir = path.join(DATA_DIR, 'logs');
    const dateStr = new Date().toISOString().slice(0, 10);
    const logFile = path.join(logDir, `errors_${dateStr}.jsonl`);

    if (!fs.existsSync(logFile)) return [];

    const content = fs.readFileSync(logFile, 'utf8');
    return content.trim().split('\n').map(line => {
        try { return JSON.parse(line); } catch (e) { return null; }
    }).filter(Boolean).reverse().slice(0, 100);
}

// ═══════════════════════════════════════════════════════════
//  JSON FILE ADAPTERS (Current Implementation)
// ═══════════════════════════════════════════════════════════

function getAllCustomersFromJSON() {
    const customerDir = path.join(DATA_DIR, 'customer');
    if (!fs.existsSync(customerDir)) return [];

    const folders = fs.readdirSync(customerDir).filter(f =>
        fs.statSync(path.join(customerDir, f)).isDirectory() && !f.startsWith('.')
    );

    return folders.map(folder => {
        try {
            const folderPath = path.join(customerDir, folder);
            const files = fs.readdirSync(folderPath);
            const profileFile = files.find(f => f.startsWith('profile_') && f.endsWith('.json'));

            if (!profileFile) return null;

            const data = JSON.parse(fs.readFileSync(path.join(folderPath, profileFile), 'utf8'));
            return data;
        } catch (e) {
            console.error(`[DB/JSON] Error reading ${folder}:`, e.message);
            return null;
        }
    }).filter(Boolean);
}

function getCustomerFromJSON(customerId) {
    const customers = getAllCustomersFromJSON();
    return customers.find(c =>
        c.customer_id === customerId ||
        c.conversation_id === customerId ||
        c.contact_info?.facebook_id === customerId ||
        c.facebook_id === customerId
    ) || null;
}

function saveCustomerToJSON(data) {
    const customerId = data.customer_id || data.customerId;
    const folderName = customerId; // Always use Customer ID as folder name in V7 Standard
    const customerDir = path.join(DATA_DIR, 'customer', folderName);

    if (!fs.existsSync(customerDir)) fs.mkdirSync(customerDir, { recursive: true });

    const filePath = path.join(customerDir, `profile_${folderName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
    return data;
}

function getAllEmployeesFromJSON() {
    const empDir = path.join(DATA_DIR, 'employee');
    if (!fs.existsSync(empDir)) return [];

    const folders = fs.readdirSync(empDir).filter(f =>
        fs.statSync(path.join(empDir, f)).isDirectory() && !f.startsWith('.')
    );

    return folders.map(folder => {
        const files = fs.readdirSync(path.join(empDir, folder))
            .filter(f => f.startsWith('profile_') && f.endsWith('.json'));
        if (files.length === 0) return null;
        try {
            return JSON.parse(fs.readFileSync(path.join(empDir, folder, files[0]), 'utf8'));
        } catch (e) { return null; }
    }).filter(Boolean);
}

function getProductsFromJSON() {
    const catalogPath = path.join(DATA_DIR, 'catalog.json');
    if (!fs.existsSync(catalogPath)) return [];
    try {
        const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
        return catalog.packages || catalog.products || [];
    } catch (e) { return []; }
}

// ═══════════════════════════════════════════════════════════
//  MAPPERS: JSON Shape ↔ Prisma Shape
// ═══════════════════════════════════════════════════════════

function mapCustomerToPrisma(json) {
    const p = json.profile || {};
    const c = json.contact_info || p.contact_info || {};
    const s = json.social_profiles?.facebook || {};
    const w = json.wallet || {};

    return {
        customerId: json.customer_id,
        memberId: p.member_id || null,
        status: p.status || 'Active',
        firstName: p.first_name || null,
        lastName: p.last_name || null,
        nickName: p.nick_name || null,
        jobTitle: p.job_title || null,
        company: p.company || null,
        membershipTier: p.membership_tier || 'MEMBER',
        lifecycleStage: p.lifecycle_stage || 'Lead',
        joinDate: p.join_date ? new Date(p.join_date) : null,
        email: c.email || null,
        phonePrimary: c.phone_primary || null,
        facebookId: s.id || null,
        facebookName: s.name || null,
        walletBalance: w.balance || 0,
        walletPoints: w.points || 0,
        walletCurrency: w.currency || 'THB',
        intelligence: json.intelligence || {},
        conversationId: json.conversation_id || null
    };
}

// ─── Export current adapter info ────────────────────────────
export function getAdapterInfo() {
    return {
        adapter: DB_ADAPTER,
        description: DB_ADAPTER === 'prisma'
            ? 'PostgreSQL / Supabase (via Prisma ORM)'
            : 'JSON Flat Files (Local)',
        dataDir: DB_ADAPTER === 'json' ? DATA_DIR : null
    };
}
