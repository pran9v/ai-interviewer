import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: NextRequest) {
    try {
        const { knowledge_id } = await req.json();

        // End voice session with your voice service
        // This is a placeholder - replace with your chosen voice service integration
        await axios.post('YOUR_VOICE_SERVICE_ENDPOINT/end', {
            knowledge_base_id: knowledge_id
        });

        return NextResponse.json({
            success: true,
            message: 'Voice session ended successfully'
        });
    } catch (error: any) {
        console.error('Error ending voice session:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { 
            status: 500 
        });
    }
}
