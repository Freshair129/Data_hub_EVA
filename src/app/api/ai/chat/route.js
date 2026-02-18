import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import BusinessAnalyst from '@/utils/BusinessAnalyst';

// Reuse helper to read JSON files safely
const readJsonFile = (filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        }
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e);
    }
    return null;
};

// Reuse helper to read directory
const readDirectoryFiles = (dirPath) => {
    try {
        if (fs.existsSync(dirPath)) {
            return fs.readdirSync(dirPath)
                .filter(file => file.endsWith('.json'))
                .map(file => readJsonFile(path.join(dirPath, file)))
                .filter(Boolean);
        }
    } catch (e) {
        console.error(`Error reading directory ${dirPath}:`, e);
    }
    return [];
};

export async function POST(req) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const body = await req.json();
        const { question, history } = body;

        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'Gemini API Key missing' }, { status: 500 });
        }

        // 1. Gather Context
        const customerDir = path.join(process.cwd(), '../customer');
        const customers = fs.existsSync(customerDir) ? readDirectoryFiles(customerDir) : [];

        const marketingDir = path.join(process.cwd(), '../marketing/logs/daily');
        const campaigns = readDirectoryFiles(marketingDir);

        const productsDir = path.join(process.cwd(), '../products');
        const courses = readDirectoryFiles(path.join(productsDir, 'courses'));
        const packages = readDirectoryFiles(path.join(productsDir, 'packages'));
        const allProducts = [...courses, ...packages];

        // 2. Init AI
        const analyst = new BusinessAnalyst(apiKey);

        // 3. Prepare Context
        const context = analyst.prepareContext(customers, campaigns, null, allProducts);

        // 4. Generate Response
        // Format history for Gemini SDK
        const formattedHistory = (history || []).map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        const answer = await analyst.chat(formattedHistory, question, context);

        return NextResponse.json({ success: true, answer });

    } catch (error) {
        console.error('AI Chat Failed:', error);
        return NextResponse.json({ success: false, error: 'Chat failed' }, { status: 500 });
    }
}
