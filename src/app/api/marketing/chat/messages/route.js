import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversation_id');
    const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
    const DATA_DIR = path.join(process.cwd(), '..', 'customer');

    if (!conversationId) {
        return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 });
    }

    let messages = [];

    // 1. Try to fetch from Facebook (Live Data)
    try {
        if (PAGE_ACCESS_TOKEN) {
            const url = `https://graph.facebook.com/v19.0/${conversationId}/messages?fields=id,message,from,created_time,attachments{id,mime_type,name,file_url,image_data,url}&limit=50&access_token=${PAGE_ACCESS_TOKEN}`;
            const response = await fetch(url);
            const data = await response.json();

            if (response.ok) {
                // Reverse to show chronological order (Graph API returns newest first)
                messages = (data.data || []).reverse();

                // [NEW] Save to Local Cache (Background)
                try {
                    // We need to find the customer folder first. 
                    // Strategy: Scan DATA_DIR for a folder containing 'chathistory/conv_{conversationId}.json'
                    if (fs.existsSync(DATA_DIR)) {
                        const folders = fs.readdirSync(DATA_DIR);
                        for (const folder of folders) {
                            const historyDir = path.join(DATA_DIR, folder, 'chathistory');
                            const convFile = path.join(historyDir, `conv_${conversationId}.json`);

                            if (fs.existsSync(convFile)) {
                                // Found it! Update with new messages.
                                const existing = JSON.parse(fs.readFileSync(convFile, 'utf8'));
                                existing.messages = { data: messages.slice().reverse() }; // Save raw format (newest first for storage)
                                existing.updated_time = new Date().toISOString();
                                fs.writeFileSync(convFile, JSON.stringify(existing, null, 4));
                                break; // Stop after updating
                            }
                        }
                    }
                } catch (saveErr) {
                    console.error('Failed to cache messages:', saveErr);
                }

                return NextResponse.json({ success: true, data: messages });
            } else {
                console.warn('Facebook API Error in messages:', data.error?.message);

                // Log to API Activity
                try {
                    const logDir = path.join(process.cwd(), '..', 'marketing', 'logs', 'api');
                    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
                    const logFile = path.join(logDir, `${new Date().toISOString().split('T')[0]}.log`);
                    const logEntry = `[${new Date().toISOString()}] ERROR: Messages Fetch - ${data.error?.message} (ID: ${conversationId})\n`;
                    fs.appendFileSync(logFile, logEntry);
                } catch (logErr) { console.error('Failed to write API log:', logErr); }

                if (data.error?.code === 190 || data.error?.type === 'OAuthException') {
                    return NextResponse.json({
                        success: false,
                        errorType: 'TOKEN_EXPIRED',
                        error: 'Facebook Page Access Token has expired.'
                    }, { status: 401 });
                }
            }
        }
    } catch (err) {
        console.error('Facebook API Messages Fetch Error:', err);
    }

    // 2. Fallback to Local Data
    try {
        if (fs.existsSync(DATA_DIR)) {
            const customerFolders = fs.readdirSync(DATA_DIR);

            for (const folder of customerFolders) {
                const chatHistoryPath = path.join(DATA_DIR, folder, 'chathistory');
                if (fs.existsSync(chatHistoryPath)) {
                    // Try to find the file matching the conversation ID
                    // Possible names: conv_t_[ID].json or conv_[ID].json
                    const possibleFiles = [
                        path.join(chatHistoryPath, `conv_${conversationId}.json`),
                        path.join(chatHistoryPath, `conv_t_${conversationId}.json`)
                    ];

                    for (const filePath of possibleFiles) {
                        if (fs.existsSync(filePath)) {
                            const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                            // Files usually store newest first, reverse for chronological
                            messages = (content.messages?.data || []).reverse();

                            return NextResponse.json({
                                success: true,
                                data: messages,
                                is_local: true
                            });
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error('Local Messages Scan Error:', err);
    }

    // If we reach here, we found nothing
    return NextResponse.json({
        success: true, // Return success with empty array instead of failing
        data: [],
        error: 'No history found (Facebook API failed and no local cache)'
    });
}
