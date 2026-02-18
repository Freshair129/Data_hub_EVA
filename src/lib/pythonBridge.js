
import { spawn } from 'child_process';
import path from 'path';

/**
 * Execute a Python script with JSON input.
 * @param {string} scriptName - Name of the script in src/workers/python/
 * @param {Object} inputData - JSON object to pass to the script
 * @returns {Promise<Object>} - Parsed JSON output from the script
 */
export function runPython(scriptName, inputData) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(process.cwd(), 'src', 'workers', 'python', scriptName);

        // Spawn Python process
        // Note: Using 'python3' as default. In some envs it might be 'python'.
        const pyProcess = spawn('python3', [scriptPath], {
            env: { ...process.env, PYTHON_INPUT: JSON.stringify(inputData) }
        });

        let output = '';
        let errorOutput = '';

        pyProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pyProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.error(`[Python API] Error: ${data}`);
        });

        pyProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Python script exited with code ${code}: ${errorOutput}`));
                return;
            }

            try {
                // Try to find the last line that looks like JSON
                const lines = output.trim().split('\n');
                const lastLine = lines[lines.length - 1];
                const result = JSON.parse(lastLine);
                resolve(result);
            } catch (e) {
                // If not JSON, return raw text
                resolve({ success: true, raw: output, warning: 'Output was not JSON' });
            }
        });
    });
}
