import { NextResponse } from 'next/server';
import path from 'path';
import { runPython } from '@/lib/pythonBridge';

/**
 * GET /api/export?format=excel
 * GET /api/export?format=json
 * 
 * Export CRM data to Excel (with formulas) or JSON.
 */
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'excel';

    try {
        if (format === 'excel') {
            // Use Python worker for Excel export with formulas
            const outputPath = path.join(process.cwd(), '..', `crm_export_${new Date().toISOString().split('T')[0]}.xlsx`);

            const result = await runPython('data_service.py', {
                command: 'export-excel',
                output_path: outputPath
            });

            if (result.success) {
                return NextResponse.json({
                    success: true,
                    message: 'Excel exported successfully',
                    filePath: outputPath,
                    format: 'xlsx',
                    sheets: ['Customers', 'Orders', 'AI Intelligence'],
                    features: ['SUM formulas', 'AVERAGE formulas', 'COUNTIF formulas', 'Rich formatting']
                });
            }

            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }

        if (format === 'json') {
            // Direct JSON export from filesystem
            const { getAllCustomers } = await import('@/lib/db');
            const customers = await getAllCustomers();

            return NextResponse.json({
                success: true,
                count: customers.length,
                data: customers,
                exported_at: new Date().toISOString()
            });
        }

        return NextResponse.json({ error: 'Unsupported format. Use: excel, json' }, { status: 400 });

    } catch (error) {
        console.error('[Export API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/export
 * Import data from Excel or Google Sheets
 * 
 * Body: { source: 'excel', filePath: '...' }
 * Body: { source: 'gsheets', spreadsheetId: '...', sheetName: '...' }
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { source } = body;

        if (source === 'excel') {
            const result = await runPython('data_service.py', {
                command: 'import-excel',
                file_path: body.filePath
            });
            return NextResponse.json(result);
        }

        if (source === 'gsheets') {
            const result = await runPython('data_service.py', {
                command: 'import-gsheets',
                spreadsheet_id: body.spreadsheetId,
                sheet_name: body.sheetName || null
            });
            return NextResponse.json(result);
        }

        return NextResponse.json({ error: 'Unsupported source. Use: excel, gsheets' }, { status: 400 });

    } catch (error) {
        console.error('[Import API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
