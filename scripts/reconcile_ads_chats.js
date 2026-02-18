const fs = require('fs');
const path = require('path');

const DATA_HUB_PATH = '/Users/ideab/Desktop/data_hub';
const MARKETING_LOGS_PATH = path.join(DATA_HUB_PATH, 'marketing/logs/daily/2026/02');
const CUSTOMER_PATH = path.join(DATA_HUB_PATH, 'customer');

// Keywords to associate chats with the "Sushi" campaign
const SUSHI_KEYWORDS = ['ซูชิ', 'Sushi', '4900', '3900', 'ปั้นข้าว', 'Salmon', 'แซลมอน'];
const PAYMENT_KEYWORDS = ['โอน', 'สลิป', 'slip', 'transfer', 'ชำระ'];

async function reconcile() {
    console.log('Starting Reconciliation for February 2026...');

    // --- 1. Aggregating Marketing Data ---
    const campaignStats = {};

    if (fs.existsSync(MARKETING_LOGS_PATH)) {
        const dailyFiles = fs.readdirSync(MARKETING_LOGS_PATH).filter(f => f.endsWith('.json'));

        dailyFiles.forEach(file => {
            const content = JSON.parse(fs.readFileSync(path.join(MARKETING_LOGS_PATH, file), 'utf8'));

            if (content.campaigns) {
                content.campaigns.forEach(camp => {
                    if (!campaignStats[camp.id]) {
                        campaignStats[camp.id] = {
                            name: camp.name,
                            spend: 0,
                            messaging_connections: 0,
                            clicks: 0,
                            purchases: 0,
                            purchase_value: 0
                        };
                    }

                    campaignStats[camp.id].spend += camp.spend || 0;
                    campaignStats[camp.id].clicks += camp.clicks || 0;

                    if (camp.actions) {
                        const msgAction = camp.actions.find(a => a.action_type === 'onsite_conversion.total_messaging_connection');
                        if (msgAction) {
                            campaignStats[camp.id].messaging_connections += parseFloat(msgAction.value || 0);
                        }

                        const purchaseAction = camp.actions.find(a => a.action_type === 'omni_purchase' || a.action_type === 'purchase');
                        if (purchaseAction) {
                            campaignStats[camp.id].purchases += parseFloat(purchaseAction.value || 0);
                        }
                    }

                    if (camp.action_values) {
                        const purchaseValue = camp.action_values.find(a => a.action_type === 'omni_purchase' || a.action_type === 'purchase');
                        if (purchaseValue) {
                            campaignStats[camp.id].purchase_value += parseFloat(purchaseValue.value || 0);
                        }
                    }
                });
            }
        });
    }

    // --- 2. Analyze Chat Logs ---
    const chatStats = {
        total_feb_chats: 0,
        sushi_campaign_matches: [],
        admin_context_matches: [], // New category for Admin-led context
        confirmed_sales: []
    };

    const PAGE_ID = '170707786504';
    const PAGE_NAME = 'The V School';

    if (fs.existsSync(CUSTOMER_PATH)) {
        const customerDirs = fs.readdirSync(CUSTOMER_PATH);

        for (const custDir of customerDirs) {
            if (custDir.startsWith('.')) continue; // skip .DS_Store
            const chatHistoryPath = path.join(CUSTOMER_PATH, custDir, 'chathistory');

            if (fs.existsSync(chatHistoryPath)) {
                const chatFiles = fs.readdirSync(chatHistoryPath).filter(f => f.endsWith('.json'));

                for (const chatFile of chatFiles) {
                    try {
                        const chatData = JSON.parse(fs.readFileSync(path.join(chatHistoryPath, chatFile), 'utf8'));

                        if (!chatData.messages || !chatData.messages.data) continue;

                        const messages = chatData.messages.data;
                        // reverse to get chronological order (oldest first) if needed, but FB API usually gives newest first. 
                        // Let's rely on finding the "First Reply" by looking for the first message FROM the page that appears after a customer message.
                        // Actually, simpler: Look at ALL messages from the Page. If ANY overlap with keywords, it's a match.

                        const hasFebActivity = messages.some(m => m.created_time && m.created_time.includes('2026-02'));

                        if (hasFebActivity) {
                            chatStats.total_feb_chats++;

                            const allText = messages.map(m => m.message || '').join(' ').toLowerCase();

                            // Check specifically for Admin's First Response/Context
                            const adminMessages = messages.filter(m => m.from && (m.from.id === PAGE_ID || m.from.name === PAGE_NAME));
                            const adminText = adminMessages.map(m => m.message || '').join(' ').toLowerCase();

                            const isSushi = SUSHI_KEYWORDS.some(k => allText.includes(k.toLowerCase()));
                            const isAdminContextSushi = SUSHI_KEYWORDS.some(k => adminText.includes(k.toLowerCase()));
                            const isPayment = PAYMENT_KEYWORDS.some(k => allText.includes(k.toLowerCase()));

                            if (isSushi || isAdminContextSushi) {
                                const matchType = isAdminContextSushi ? 'Admin Context' : 'Customer Keyword';

                                chatStats.sushi_campaign_matches.push({
                                    customer_id: custDir,
                                    file: chatFile,
                                    is_payment: isPayment,
                                    match_type: matchType
                                });

                                if (isPayment) {
                                    chatStats.confirmed_sales.push({
                                        customer_id: custDir,
                                        file: chatFile,
                                        confidence: 'High (Sushi Context)'
                                    });
                                }
                            } else if (isPayment) {
                                // potential sale but context missing
                                chatStats.confirmed_sales.push({
                                    customer_id: custDir,
                                    file: chatFile,
                                    confidence: 'Low (Payment detected, No Sushi keyword)'
                                });
                            }
                        }
                    } catch (e) {
                        // ignore corrupt JSON
                    }
                }
            }
        }
    }

    // --- 3. Generate Report ---
    console.log('\n--- Marketing Campaign Stats (Feb 2026) ---');
    console.table(Object.values(campaignStats).map(c => ({
        Name: c.name,
        Spend: c.spend.toFixed(2),
        'Msg Start': c.messaging_connections,
        Clicks: c.clicks,
        Purchases: c.purchases,
        'Value (THB)': c.purchase_value.toFixed(2)
    })));

    console.log('\n--- Chat Analysis (Feb 2026) ---');
    console.log(`Total Active Chats in Feb: ${chatStats.total_feb_chats}`);
    console.log(`Chats Linked to 'Sushi'/'4900': ${chatStats.sushi_campaign_matches.length}`);
    console.log(`Potential Sales (Payment keywords detected): ${chatStats.confirmed_sales.length}`);

    console.log('\n--- Potential Customers (Sales Candidates) ---');

    // List ALL Sushi Matches for manual review
    chatStats.sushi_campaign_matches.forEach(m => {
        console.log(`- Customer: ${m.customer_id} [${m.match_type}] (Payment Detect: ${m.is_payment})`);
    });

    // Deduplicate by Customer ID
    const uniqueCustomers = {};
    chatStats.confirmed_sales.forEach(s => {
        // Prioritize High confidence matches
        if (!uniqueCustomers[s.customer_id] || (uniqueCustomers[s.customer_id].confidence.startsWith('Low') && s.confidence.startsWith('High'))) {
            uniqueCustomers[s.customer_id] = s;
        }
    });

    console.log('\n--- Deep Dive: Transaction History (Feb Payers) ---');

    // Regex to capture amounts (e.g., "1000", "3,900", "3900")
    // Simple heuristic: 3-5 digit numbers
    const amountRegex = /[\d,]{3,5}/g;

    Object.values(uniqueCustomers).forEach(m => {
        console.log(`\nCustomer: ${m.customer_id} [${m.confidence}]`);

        try {
            // Read file again to parse individual messages for dates/amounts
            const chatData = JSON.parse(fs.readFileSync(path.join(CUSTOMER_PATH, m.customer_id, 'chathistory', m.file), 'utf8'));
            const messages = chatData.messages.data; // usually new to old

            // Sort chronologically (Oldest First)
            messages.sort((a, b) => new Date(a.created_time) - new Date(b.created_time));

            if (messages.length > 0) {
                console.log(`  - History Range: ${messages[0].created_time} to ${messages[messages.length - 1].created_time}`);
            }

            let totalEstimated = 0;

            messages.forEach(msg => {
                const text = (msg.message || '').toLowerCase();
                // Check for payment context in this specific message
                const isPayMsg = PAYMENT_KEYWORDS.some(k => text.includes(k.toLowerCase())) || text.includes('deposit') || text.includes('มัดจำ');

                if (isPayMsg) {
                    // Try to extract numbers
                    const foundNumbers = (msg.message || '').match(amountRegex);
                    if (foundNumbers) {
                        // Filter sensible amounts (exclude years like 2026)
                        const validAmounts = foundNumbers.map(n => parseFloat(n.replace(/,/g, ''))).filter(n => n > 100 && n < 50000 && n !== 2026);

                        if (validAmounts.length > 0) {
                            const amount = Math.max(...validAmounts); // assume biggest number in payment msg is the amount
                            totalEstimated += amount;
                            console.log(`  - [${msg.created_time}] "${msg.message.replace(/\n/g, ' ').substring(0, 50)}..." -> Amount: ${amount}`);
                        } else {
                            console.log(`  - [${msg.created_time}] "${msg.message.replace(/\n/g, ' ').substring(0, 50)}..." (Payment Keyword, No Amount)`);
                        }
                    } else {
                        console.log(`  - [${msg.created_time}] "${msg.message.replace(/\n/g, ' ').substring(0, 50)}..." (Payment Keyword, No Amount)`);
                    }
                }
            });

            console.log(`  => Estimated Total Paid: ${totalEstimated}`);

        } catch (err) {
            console.log(`  - Error reading history: ${err.message}`);
        }
    });
}

reconcile();
