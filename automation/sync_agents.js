const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// CONFIGURATION
const FETCH_URL = 'http://localhost:3000/api/marketing/chat/assign';
const META_INBOX_URL = 'https://business.facebook.com/latest/inbox/all';

// [OPTION] ใช้ Profile ส่วนตัว (จะข้ามขั้นตอน Login ได้เลย)
// **ข้อควรระวัง**: ต้องปิด Chrome ปกติก่อนรันสคริปต์นี้ เพราะมันใช้ข้อมูลทับกันไม่ได้ครับ
// ตัวอย่าง: '/Users/ideab/Library/Application Support/Google/Chrome/Profile 15'
const USER_DATA_DIR = process.env.CHROME_PROFILE_PATH || path.join(__dirname, 'user_data');

async function syncAgents() {
    console.log(`[${new Date().toLocaleString()}] Starting Agent Sync...`);

    // 1. Launch Browser with Persistent Context (Login stays active)
    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: false, // Set to false so user can log in if needed
        viewport: { width: 1280, height: 800 }
    });

    const page = await context.newPage();

    try {
        console.log('Navigating to Meta Inbox...');
        await page.goto(META_INBOX_URL, { waitUntil: 'networkidle' });

        // Check if we need to log in
        if (page.url().includes('login') || page.url().includes('facebook.com/login')) {
            console.log('\n-------------------------------------------------------------');
            console.log('⚠️  ACTION REQUIRED: LOGIN TO FACEBOOK');
            console.log('1. ในหน้าต่างเบราเซอร์ที่เปิดขึ้นมา ให้ Boss ล็อคอิน Facebook ครับ');
            console.log('2. เมื่อล็อคอินเสร็จ ระบบจะพาไปหน้า Inbox เองอัตโนมัติ');
            console.log('3. ห้ามปิดหน้าต่างเบราเซอร์จนกว่าระบบจะเริ่มอ่านข้อมูลครับ');
            console.log('-------------------------------------------------------------\n');

            try {
                // Wait for the inbox URL to appear (meaning login is successful)
                await page.waitForURL('**/latest/inbox/**', { timeout: 300000 }); // 5 min timeout
            } catch (waitErr) {
                if (page.isClosed()) {
                    throw new Error('เบราเซอร์ถูกปิดก่อนล็อคอินเสร็จครับ กรุณารันคำสั่งใหม่อีกครั้ง');
                }
                throw waitErr;
            }
        }

        console.log('Inbox reached. Syncing conversations...');

        // Wait for chat list to load
        await page.waitForSelector('div[role="navigation"]', { timeout: 30000 });

        // 2. Iterate through conversations in the sidebar
        // Note: Meta uses complicated classes. We'll target clickable chat items.
        const chatItems = await page.$$('div[role="listitem"]');
        console.log(`Found ${chatItems.length} potential conversations.`);

        for (let i = 0; i < Math.min(chatItems.length, 20); i++) {
            try {
                // Refresh items as DOM changes
                const currentItems = await page.$$('div[role="listitem"]');
                await currentItems[i].click();
                await page.waitForTimeout(2000); // Wait for chat to load

                // Get conversation ID from URL (e.g., .../all?selected_item_id=123)
                const url = page.url();
                const convIdMatch = url.match(/selected_item_id=([^&]+)/);
                const convId = convIdMatch ? convIdMatch[1] : null;

                if (!convId) continue;

                // 3. Extract "Sent by" or "ส่งโดย" name
                // Look for links with class uiLinkSubtle or text containing 'Sent by'
                const agentHandle = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a.uiLinkSubtle, span, div'));
                    const staffLink = links.find(el =>
                        el.textContent.includes('Sent by') ||
                        el.textContent.includes('ส่งโดย') ||
                        el.textContent.includes('Admin:')
                    );

                    if (staffLink) {
                        // Extract name: "Sent by Fah" -> "Fah"
                        return staffLink.textContent.replace(/Sent by|ส่งโดย|Admin:/g, '').trim();
                    }
                    return null;
                });

                if (agentHandle && agentHandle !== 'Me') {
                    console.log(`✅ Detected: Conv ${convId} -> Agent: ${agentHandle}`);

                    // 4. Update our CRM API
                    await page.evaluate(async ({ url, convId, agent }) => {
                        try {
                            await fetch(url, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ conversationId: convId, agentName: agent })
                            });
                        } catch (e) { console.error('API Update Failed', e); }
                    }, { url: FETCH_URL, convId, agent: agentHandle });
                }

            } catch (err) {
                console.error(`Error processing item ${i}:`, err.message);
            }
        }

        console.log('Done! Sync cycle completed.');

    } catch (err) {
        console.error('Critical Sync Error:', err);
    } finally {
        await context.close();
    }
}

// RUN ONCE OR INTERVAL
syncAgents();
// setInterval(syncAgents, 60 * 60 * 1000); // Every hour
