import { spawn } from 'child_process';
import path from 'path';
import { createIncidentReport } from './incidentManager.js';

/**
 * Runs the Python Integrity Check and escalates anomalies
 */
export async function runAutomatedAudit() {
    return new Promise((resolve, reject) => {
        const pythonScript = path.join(process.cwd(), 'src/workers/python/integrity_check.py');
        console.log(`[Auditor] 🚀 Running Integrity Check: ${pythonScript}`);

        const py = spawn('python3', [pythonScript]);
        let output = '';

        py.stdout.on('data', (data) => {
            output += data.toString();
        });

        py.on('close', async (code) => {
            if (code !== 0) {
                console.error(`[Auditor] ❌ Python script failed with code ${code}`);
                return reject(new Error('Audit failed'));
            }

            // Simple parser for anomalies (looking for 🚨 FOUND X ANOMALIES)
            if (output.includes('🚨 FOUND')) {
                console.log('[Auditor] ⚠️ Anomalies detected! Escalating...');

                // Extract lines containing rule IDs
                const anomalyLines = output.split('\n').filter(line => line.includes('[LOGIC-ERR-'));

                for (const line of anomalyLines) {
                    const match = line.match(/\[(.*?)\] (MSG-.*?) -> (.*?) \(Value: (.*?) THB\)/);
                    if (match) {
                        const [full, ruleId, customerId, message, value] = match;
                        await createIncidentReport({
                            title: `Logic Anomaly: ${message.split('.')[0]}`,
                            category: 'logic_audit',
                            severity: 'WARN',
                            problem: message,
                            rootCause: 'Data Misattribution or Cross-Sell without flag.',
                            solution: 'Verify attribution in marketing_logs and update customer profile.',
                            conversationId: customerId,
                            errorId: ruleId
                        });
                    }
                }
            } else {
                console.log('[Auditor] ✅ No anomalies found.');
            }
            resolve(output);
        });
    });
}
