import { NextRequest, NextResponse } from "next/server";
import twilio from 'twilio';

// Initialize Twilio client
const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

export async function POST(req: NextRequest) {
    try {
        const { knowledge_id } = await req.json();

        // Create a new Twilio voice session
        const voiceSession = await client.tokens.create();

        // Create TwiML for the interview
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say('Welcome to your interview session. I will now ask you questions.');
        
        // Start a conference call that the interviewer and interviewee will join
        const conference = twiml.conference({
            statusCallback: '/api/voice-session/status',
            statusCallbackEvent: ['start', 'end', 'join', 'leave'],
            record: 'record-from-start',
            recordingStatusCallback: '/api/voice-session/recording',
        }, 'InterviewRoom');

        // Create a new voice call
        const call = await client.calls.create({
            twiml: twiml.toString(),
            to: 'client:interviewer', // Connect to the web client
            from: process.env.TWILIO_PHONE_NUMBER,
        });

        return NextResponse.json({
            success: true,
            session: {
                token: voiceSession.token,
                identity: 'interviewer',
                callSid: call.sid,
            }
        });
    } catch (error: any) {
        console.error('Voice session error:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { 
            status: 500 
        });
    }
}