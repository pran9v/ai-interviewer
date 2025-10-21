import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { text, voice_id = "21m00Tcm4TlvDq8ikWAM" } = await req.json();
    
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Use ElevenLabs Text-to-Speech convert API
    const audio = await elevenlabs.textToSpeech.convert(voice_id, {
      text,
      modelId: "eleven_monolingual_v1",
      outputFormat: "mp3_44100_128"
    });

    return new NextResponse(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('ElevenLabs TTS error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate speech',
      details: error.message 
    }, { status: 500 });
  }
}
