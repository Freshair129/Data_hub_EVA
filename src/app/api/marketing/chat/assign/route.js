import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '../customer');

export async function POST(request) {
    try {
        const { conversationId, agentName } = await request.json();

        if (!conversationId || !agentName) {
            return NextResponse.json({ success: false, error: 'Missing conversationId or agentName' }, { status: 400 });
        }

        // 1. Identify customer directory (Conversation ID is the folder name suffix/match)
        // Usually, folder name is like MSG-12345, and conv ID is 12345
        let customerFolder = conversationId;
        if (!fs.existsSync(path.join(DATA_DIR, customerFolder))) {
            // Try matching with MSG- prefix
            customerFolder = `MSG-${conversationId}`;
        }

        const customerDir = path.join(DATA_DIR, customerFolder);
        if (!fs.existsSync(customerDir)) {
            return NextResponse.json({ success: false, error: 'Customer directory not found' }, { status: 404 });
        }

        // 2. Update Profile JSON
        const profilePath = path.join(customerDir, `profile_${customerFolder}.json`);
        if (fs.existsSync(profilePath)) {
            const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
            if (profile.profile) {
                profile.profile.agent = agentName;
            } else {
                profile.agent = agentName;
            }

            // Add to timeline
            if (!profile.timeline) profile.timeline = [];
            profile.timeline.push({
                id: `ASSIGN-${Date.now()}`,
                date: new Date().toISOString(),
                type: 'SYSTEM',
                summary: 'Agent Assigned Manually',
                details: { content: `Agent "${agentName}" was assigned via Chat Inbox.` }
            });

            fs.writeFileSync(profilePath, JSON.stringify(profile, null, 4));
        }

        // 3. Update Conversation History JSON (to reflect in Inbox immediately)
        const historyDir = path.join(customerDir, 'chathistory');
        if (fs.existsSync(historyDir)) {
            const convFile = path.join(historyDir, `conv_${conversationId}.json`);
            if (fs.existsSync(convFile)) {
                const convData = JSON.parse(fs.readFileSync(convFile, 'utf8'));
                convData.agent = agentName;
                fs.writeFileSync(convFile, JSON.stringify(convData, null, 4));
            }
        }

        return NextResponse.json({ success: true, agent: agentName });
    } catch (error) {
        console.error('Agent Assign Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
