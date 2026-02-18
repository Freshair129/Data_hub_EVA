import fs from 'fs';
import path from 'path';

const DOCS_DIR = path.join(process.cwd(), 'docs');
const TASKS_DIR = path.join(DOCS_DIR, 'tasks');
const PERMANENT_DIR = path.join(TASKS_DIR, 'permanent');
const INDEX_FILE = path.join(TASKS_DIR, 'tasks_index.json');
const BUFFER_SIZE = 100;

/**
 * Task Manager
 */
export function addTask({ name, context, metadata = {} }) {
    if (!fs.existsSync(TASKS_DIR)) fs.mkdirSync(TASKS_DIR, { recursive: true });
    if (!fs.existsSync(PERMANENT_DIR)) fs.mkdirSync(PERMANENT_DIR, { recursive: true });

    const timestamp = new Date().toISOString();
    const taskId = `TSK-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const filename = `${taskId}.json`;
    const filePath = path.join(TASKS_DIR, filename);

    const taskData = {
        taskId,
        name,
        timestamp,
        status: 'COMPLETED',
        context,
        metadata
    };

    fs.writeFileSync(filePath, JSON.stringify(taskData, null, 2));

    // Update Index & Rotate Buffer
    let index = [];
    if (fs.existsSync(INDEX_FILE)) {
        index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    }

    index.push(filename);

    if (index.length > BUFFER_SIZE) {
        const toDelete = index.shift();
        const deletePath = path.join(TASKS_DIR, toDelete);
        if (fs.existsSync(deletePath)) {
            fs.unlinkSync(deletePath);
            console.log(`[TaskManager] 🗑️ Buffer Full. Deleted old task: ${toDelete}`);
        }
    }

    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
    console.log(`[TaskManager] ✅ Task Logged: ${taskId}`);
    return taskId;
}

/**
 * Escalate Task to Permanent Storage
 */
export function escalateTask(taskId) {
    const filename = `${taskId}.json`;
    const sourcePath = path.join(TASKS_DIR, filename);
    const destPath = path.join(PERMANENT_DIR, filename);

    if (fs.existsSync(sourcePath)) {
        fs.renameSync(sourcePath, destPath);

        // Remove from index
        if (fs.existsSync(INDEX_FILE)) {
            let index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
            index = index.filter(f => f !== filename);
            fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
        }

        console.log(`[TaskManager] 🛡️ Task Escalated to Permanent: ${taskId}`);
        return true;
    }

    // Check if already in permanent
    if (fs.existsSync(destPath)) {
        return true;
    }

    console.warn(`[TaskManager] ⚠️ Task not found for escalation: ${taskId}`);
    return false;
}
