
import { runPython } from './pythonBridge';

/**
 * Slip Service
 * Handles bank slip verification logic via Python AI Bridge.
 */

export async function verifySlip(imageUrl, senderId) {
    console.log(`[SlipService] Verifying slip via AI Bridge: ${imageUrl}`);

    try {
        // Prepare mock event to trigger full Python logic
        const mockEvent = {
            sender: { id: senderId || 'unknown' },
            attachments: [{
                type: 'image',
                payload: { url: imageUrl }
            }]
        };

        const result = await runPython('event_processor.py', mockEvent);

        if (result.success && result.intelligence?.slip) {
            const slip = result.intelligence.slip;
            return {
                verified: slip.status === 'VERIFIED',
                data: {
                    amount: slip.amount,
                    date: slip.date,
                    time: slip.time,
                    bank: slip.bank_name,
                    transaction_id: slip.ref_id,
                    sender: 'Customer'
                }
            };
        }

        return { verified: false, error: result.error || 'AI Analysis Failed' };

    } catch (error) {
        console.error('[SlipService] Bridge Error:', error);
        return { verified: false, error: 'AI Bridge Communication Error' };
    }
}
