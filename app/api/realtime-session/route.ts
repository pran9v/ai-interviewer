import { NextRequest, NextResponse } from 'next/server';

/**
 * OpenAI Realtime API Session Endpoint
 * 
 * Creates an ephemeral session token for WebRTC connection to OpenAI Realtime API.
 * This token is short-lived (60 seconds) and used by the client to establish a direct
 * peer-to-peer WebRTC connection with OpenAI's voice servers.
 * 
 * Flow:
 * 1. Client requests session token from this endpoint
 * 2. Server validates request and creates ephemeral token via OpenAI API
 * 3. Client uses token to establish WebRTC connection
 * 4. Audio streams bidirectionally between browser and OpenAI
 * 
 * Environment Variables Required:
 * - OPENAI_REALTIME_API_KEY: Your OpenAI API key with Realtime access
 */

interface RealtimeSessionRequest {
  model?: string;
  voice?: string;
  instructions?: string;
  temperature?: number;
  max_response_output_tokens?: number;
}

interface RealtimeSessionResponse {
  client_secret: {
    value: string;
    expires_at: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    // Use existing OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error', details: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body: RealtimeSessionRequest = await req.json().catch(() => ({}));

    // Default configuration for interview sessions
    const sessionConfig = {
      model: body.model || 'gpt-4o-realtime-preview-2024-12-17',
      voice: body.voice || 'alloy',
      instructions: body.instructions || 
        'You are a professional job interviewer conducting a voice interview. ' +
        'Ask one question at a time, listen carefully to responses, and provide thoughtful follow-ups. ' +
        'Be conversational, encouraging, and professional.',
      temperature: body.temperature ?? 0.8,
      max_response_output_tokens: body.max_response_output_tokens ?? 4096,
      modalities: ['text', 'audio'],
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500
      }
    };

    console.log('Creating OpenAI Realtime session with config:', {
      model: sessionConfig.model,
      voice: sessionConfig.voice,
      temperature: sessionConfig.temperature
    });

    // Create ephemeral session token via OpenAI API
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sessionConfig)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Realtime session creation failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });

      // Handle specific error cases
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Authentication failed', details: 'Invalid OpenAI API key' },
          { status: 401 }
        );
      }

      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded', details: 'Too many requests. Please try again later.' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to create session', details: errorText },
        { status: response.status }
      );
    }

    const sessionData: RealtimeSessionResponse = await response.json();

    console.log('OpenAI Realtime session created successfully:', {
      expiresAt: new Date(sessionData.client_secret.expires_at * 1000).toISOString(),
      ttl: `${Math.round((sessionData.client_secret.expires_at * 1000 - Date.now()) / 1000)}s`
    });

    // Return session token to client
    return NextResponse.json({
      success: true,
      session: {
        token: sessionData.client_secret.value,
        expiresAt: sessionData.client_secret.expires_at,
        model: sessionConfig.model,
        voice: sessionConfig.voice
      }
    });

  } catch (error) {
    console.error('Error in OpenAI Realtime session endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint returns API information
 */
export async function GET() {
  return NextResponse.json({
    service: 'OpenAI Realtime API Session Manager',
    version: '1.0.0',
    endpoints: {
      POST: {
        description: 'Create ephemeral session token for WebRTC connection',
        parameters: {
          model: 'string (optional) - OpenAI model to use',
          voice: 'string (optional) - Voice ID (alloy, echo, fable, onyx, nova, shimmer)',
          instructions: 'string (optional) - System instructions for the AI',
          temperature: 'number (optional) - Response creativity (0.0-1.0)',
          max_response_output_tokens: 'number (optional) - Max tokens per response'
        },
        response: {
          session: {
            token: 'Ephemeral session token (60s TTL)',
            expiresAt: 'Unix timestamp',
            model: 'Model name',
            voice: 'Voice ID'
          }
        }
      }
    },
    documentation: 'https://platform.openai.com/docs/guides/realtime'
  });
}
