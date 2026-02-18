import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '../customer');

export async function GET(request, { params }) {
    try {
        const { id } = params;
        const filePath = path.join(DATA_DIR, id, `profile_${id}.json`);

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        const data = fs.readFileSync(filePath, 'utf8');
        return NextResponse.json(JSON.parse(data));
    } catch (error) {
        console.error(`GET /api/customers/${params?.id} error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request, { params }) {
    try {
        const { id } = params;
        const customer = await request.json();
        const filePath = path.join(DATA_DIR, id, `profile_${id}.json`);

        if (!fs.existsSync(path.join(DATA_DIR, id))) {
            fs.mkdirSync(path.join(DATA_DIR, id), { recursive: true });
        }

        fs.writeFileSync(filePath, JSON.stringify(customer, null, 4));
        return NextResponse.json({ success: true, customer });
    } catch (error) {
        console.error(`PUT /api/customers/${params?.id} error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
