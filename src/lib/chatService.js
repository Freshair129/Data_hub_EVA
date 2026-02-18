
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '../customer');
const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

/**
 * Chat Service
 * Handles fetching and persisting chat messages.
 */

// 1. Fetch Messages (Live -> Cache)
export async function syncChat(conversationId) {
    if (!conversationId) return { success: false, error: 'Missing Conversation ID' };

    let messages = [];

    // Try Facebook API
    try {
        if (PAGE_ACCESS_TOKEN) {
            const url = `https://graph.facebook.com/v19.0/${conversationId}/messages?fields=id,message,from,created_time,attachments{id,mime_type,name,file_url,image_data,url}&limit=50&access_token=${PAGE_ACCESS_TOKEN}`;
            const response = await fetch(url);
            const data = await response.json();

            if (response.ok) {
                // Facebook returns newest first
                messages = data.data || [];

                // Save to Local Cache
                await saveChatToCache(conversationId, messages);

                return { success: true, data: messages.slice().reverse(), source: 'facebook' };
            } else {
                console.warn(`FB API Error (${conversationId}):`, data.error?.message);
            }
        }
    } catch (error) {
        console.error('FB Fetch Error:', error);
    }

    // Fallback to Local Cache
    return getLocalChat(conversationId);
}

// 2. Save to Cache
async function saveChatToCache(conversationId, messages) {
    if (!fs.existsSync(DATA_DIR)) return;

    const folders = fs.readdirSync(DATA_DIR);
    for (const folder of folders) {
        const historyDir = path.join(DATA_DIR, folder, 'chathistory');
        // Check for standard naming or prefixed naming
        const possibleFiles = [
            path.join(historyDir, `conv_${conversationId}.json`),
            path.join(historyDir, `conv_t_${conversationId}.json`) // Some might have 't_' prefix
        ];

        for (const convFile of possibleFiles) {
            if (fs.existsSync(convFile)) {
                try {
                    const existing = JSON.parse(fs.readFileSync(convFile, 'utf8'));
                    // Update content
                    existing.messages = { data: messages }; // Save newest first (raw FB format)
                    existing.updated_time = new Date().toISOString();
                    fs.writeFileSync(convFile, JSON.stringify(existing, null, 4));
                    console.log(`[ChatService] Cached ${messages.length} messages for ${conversationId}`);
                    return;
                } catch (e) {
                    console.error('Cache Write Error:', e);
                }
            }
        }
    }
    // If not found, we currently don't create new files here (that's done by the sync/profile creation logic)
    // In a full implementation, we might want to create the folder structure if missing.
}

// 3. Read Local Cache
function getLocalChat(conversationId) {
    if (!fs.existsSync(DATA_DIR)) return { success: false, error: 'No Data Directory' };

    const folders = fs.readdirSync(DATA_DIR);
    for (const folder of folders) {
        const historyDir = path.join(DATA_DIR, folder, 'chathistory');
        const possibleFiles = [
            path.join(historyDir, `conv_${conversationId}.json`),
            path.join(historyDir, `conv_t_${conversationId}.json`)
        ];

        for (const filePath of possibleFiles) {
            if (fs.existsSync(filePath)) {
                try {
                    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    return {
                        success: true,
                        data: (content.messages?.data || []).slice().reverse(),
                        source: 'local'
                    };
                } catch (e) {
                    return { success: false, error: 'Corrupt Cache File' };
                }
            }
        }
    }
    return { success: false, error: 'Chat not found' };
}
