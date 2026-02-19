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
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { readCacheList, readCacheEntry } from './cacheSync.js';

const { Pool } = pg;

const DB_ADAPTER = process.env.DB_ADAPTER || 'json';
const DATA_DIR = path.join(process.cwd(), '..');

// ─── Lazy Prisma Loader ────────────────────────────────────
let _prisma = null;
export async function getPrisma() {
    if (!_prisma) {
        try {
            const { PrismaClient } = await import('@prisma/client');

            const connectionString = process.env.DATABASE_URL;
            if (!connectionString) throw new Error('DATABASE_URL is not set');

            const pool = new Pool({ connectionString });
            const adapter = new PrismaPg(pool);

            _prisma = new PrismaClient({ adapter });
            console.log('[DB] Connected via Prisma (PostgreSQL/Supabase + Adapter)');
        } catch (e) {
            console.error('[DB] Prisma Adapter init failed:', e);
            console.warn('[DB] Prisma not available, falling back to JSON:', e.message);
            return null;
        }
    }
    return _prisma;
}

export async function getAllCustomers() {
    if (DB_ADAPTER === 'prisma') {
        const prisma = await getPrisma();
        if (prisma) {
            try {
                return await prisma.customer.findMany({
                    include: { orders: true, inventory: true, timeline: true, cart: { include: { product: true } } }
                });
            } catch (e) {
                console.warn('[DB] Prisma query failed, falling back to Cache:', e.message);
            }
        }
    }

    // Cache/JSON Fallback using cacheSync
    const cached = readCacheList('customer');
    if (cached.length > 0) return cached;

    // Legacy JSON Fallback (data_hub/)
    return getAllCustomersFromJSON();
}

export async function getChatHistory(customerId) {
    if (DB_ADAPTER === 'prisma') {
        const prisma = await getPrisma();
        if (prisma) {
            try {
                return await prisma.conversation.findMany({
                    where: { customer: { customerId } },
                    include: { messages: { orderBy: { createdAt: 'desc' }, take: 50 } }
                });
            } catch (e) {
                console.warn('[DB] Prisma chat query failed, falling back to Cache:', e.message);
            }
        }
    }
    // Cache Fallback
    const cached = readCacheEntry(`customer/${customerId}/chathistory`, 'all'); // Or specific conv if we knew it
    if (cached) return cached.conversations || [];

    // Try to list all files in chathistory dir
    const list = readCacheList(`customer/${customerId}/chathistory`);
    return list;
}

export async function getCustomerById(customerId) {
    if (DB_ADAPTER === 'prisma') {
        const prisma = await getPrisma();
        if (prisma) {
            try {
                return await prisma.customer.findUnique({
                    where: { customerId },
                    include: {
                        orders: { include: { transactions: true } },
                        inventory: true,
                        timeline: true,
                        cart: { include: { product: true } }
                    }
                });
            } catch (e) {
                console.warn('[DB] Prisma query failed, falling back to Cache:', e.message);
            }
        }
    }

    // Cache/JSON Fallback (Split files: profile + wallet + ...)
    const cachedProfile = readCacheEntry(`customer/${customerId}`, 'profile');
    if (cachedProfile) {
        // Enforce same shape as Prisma for UI compatibility
        const wallet = readCacheEntry(`customer/${customerId}`, 'wallet') || {};
        const inventory = readCacheEntry(`customer/${customerId}`, 'inventory') || { items: [] };
        const cart = readCacheEntry(`customer/${customerId}`, 'cart') || { items: [] };

        return {
            ...cachedProfile,
            walletBalance: wallet.balance,
            walletPoints: wallet.points,
            walletCurrency: wallet.currency,
            inventory: inventory.items,
            cart: cart.items
        };
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
//  SHOPPING CART
// ═══════════════════════════════════════════════════════════

export async function getCart(customerId) {
    if (DB_ADAPTER === 'prisma') {
        const prisma = await getPrisma();
        if (prisma) {
            return prisma.cartItem.findMany({
                where: { customer: { customerId } },
                include: { product: true }
            });
        }
    }
    return []; // JSON Fallback (unsupported for now)
}

export async function upsertCartItem(customerId, productId, quantity) {
    if (DB_ADAPTER === 'prisma') {
        const prisma = await getPrisma();
        if (prisma) {
            return prisma.cartItem.upsert({
                where: {
                    customerId_productId: {
                        customerId: (await prisma.customer.findUnique({ where: { customerId } }))?.id,
                        productId: (await prisma.product.findUnique({ where: { productId } }))?.id
                    }
                },
                create: {
                    customer: { connect: { customerId } },
                    product: { connect: { productId } },
                    quantity
                },
                update: { quantity }
            });
        }
    }
    return null;
}

export async function removeFromCart(customerId, productId) {
    if (DB_ADAPTER === 'prisma') {
        const prisma = await getPrisma();
        if (prisma) {
            const customer = await prisma.customer.findUnique({ where: { customerId } });
            const product = await prisma.product.findUnique({ where: { productId } });
            if (customer && product) {
                return prisma.cartItem.delete({
                    where: {
                        customerId_productId: {
                            customerId: customer.id,
                            productId: product.id
                        }
                    }
                });
            }
        }
    }
    return null;
}

export async function clearCart(customerId) {
    if (DB_ADAPTER === 'prisma') {
        const prisma = await getPrisma();
        if (prisma) {
            return prisma.cartItem.deleteMany({
                where: { customer: { customerId } }
            });
        }
    }
    return null;
}

// ═══════════════════════════════════════════════════════════
//  PRODUCTS
// ═══════════════════════════════════════════════════════════

export async function getAllProducts() {
    if (DB_ADAPTER === 'prisma') {
        const prisma = await getPrisma();
        if (prisma) {
            try {
                return await prisma.product.findMany({ where: { isActive: true } });
            } catch (e) {
                console.warn('[DB] Prisma product query failed, falling back to Cache:', e.message);
            }
        }
    }
    const cached = readCacheList('products');
    if (cached.length > 0) return cached;
    return getProductsFromJSON();
}

// ═══════════════════════════════════════════════════════════
//  MARKETING & ADS
// ═══════════════════════════════════════════════════════════

export async function getAllCampaigns() {
    if (DB_ADAPTER === 'prisma') {
        const prisma = await getPrisma();
        if (prisma) {
            try {
                return await prisma.campaign.findMany({ include: { adSets: true } });
            } catch (e) {
                console.warn('[DB] Prisma campaign query failed, falling back to Cache:', e.message);
            }
        }
    }
    return readCacheList('ads/campaign');
}

export async function getMarketingSummary() {
    if (DB_ADAPTER === 'prisma') {
        const prisma = await getPrisma();
        if (prisma) {
            try {
                const campaigns = await prisma.campaign.findMany();
                const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
                const totalLeads = await prisma.customer.count({ where: { lifecycleStage: 'Lead' } });
                return { totalSpend, totalLeads, campaignCount: campaigns.length };
            } catch (e) {
                console.warn('[DB] Prisma marketing summary failed, falling back to Cache:', e.message);
            }
        }
    }
    return readCacheEntry('analytics', 'summary')?.marketing || {};
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
