import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    // Convert File to buffer
    const audioBuffer = await audioFile.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: audioFile.type });
    
    // Create a File object for OpenAI Whisper
    const file = new File([audioBlob], audioFile.name, { type: audioFile.type });
    
    // Transcribe using OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "en",
    });

    return NextResponse.json({ 
      text: transcription.text,
      success: true 
    });
  } catch (error: any) {
    console.error('Speech-to-text error:', error);
    
    // Check if it's a quota error
    if (error.code === 'insufficient_quota' || error.status === 429) {
      return NextResponse.json({ 
        error: 'OpenAI quota exceeded. Please add credits to your OpenAI account or use a different speech-to-text service.',
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
