const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..');
const CUSTOMER_DIR = path.join(DATA_DIR, 'customer');
const BACKUP_DIR = path.join(DATA_DIR, `backup_reconciliation_${Date.now()}`);

/**
 * Student 360 Merger Logic
 * ──────────────────────────────────────────
 * 1. Find all duplicates by Facebook ID
 * 2. Merge into WB (Workbook) if it exists, otherwise the first FB profile found.
 * 3. Consolidate: Agent, Orders, Transactions, Inventory, AI Tags, Timeline.
 */

async function runMerge() {
    console.log('🚀 Starting Student 360 Customer Reconciliation...');

    if (!fs.existsSync(CUSTOMER_DIR)) {
        console.error('❌ Customer directory not found:', CUSTOMER_DIR);
        return;
    }

    const folders = fs.readdirSync(CUSTOMER_DIR).filter(f =>
        fs.statSync(path.join(CUSTOMER_DIR, f)).isDirectory() && !f.startsWith('.')
    );

    const profilesById = {};
    const facebookToFolders = {};

    console.log(`📦 Scanning ${folders.length} folders...`);

    folders.forEach(folder => {
        const folderPath = path.join(CUSTOMER_DIR, folder);
        const files = fs.readdirSync(folderPath);
        const profileFile = files.find(f => f.startsWith('profile_') && f.endsWith('.json'));

        if (!profileFile) return;

        try {
            const profile = JSON.parse(fs.readFileSync(path.join(folderPath, profileFile), 'utf8'));
            const fbId = profile.contact_info?.facebook_id ||
                profile.social_profiles?.facebook?.id ||
                profile.facebook_id ||
                (profile.contact_info?.email && profile.contact_info.email.endsWith('@facebook.com') ? profile.contact_info.email.split('@')[0] : null);

            if (!fbId) return;

            if (!facebookToFolders[fbId]) facebookToFolders[fbId] = [];
            facebookToFolders[fbId].push({ folder, profile, profileFile });
        } catch (e) {
            console.error(`❌ Error reading ${folder}:`, e.message);
        }
    });

    const duplicates = Object.entries(facebookToFolders).filter(([id, list]) => list.length > 1);
    console.log(`🔍 Found ${duplicates.length} duplicate Facebook IDs.`);

    if (duplicates.length === 0) {
        console.log('✅ No duplicates found. System is clean.');
        return;
    }

    // Ensure backup dir exists
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`💾 Backup directory created: ${BACKUP_DIR}`);

    for (const [fbId, list] of duplicates) {
        console.log(`\n🔄 Merging profiles for Facebook ID: ${fbId} (${list.length} profiles)`);

        // Priority: WB profiles first
        list.sort((a, b) => {
            if (a.folder.includes('WB') && !b.folder.includes('WB')) return -1;
            if (b.folder.includes('WB') && !a.folder.includes('WB')) return 1;
            return a.folder.localeCompare(b.folder);
        });

        const canonical = list[0];
        const others = list.slice(1);

        console.log(`👉 Canonical: ${canonical.folder}`);

        for (const other of others) {
            console.log(`➕ Merging from: ${other.folder}`);
            mergeProfiles(canonical.profile, other.profile);

            // Move other folder to backup
            const sourcePath = path.join(CUSTOMER_DIR, other.folder);
            const targetPath = path.join(BACKUP_DIR, other.folder);

            try {
                fs.renameSync(sourcePath, targetPath);
            } catch (e) {
                console.error(`❌ Failed to move ${other.folder} to backup:`, e.message);
            }
        }

        // Save canonical
        const canonicalPath = path.join(CUSTOMER_DIR, canonical.folder, canonical.profileFile);
        fs.writeFileSync(canonicalPath, JSON.stringify(canonical.profile, null, 4), 'utf8');
        console.log(`✅ Saved unified profile to ${canonical.folder}`);
    }

    console.log('\n✨ Reconciliation Complete!');
}

function mergeProfiles(base, source) {
    // 1. Agent / Staff Assignment
    if (!base.profile.agent && source.profile.agent) {
        base.profile.agent = source.profile.agent;
    }

    // 2. Financials (Orders)
    if (source.orders && source.orders.length > 0) {
        if (!base.orders) base.orders = [];
        source.orders.forEach(ord => {
            if (!base.orders.find(o => o.order_id === ord.order_id)) {
                base.orders.push(ord);
            }
        });
    }

    // 3. Financials (Transactions)
    // Note: Some schemas have transactions inside orders, some outside.
    // We already handle inner orders. If there's an outer 'transactions' list:
    if (source.transactions && source.transactions.length > 0) {
        if (!base.transactions) base.transactions = [];
        source.transactions.forEach(trn => {
            if (!base.transactions.find(t => t.transaction_id === trn.transaction_id)) {
                base.transactions.push(trn);
            }
        });
    }

    // 4. Intelligence (Tags)
    if (source.intelligence?.tags) {
        if (!base.intelligence) base.intelligence = { tags: [] };
        if (!base.intelligence.tags) base.intelligence.tags = [];
        source.intelligence.tags.forEach(tag => {
            if (!base.intelligence.tags.includes(tag)) {
                base.intelligence.tags.push(tag);
            }
        });
    }

    // 5. Inventory (Courses)
    if (source.inventory?.learning_courses) {
        if (!base.inventory) base.inventory = { learning_courses: [], coupons: [] };
        if (!base.inventory.learning_courses) base.inventory.learning_courses = [];
        source.inventory.learning_courses.forEach(c => {
            if (!base.inventory.learning_courses.find(bc => bc.id === c.id)) {
                base.inventory.learning_courses.push(c);
            }
        });
    }

    // 6. Metrics
    if (source.intelligence?.metrics) {
        if (!base.intelligence.metrics) base.intelligence.metrics = { total_spend: 0, total_order: 0 };
        base.intelligence.metrics.total_spend = Math.max(base.intelligence.metrics.total_spend || 0, source.intelligence.metrics.total_spend || 0);
        base.intelligence.metrics.total_order = Math.max(base.intelligence.metrics.total_order || 0, source.intelligence.metrics.total_order || 0);
    }

    // 7. Timeline
    if (source.timeline && source.timeline.length > 0) {
        if (!base.timeline) base.timeline = [];
        source.timeline.forEach(event => {
            if (!base.timeline.find(e => e.id === event.id && e.date === event.date)) {
                base.timeline.push(event);
            }
        });
        // Sort timeline by date
        base.timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    // 8. Contact Info (Phones/Emails)
    if (!base.contact_info.phone_primary && source.contact_info?.phone_primary) {
        base.contact_info.phone_primary = source.contact_info.phone_primary;
    }
    if (!base.contact_info.email && source.contact_info?.email) {
        base.contact_info.email = source.contact_info.email;
    }
}

runMerge();
