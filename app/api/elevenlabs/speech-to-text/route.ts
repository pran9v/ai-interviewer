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

    console.log('Received audio file:', audioFile.name, 'size:', audioFile.size, 'type:', audioFile.type);

    // ElevenLabs expects a File object directly, not ArrayBuffer
    const transcription = await elevenlabs.speechToText.convert({
      file: audioFile as any, // Pass File directly
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
    console.error('Error status:', error.status);
    console.error('Error code:', error.code);
    console.error('Error body:', JSON.stringify(error.body, null, 2));
    
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
      details: `Status code: ${error.status}\nBody: ${JSON.stringify(error.body, null, 2)}`
    }, { status: 500 });
  }
}
