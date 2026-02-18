import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const PAGE_ID = process.env.FB_PAGE_ID;
    const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
    const DATA_DIR = path.join(process.cwd(), '..', 'customer');

    let conversations = [];

    // 1. Try to fetch from Facebook (Live Data)
    try {
        if (PAGE_ACCESS_TOKEN && PAGE_ID) {
            const url = `https://graph.facebook.com/v19.0/${PAGE_ID}/conversations?fields=id,updated_time,snippet,participants,unread_count&access_token=${PAGE_ACCESS_TOKEN}`;
            const response = await fetch(url);
            const data = await response.json();

            if (response.ok) {
                conversations = data.data || [];
            } else {
                console.warn('Facebook API Error in conversations:', data.error?.message);

                // Log to API Activity
                try {
                    const logDir = path.join(process.cwd(), '..', 'marketing', 'logs', 'api');
                    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
                    const logFile = path.join(logDir, `${new Date().toISOString().split('T')[0]}.log`);
                    const logEntry = `[${new Date().toISOString()}] ERROR: Conversations Fetch - ${data.error?.message} (Code: ${data.error?.code})\n`;
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
        console.error('Facebook API Fetch Error:', err);
    }

    // 2. Load Local Data (Merge or Fallback)
    try {
        if (fs.existsSync(DATA_DIR)) {
            const customerFolders = fs.readdirSync(DATA_DIR);

            for (const folder of customerFolders) {
                const chatHistoryPath = path.join(DATA_DIR, folder, 'chathistory');
                if (fs.existsSync(chatHistoryPath)) {
                    const files = fs.readdirSync(chatHistoryPath);
                    const convFiles = files.filter(f => f.startsWith('conv_') && f.endsWith('.json'));

                    for (const file of convFiles) {
                        try {
                            const filePath = path.join(chatHistoryPath, file);
                            const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                            // Check if this conversation already exists in our list (from live data)
                            let targetConv = conversations.find(c => c.id === content.id);

                            if (!targetConv) {
                                // Add as local conversation if not in live data
                                targetConv = {
                                    id: content.id,
                                    updated_time: content.updated_time,
                                    snippet: content.messages?.data?.[0]?.message || 'Local History',
                                    participants: content.participants,
                                    unread_count: 0,
                                    agent: content.agent || 'Unassigned',
                                    is_local: true
                                };
                                conversations.push(targetConv);
                            }

                            // [CROSS-REFERENCE] Resolve the Best Profile (Handling Fragmentation)
                            try {
                                const primaryProfilePath = path.join(DATA_DIR, folder, `profile_${folder}.json`);
                                let bestProfile = null;

                                if (fs.existsSync(primaryProfilePath)) {
                                    bestProfile = JSON.parse(fs.readFileSync(primaryProfilePath, 'utf8'));
                                }

                                // If profile exists but lacks intelligence, search other folders with same ID
                                const fbId = bestProfile?.contact_info?.facebook_id || bestProfile?.facebook_id;
                                if (fbId && (!bestProfile.intelligence?.behavioral)) {
                                    const otherFolders = fs.readdirSync(DATA_DIR);
                                    for (const oFolder of otherFolders) {
                                        if (oFolder === folder) continue;
                                        const oProfilePath = path.join(DATA_DIR, oFolder, `profile_${oFolder}.json`);
                                        if (fs.existsSync(oProfilePath)) {
                                            const oProfile = JSON.parse(fs.readFileSync(oProfilePath, 'utf8'));
                                            const oFbId = oProfile?.contact_info?.facebook_id || oProfile?.facebook_id;
                                            if (oFbId === fbId && oProfile.intelligence?.behavioral) {
                                                bestProfile = oProfile;
                                                break;
                                            }
                                        }
                                    }
                                }

                                if (bestProfile) {
                                    targetConv.customer = bestProfile;
                                    const profileAgent = bestProfile.profile?.agent || bestProfile.agent;
                                    if (profileAgent && profileAgent !== 'Unassigned') {
                                        targetConv.agent = profileAgent;
                                    }
                                }
                            } catch (pErr) { console.error('Profile resolution error:', pErr); }
                        } catch (e) {
                            console.error(`Failed to parse local chat file ${file}:`, e);
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error('Local Chat Scan Error:', err);
    }

    // Sort by updated_time descending
    conversations.sort((a, b) => new Date(b.updated_time) - new Date(a.updated_time));

    return NextResponse.json({
        success: true,
        data: conversations,
        pageId: PAGE_ID || '170707786504' // Fallback to V School Page ID if env missing
    });
}
