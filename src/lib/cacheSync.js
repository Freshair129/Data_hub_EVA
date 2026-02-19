/**
 * cacheSync.js
 * ─────────────────────────────────────────────────────────────
 * Local JSON Cache: Read / Write / Invalidate
 * 
 * Cache directory structure mirrors sys.md design:
 *   cache/
 *     customer/{customerId}/profile.json
 *     customer/{customerId}/chathistory/{convId}.json
 *     ads/campaign/{campaignId}.json
 *     ads/ad_set/{adSetId}.json
 *     ads/ad/{adId}.json
 *     ad_logs/daily/{date}.json
 *     ad_logs/monthly/{month}.json
 *     employee/{employeeId}.json
 *     products/courses/{productId}.json
 *     products/packages/{productId}.json
 */

import fs from 'fs';
import path from 'path';

// Cache root is at crm-app/cache/
const CACHE_ROOT = path.resolve(process.cwd(), 'cache');

// ─── Helpers ───────────────────────────────────────────────────

function getCachePath(entity, ...segments) {
    return path.join(CACHE_ROOT, entity, ...segments.map(String));
}

function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// ─── Core API ──────────────────────────────────────────────────

/**
 * Write data to cache.
 * @param {string} entity  - e.g. 'customer', 'ads/campaign'
 * @param {string} id      - e.g. 'TVS-CUS-FB-26-0001'
 * @param {object} data    - Plain JS object to cache
 */
export function writeCacheEntry(entity, id, data) {
    try {
        const filePath = getCachePath(entity, `${id}.json`);
        ensureDir(filePath);

        const payload = {
            _cachedAt: new Date().toISOString(),
            _source: 'db',
            ...data
        };

        fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
        console.log(`[Cache] ✅ Written: cache/${entity}/${id}.json`);
        return true;
    } catch (err) {
        console.error(`[Cache] ❌ Write failed (${entity}/${id}):`, err.message);
        return false;
    }
}

/**
 * Read data from cache. Returns null if not found.
 * @param {string} entity
 * @param {string} id
 * @returns {object|null}
 */
export function readCacheEntry(entity, id) {
    try {
        const filePath = getCachePath(entity, `${id}.json`);
        if (!fs.existsSync(filePath)) return null;

        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        console.log(`[Cache] 🗃 Hit: cache/${entity}/${id}.json`);
        return data;
    } catch (err) {
        console.error(`[Cache] ❌ Read failed (${entity}/${id}):`, err.message);
        return null;
    }
}

/**
 * Read all entries in an entity folder (e.g. list all customers).
 * For 'customer' entity, it now looks inside each {id} folder and reads profile.json.
 * @param {string} entity
 * @returns {object[]}
 */
export function readCacheList(entity) {
    try {
        const dir = path.join(CACHE_ROOT, entity);
        if (!fs.existsSync(dir)) return [];

        const items = fs.readdirSync(dir);

        if (entity === 'customer') {
            return items
                .filter(folder => fs.statSync(path.join(dir, folder)).isDirectory() && !folder.startsWith('.'))
                .map(folder => {
                    try {
                        const profilePath = path.join(dir, folder, 'profile.json');
                        if (!fs.existsSync(profilePath)) return null;
                        const data = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));

                        // Merge wallet, inventory, and cart if they exist for legacy compatibility in UI
                        const walletPath = path.join(dir, folder, 'wallet.json');
                        const invPath = path.join(dir, folder, 'inventory.json');
                        const cartPath = path.join(dir, folder, 'cart.json');

                        if (fs.existsSync(walletPath)) {
                            const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
                            data.wallet = walletData;
                        }
                        if (fs.existsSync(invPath)) {
                            const invData = JSON.parse(fs.readFileSync(invPath, 'utf-8'));
                            data.inventory = invData;
                        }
                        if (fs.existsSync(cartPath)) {
                            const cartData = JSON.parse(fs.readFileSync(cartPath, 'utf-8'));
                            data.cart = cartData;
                        }

                        return data;
                    } catch { return null; }
                })
                .filter(Boolean);
        }

        return items
            .filter(f => f.endsWith('.json'))
            .map(f => {
                try {
                    return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
                } catch { return null; }
            })
            .filter(Boolean);
    } catch (err) {
        console.error(`[Cache] ❌ List failed (${entity}):`, err.message);
        return [];
    }
}

/**
 * Split and write customer cache files.
 * @param {string} id - Customer ID
 * @param {object} data - Full customer object
 */
export function writeCustomerCache(id, data) {
    try {
        const dir = getCachePath('customer', id);
        ensureDir(path.join(dir, 'profile.json'));

        const now = new Date().toISOString();

        // 1. Profile (Main info)
        const profile = {
            _cachedAt: now,
            _source: 'db',
            id: data.id,
            customerId: data.customerId || data.customer_id,
            memberId: data.memberId || data.member_id,
            firstName: data.firstName || data.profile?.first_name,
            lastName: data.lastName || data.profile?.last_name,
            nickName: data.nickName || data.profile?.nick_name,
            status: data.status,
            membershipTier: data.membershipTier,
            lifecycleStage: data.lifecycleStage,
            email: data.email,
            phonePrimary: data.phonePrimary,
            facebookId: data.facebookId,
            intelligence: data.intelligence,
            // ... add other essential profile fields
        };
        fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify(profile, null, 2));

        // 2. Wallet
        const wallet = {
            _cachedAt: now,
            balance: data.walletBalance || data.wallet?.balance || 0,
            points: data.walletPoints || data.wallet?.points || 0,
            currency: data.walletCurrency || data.wallet?.currency || 'THB'
        };
        fs.writeFileSync(path.join(dir, 'wallet.json'), JSON.stringify(wallet, null, 2));

        // 3. Inventory
        const inventory = {
            _cachedAt: now,
            items: data.inventory || []
        };
        fs.writeFileSync(path.join(dir, 'inventory.json'), JSON.stringify(inventory, null, 2));

        // 4. Cart
        const cart = {
            _cachedAt: now,
            items: data.cart || []
        };
        fs.writeFileSync(path.join(dir, 'cart.json'), JSON.stringify(cart, null, 2));

        console.log(`[Cache] 👤 Written customer/${id}/ (Split: profile, wallet, inventory, cart)`);
        return true;
    } catch (err) {
        console.error(`[Cache] ❌ Customer write failed (${id}):`, err.message);
        return false;
    }
}

/**
 * Delete a specific cache entry.
 * @param {string} entity
 * @param {string} id
 */
export function invalidateCacheEntry(entity, id) {
    try {
        const filePath = getCachePath(entity, `${id}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[Cache] 🗑 Invalidated: cache/${entity}/${id}.json`);
        }
        return true;
    } catch (err) {
        console.error(`[Cache] ❌ Invalidate failed (${entity}/${id}):`, err.message);
        return false;
    }
}

/**
 * Check if a cache entry exists and how old it is (in minutes).
 * @param {string} entity
 * @param {string} id
 * @param {number} maxAgeMinutes - Default 60 minutes
 * @returns {boolean} true if cache is fresh
 */
export function isCacheFresh(entity, id, maxAgeMinutes = 60) {
    const data = readCacheEntry(entity, id);
    if (!data || !data._cachedAt) return false;

    const ageMs = Date.now() - new Date(data._cachedAt).getTime();
    return ageMs < maxAgeMinutes * 60 * 1000;
}

// ─── Aggregate Helpers ─────────────────────────────────────────

/**
 * Rebuild the lightweight customer index.
 * Reads all customer cache files and writes a slim __index__.json
 * for fast rendering of CustomerList (no full profile needed).
 * 
 * @param {object[]} [customers] - Optional pre-loaded list; if omitted, reads from cache files
 */
export function rebuildCustomerIndex(customers) {
    try {
        const source = customers || readCacheList('customer');

        const index = source
            .filter(c => !c.__isIndex) // skip the index file itself
            .map(c => ({
                id: c.customerId || c.customer_id || c.id,
                name: c.name || `${c.profile?.first_name || ''} ${c.profile?.last_name || ''}`.trim() || 'ไม่ระบุ',
                tier: c.membershipTier || c.profile?.membership_tier || 'GENERAL',
                status: c.status || c.profile?.status || 'Active',
                agent: c.profile?.agent || null,
                channel: c.contactInfo?.leadChannel || c.contact_info?.lead_channel || null,
                _cachedAt: c._cachedAt,
            }));

        const filePath = getCachePath('customer', '__index__.json');
        ensureDir(filePath);
        fs.writeFileSync(filePath, JSON.stringify({
            __isIndex: true,
            _cachedAt: new Date().toISOString(),
            total: index.length,
            data: index,
        }, null, 2), 'utf-8');

        console.log(`[Cache] 📋 Customer index rebuilt: ${index.length} entries`);
        return true;
    } catch (err) {
        console.error('[Cache] ❌ rebuildCustomerIndex failed:', err.message);
        return false;
    }
}

/**
 * Compute and cache the analytics summary.
 * Aggregates customer & order data into KPIs for Dashboard / Analytics.
 * 
 * @param {object[]} customers - Full customer list
 * @param {object[]} [orders]  - Order list (optional, for revenue)
 */
export function computeAnalyticsSummary(customers, orders = []) {
    try {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // ── Customer KPIs ──
        const totalCustomers = customers.length;

        const newThisMonth = customers.filter(c => {
            const joined = new Date(c.profile?.join_date || c.createdAt || 0);
            return joined.getMonth() === currentMonth && joined.getFullYear() === currentYear;
        }).length;

        const byTier = customers.reduce((acc, c) => {
            const tier = c.membershipTier || c.profile?.membership_tier || 'GENERAL';
            acc[tier] = (acc[tier] || 0) + 1;
            return acc;
        }, {});

        const byStatus = customers.reduce((acc, c) => {
            const status = c.status || c.profile?.status || 'Active';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});

        const byChannel = customers.reduce((acc, c) => {
            const ch = c.contactInfo?.leadChannel || c.contact_info?.lead_channel || 'Unknown';
            acc[ch] = (acc[ch] || 0) + 1;
            return acc;
        }, {});

        // ── Revenue KPIs (from orders if available) ──
        const totalRevenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
        const revenueThisMonth = orders.filter(o => {
            const d = new Date(o.createdAt || 0);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).reduce((sum, o) => sum + (o.amount || 0), 0);

        const summary = {
            _cachedAt: now.toISOString(),
            customers: {
                total: totalCustomers,
                newThisMonth,
                byTier,
                byStatus,
                byChannel,
            },
            revenue: {
                total: totalRevenue,
                thisMonth: revenueThisMonth,
                orderCount: orders.length,
                aov: orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0,
            },
        };

        writeCacheEntry('analytics', 'summary', summary);
        console.log(`[Cache] 📊 Analytics summary updated (${totalCustomers} customers, ฿${totalRevenue} revenue)`);
        return summary;
    } catch (err) {
        console.error('[Cache] ❌ computeAnalyticsSummary failed:', err.message);
        return null;
    }
}

/**
 * Write daily marketing performance to cache.
 * @param {string} date - YYYY-MM-DD
 * @param {object} data - Aggregate insights for the day
 */
export function writeMarketingDailyCache(date, data) {
    return writeCacheEntry('ad_logs/daily', date, data);
}

/**
 * Rebuild marketing metrics cache from provided daily data.
 * Populates ad_logs/daily/{date}.json and pushes aggregate stats to summary.json.
 * 
 * @param {object[]} dailyMetrics - Array of { ad_id, date, spend, impressions, clicks, leads, purchases }
 */
export function rebuildMarketingMetrics(dailyMetrics) {
    try {
        // Group by date
        const byDate = dailyMetrics.reduce((acc, m) => {
            const d = m.date.toISOString().split('T')[0];
            if (!acc[d]) acc[d] = { date: d, spend: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0, ads: [] };
            acc[d].spend += m.spend;
            acc[d].impressions += m.impressions;
            acc[d].clicks += m.clicks;
            acc[d].leads += m.leads;
            acc[d].purchases += m.purchases;
            acc[d].ads.push(m);
            return acc;
        }, {});

        // Write daily files
        for (const date in byDate) {
            writeMarketingDailyCache(date, byDate[date]);
        }

        console.log(`[Cache] 📈 Marketing metrics rebuilt for ${Object.keys(byDate).length} days`);
        return true;
    } catch (err) {
        console.error('[Cache] ❌ rebuildMarketingMetrics failed:', err.message);
        return false;
    }
}
