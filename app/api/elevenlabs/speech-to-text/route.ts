import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'ELEVENLABS_API_KEY is not configured',
        fallback: true
      }, { status: 500 });
    }

    const elevenlabs = new ElevenLabsClient({ apiKey });
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    // Convert File to buffer for ElevenLabs
    const audioBuffer = await audioFile.arrayBuffer();
    
    // Transcribe using ElevenLabs Speech-to-Text
    const transcription = await elevenlabs.speechToText.convert({
      file: audioBuffer,
      modelId: "scribe_v1",
      languageCode: "eng",
      tagAudioEvents: false,
      diarize: false
    });

    // Extract text from the response (handle both single and multichannel responses)
    let text = '';
    if ('transcripts' in transcription && transcription.transcripts) {
      // Multichannel response
      text = transcription.transcripts[0]?.text || '';
    } else if ('text' in transcription) {
      // Single channel response
      text = transcription.text;
    }

    return NextResponse.json({ 
      text,
      success: true 
    });
  } catch (error: any) {
    console.error('ElevenLabs Speech-to-text error:', error);
    
    // Check if it's a quota error
    if (error.code === 'insufficient_quota' || error.status === 429) {
      return NextResponse.json({ 
        error: 'ElevenLabs quota exceeded. Please add credits to your ElevenLabs account.',
        details: error.message,
        fallback: true
      }, { status: 429 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to transcribe audio',
      details: error.message 
    }, { status: 500 });
  }
}
