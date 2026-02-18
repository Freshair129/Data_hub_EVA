
import { getPrisma, writeErrorLog } from './db.js';

/**
 * Universal Error Logger
 * Logs errors to database (or JSONL fallback) with unique ID and context.
 * 
 * @param {Error|string} error - The error object or message
 * @param {string} category - Category (e.g. 'webhook', 'python_worker')
 * @param {Object} context - Context (user_id, request_body)
 * @param {string[]} tags - Tags (e.g. ['#critical', '#payment'])
 * @returns {Promise<string>} - The generated Error ID
 */
export async function logError(error, category = 'system', context = {}, tags = []) {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 12);
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const errorId = `ERR-${timestamp}-${randomSuffix}`;

    const message = error instanceof Error ? error.message : String(error);
    const stackTrace = error instanceof Error ? error.stack : new Error().stack;

    let severity = 'ERROR';
    if (tags.includes('#critical')) severity = 'CRITICAL';
    if (tags.includes('#warn')) severity = 'WARN';

    console.error(`[${severity}] [${errorId}] ${message}`, context);

    await writeErrorLog({
        errorId,
        category,
        severity,
        message,
        stackTrace,
        context: context || {},
        tags: tags || [],
        status: 'OPEN'
    });

    return errorId;
}

export async function findSolution(message) {
    // For now, simpler implementation since DB might be JSON
    // In future, this would query ErrorSolution table
    return null;
}
