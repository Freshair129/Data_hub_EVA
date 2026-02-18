import fs from 'fs';
import path from 'path';
import { getCustomerById } from './db.js';
import { escalateTask } from './taskManager.js';

const DOCS_DIR = path.join(process.cwd(), 'docs');
const INCIDENTS_DIR = path.join(DOCS_DIR, 'incidents');
const MASTER_LOG = path.join(DOCS_DIR, 'incident_log.md');
const CUSTOMER_DIR = path.join(process.cwd(), '..', 'customer');

/**
 * Automated Incident Manager (Structured Version)
 */
export async function createIncidentReport({
    title,
    category,
    severity = 'WARN',
    status = 'ERROR',
    taskId = null,
    errorId = null,
    lifecycle = {
        intent: 'Not specified',
        discovery: 'Not specified',
        attempts: [], // Array of { attempt: number, hypothesis: string, action: string }
        summary: 'Under investigation'
    },
    conversationId = null,
}) {
    const timestamp = new Date().toISOString().split('T')[0];
    const incidentId = `INC-${timestamp.replace(/-/g, '')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const filename = `${incidentId}.md`;
    const filePath = path.join(INCIDENTS_DIR, filename);

    if (!fs.existsSync(INCIDENTS_DIR)) fs.mkdirSync(INCIDENTS_DIR, { recursive: true });

    // 1. Fetch Chat Context
    let chatContext = 'No conversation context found.';
    if (conversationId) {
        try {
            const customerFolders = fs.readdirSync(CUSTOMER_DIR);
            const folder = customerFolders.find(f => f.includes(conversationId));

            if (folder) {
                const chatHistoryDir = path.join(CUSTOMER_DIR, folder, 'chathistory');
                if (fs.existsSync(chatHistoryDir)) {
                    const chatFiles = fs.readdirSync(chatHistoryDir);
                    const chatFile = chatFiles.find(f => f.startsWith('conv_') && f.endsWith('.json'));

                    if (chatFile) {
                        const chatData = JSON.parse(fs.readFileSync(path.join(chatHistoryDir, chatFile), 'utf8'));

                        // Handle both { data: [...] } and direct array
                        let messages = [];
                        if (chatData.messages && Array.isArray(chatData.messages.data)) {
                            messages = chatData.messages.data;
                        } else if (Array.isArray(chatData.messages)) {
                            messages = chatData.messages;
                        } else if (Array.isArray(chatData.chats)) {
                            messages = chatData.chats;
                        }

                        if (messages.length > 0) {
                            chatContext = messages.slice(-15).map(m =>
                                `${m.from?.name || m.sender || 'User'}: ${m.message || m.text || '[Media]'}`
                            ).join('\n');
                        } else {
                            chatContext = 'Conversation file found but no messages recorded.';
                        }
                    }
                }
            }
        } catch (e) {
            chatContext = `Error recovering chat context: ${e.message}`;
        }
    }

    // 2. Format Attempts
    const attemptsSection = lifecycle.attempts.length > 0
        ? lifecycle.attempts.map(a => `### Attempt ${a.attempt || '?'}\n- **Hypothesis (ข้อสันนิษฐาน)**: ${a.hypothesis}\n- **Action (การแก้ปัญหา)**: ${a.action}`).join('\n\n')
        : 'No recorded attempts.';

    // 3. Generate structured report
    const reportContent = `# 🚨 Incident Report: ${title}
**ID**: \`${incidentId}\`
**Date**: ${timestamp}
**Category**: \`${category}\`
**Severity**: \`${severity}\`
**Status**: \`${status}\`
**Task ID**: \`${taskId || 'N/A'}\`
**Error Reference**: \`${errorId || 'N/A'}\`

---

## 🏗️ Intent (จุดเริ่มต้น)
> what was supposed to happen / ordered system
${lifecycle.intent}

## 🔍 Discovery (การตรวจพบปัญหา)
> how and where the problem was identified
${lifecycle.discovery}

## 🛠️ Resolution Attempts (การแก้ปัญหา)
${attemptsSection}

## 🏁 Summary (สรุปผล)
> actual cause and why previous attempts failed vs final fix
${lifecycle.summary}

---

## 💬 Chat Context (ประวัติการสนทนาที่เกี่ยวข้อง)
\`\`\`text
${chatContext}
\`\`\`

---
*Generated automatically by IncidentManager v2.*
`;

    // 4. Escalate Task if ID provided
    if (taskId) {
        escalateTask(taskId);
    }

    fs.writeFileSync(filePath, reportContent, 'utf8');

    // 5. Update Master Index
    const indexEntry = `
## 📅 ${timestamp}: ${title}
**Ref ID**: \`${incidentId}\`
**Task ID**: \`${taskId || 'N/A'}\`
**Status**: \`${status}\`
**Report**: [${filename}](./incidents/${filename})
`;

    fs.appendFileSync(MASTER_LOG, indexEntry, 'utf8');

    console.log(`[IncidentManager] ✅ Created report: ${incidentId}`);
    return { incidentId, filename };
}
