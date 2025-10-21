import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: NextRequest) {
    try {
        const { enabled } = await req.json();

        // Toggle microphone state with your voice service
        // This is a placeholder - replace with your chosen voice service integration
        await axios.post('YOUR_VOICE_SERVICE_ENDPOINT/mic', {
            enabled: enabled
        });

        return NextResponse.json({
            success: true,
            microphone_enabled: enabled
        });
    } catch (error: any) {
        console.error('Error toggling microphone:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { 
            status: 500 
        });
    }
}
