import { NextRequest, NextResponse } from "next/server";
import twilio from 'twilio';

export async function POST(req: NextRequest) {
    try {
        const data = await req.formData();
        const conferenceStatus = data.get('ConferenceStatus');
        const callSid = data.get('CallSid');

        // Handle different conference statuses
        switch (conferenceStatus) {
            case 'start':
                console.log(`Conference ${callSid} started`);
                break;
            case 'end':
                console.log(`Conference ${callSid} ended`);
                break;
            case 'join':
                console.log(`Participant joined conference ${callSid}`);
                break;
            case 'leave':
                console.log(`Participant left conference ${callSid}`);
                break;
        }

        // Return TwiML to acknowledge the status callback
        const twiml = new twilio.twiml.VoiceResponse();
        return new NextResponse(twiml.toString(), {
            headers: {
                'Content-Type': 'text/xml',
            },
        });
    } catch (error: any) {
        console.error('Status callback error:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { 
            status: 500 
        });
    }
}
