import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MAPPING_FILE = path.join(process.cwd(), '../marketing/config/ad_mapping.json');

// Helper to read JSON files safely
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

export async function GET() {
    try {
        const mapping = readJsonFile(MAPPING_FILE) || { campaign_mappings: [], ad_mappings: [] };
        return NextResponse.json(mapping);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch mapping' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { type, data } = body; // type: 'campaign' or 'ad'

        let mapping = readJsonFile(MAPPING_FILE) || { campaign_mappings: [], ad_mappings: [] };

        if (type === 'campaign') {
            // Update or Add
            const index = mapping.campaign_mappings.findIndex(m => m.campaign_name === data.campaign_name);
            if (index >= 0) {
                mapping.campaign_mappings[index] = { ...mapping.campaign_mappings[index], ...data };
            } else {
                mapping.campaign_mappings.push(data);
            }
        } else if (type === 'ad') {
            const index = mapping.ad_mappings.findIndex(m => m.ad_name === data.ad_name);
            if (index >= 0) {
                mapping.ad_mappings[index] = { ...mapping.ad_mappings[index], ...data };
            } else {
                mapping.ad_mappings.push(data);
            }
        }

        const configDir = path.dirname(MAPPING_FILE);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));

        return NextResponse.json({ success: true, mapping });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update mapping' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const name = searchParams.get('name');

        let mapping = readJsonFile(MAPPING_FILE);
        if (!mapping) return NextResponse.json({ success: true });

        if (type === 'campaign') {
            mapping.campaign_mappings = mapping.campaign_mappings.filter(m => m.campaign_name !== name);
        } else if (type === 'ad') {
            mapping.ad_mappings = mapping.ad_mappings.filter(m => m.ad_name !== name);
        }

        fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));
        return NextResponse.json({ success: true, mapping });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete mapping' }, { status: 500 });
    }
}
