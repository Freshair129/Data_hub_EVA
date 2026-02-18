import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * AI Financial Auditor Bridge
 */
export async function runAIFinancialAudit(customerId, chatMessages, reportedValue) {
    return new Promise((resolve, reject) => {
        const pythonScript = path.join(process.cwd(), 'src/workers/python/financial_auditor.py');

        // Prepare data for Python
        const auditInput = {
            id: customerId,
            messages: chatMessages,
            value: reportedValue
        };

        // We'll wrap the auditor call in a temporary runner or update auditor.py to accept JSON stdin
        // For now, let's create a temporary runner script
        const runnerCode = `
import sys
import json
from financial_auditor import audit_financial_context

input_data = json.loads(sys.stdin.read())
result = audit_financial_context(input_data['id'], input_data['messages'], input_data['value'])
print(json.dumps(result))
`;
        const runnerPath = path.join(process.cwd(), 'src/workers/python/ai_audit_runner.py');
        fs.writeFileSync(runnerPath, runnerCode);

        const py = spawn('python3', [runnerPath]);
        let output = '';
        let error = '';

        py.stdin.write(JSON.stringify(auditInput));
        py.stdin.end();

        py.stdout.on('data', (data) => {
            output += data.toString();
        });

        py.stderr.on('data', (data) => {
            error += data.toString();
        });

        py.on('close', (code) => {
            fs.unlinkSync(runnerPath); // Cleanup
            if (code !== 0) {
                console.error(`[AIAuditor] ❌ AI Audit failed: ${error}`);
                return reject(new Error(error));
            }
            try {
                const result = JSON.parse(output);
                resolve(result);
            } catch (e) {
                reject(e);
            }
        });
    });
}
