import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const EMPLOYEE_DIR = path.join(process.cwd(), '../employee');

export async function POST(request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
        }

        if (!fs.existsSync(EMPLOYEE_DIR)) {
            return NextResponse.json({ error: 'Employee directory not found' }, { status: 500 });
        }

        const folders = fs.readdirSync(EMPLOYEE_DIR).filter(f =>
            fs.statSync(path.join(EMPLOYEE_DIR, f)).isDirectory()
        );

        let authenticatedUser = null;

        for (const folder of folders) {
            const files = fs.readdirSync(path.join(EMPLOYEE_DIR, folder)).filter(f => f.endsWith('.json'));
            if (files.length > 0) {
                const filePath = path.join(EMPLOYEE_DIR, folder, files[0]);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                if (data.contact_info?.email === email && data.credentials?.password === password) {
                    const { credentials, ...safeData } = data;
                    authenticatedUser = { id: folder, ...safeData };
                    break;
                }
            }
        }

        if (authenticatedUser) {
            return NextResponse.json({ success: true, user: authenticatedUser });
        } else {
            return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
        }
    } catch (error) {
        console.error('POST /api/auth/login error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
