import { NextResponse } from 'next/server';
import { getAllEmployees } from '@/lib/db';

export async function GET() {
    try {
        const employees = await getAllEmployees();

        // Security: Strip credentials before sending to client
        const safeEmployees = employees.map(emp => {
            const { credentials, passwordHash, ...safeData } = emp;
            return safeData;
        });

        return NextResponse.json(safeEmployees);
    } catch (error) {
        console.error('GET /api/employees error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
