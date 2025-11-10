# OpenAI Realtime WebRTC Integration

Complete, production-ready implementation of OpenAI's Realtime API for bidirectional voice streaming using WebRTC.

## Overview

This integration enables real-time voice conversations with GPT-4o through a direct browser-to-OpenAI WebRTC connection. Unlike traditional speech-to-text → LLM → text-to-speech pipelines, the Realtime API provides:

- **Ultra-low latency** (~200-500ms response time)
- **Natural interruptions** (users can interrupt the AI mid-sentence)
- **Streaming audio** (no waiting for complete responses)
- **Built-in VAD** (Voice Activity Detection on server-side)
- **No audio storage** (ephemeral connections with 60s token TTL)

## Architecture

```
┌─────────────┐
│   Browser   │
│  (Client)   │
└──────┬──────┘
       │
       │ 1. Request Session Token
       ├──────────────────────────────────┐
       │                                  │
       v                                  v
┌─────────────────┐              ┌────────────────┐
│   Next.js API   │              │   OpenAI API   │
│ /api/realtime-  │──────────────│   /sessions    │
│    session      │ 2. Create    │                │
│                 │    Ephemeral │                │
│                 │    Token     │                │
└─────────────────┘              └────────────────┘
       │
       │ 3. Return Token
       │    (60s TTL)
       v
┌─────────────┐
│   Browser   │
│  WebRTC     │────────────────────────────────┐
│  Client     │ 4. Establish WebRTC Connection │
└─────────────┘                                v
       │                              ┌─────────────────┐
       │                              │  OpenAI Server  │
       │◄─────────────────────────────┤  WebRTC Peer    │
       │  5. Bidirectional Audio      │                 │
       │     Text + Audio Streams     │  GPT-4o Model   │
       │                              └─────────────────┘
       │
       └──► Conversation continues until disconnect
```

## Files Structure

```
app/
├── api/
│   └── realtime-session/
│       └── route.ts              # Backend: Session token endpoint
├── utils/
│   └── realtime-webrtc.ts        # Core: WebRTC client library
├── components/
│   └── RealtimeVoice.tsx         # UI: React component
└── (routes)/
    └── realtime-demo/
        └── page.tsx              # Demo: Full-featured demo page
```

## Setup

### 1. Environment Variables

Add to `.env.local`:

```bash
# OpenAI Realtime API Key
# Get from: https://platform.openai.com/api-keys
# Note: Requires access to Realtime API (currently in beta)
OPENAI_REALTIME_API_KEY=sk-proj-...
```

### 2. Install Dependencies

All dependencies are already included in the project:
- `next` (App Router)
- `react`
- `motion` (Framer Motion for animations)
- TypeScript
- Tailwind CSS

### 3. Verify Setup

1. Start the development server:
```bash
npm run dev
```

2. Visit the demo page:
```
http://localhost:3000/realtime-demo
```

3. Click "Connect" and allow microphone access

4. Start speaking naturally with the AI

## Usage

### Basic Example

```tsx
import { RealtimeVoice } from '@/app/components/RealtimeVoice';

export default function MyPage() {
  return (
    <RealtimeVoice
      voice="alloy"
      instructions="You are a helpful assistant."
      onTranscript={(text, role) => {
        console.log(`${role}: ${text}`);
      }}
    />
  );
}
```

### Advanced Example

```tsx
import { RealtimeWebRTC } from '@/app/utils/realtime-webrtc';

const client = new RealtimeWebRTC({
  model: 'gpt-4o-realtime-preview-2024-12-17',
  voice: 'nova',
  instructions: 'You are a technical interviewer.',
  temperature: 0.7,
  
  onConnected: () => {
    console.log('Connected to OpenAI');
  },
  
  onDisconnected: () => {
    console.log('Disconnected');
  },
  
  onError: (error) => {
    console.error('Error:', error);
  },
  
  onTranscript: (text, role) => {
    if (role === 'user') {
      console.log('User said:', text);
    } else {
      console.log('AI replied:', text);
    }
  },
  
  onAudioTrack: (track) => {
    // Handle remote audio track
    const audio = new Audio();
    audio.srcObject = new MediaStream([track]);
    audio.play();
  }
});

// Connect
await client.connect();

// Send custom message via data channel
client.sendMessage({
  type: 'response.create',
  response: {
    modalities: ['text', 'audio'],
    instructions: 'Introduce yourself briefly.'
  }
});

// Disconnect
client.disconnect();
```

## API Reference

### Server Endpoint

**POST /api/realtime-session**

Creates ephemeral session token for WebRTC connection.

**Request Body:**
```typescript
{
  model?: string;                    // Default: 'gpt-4o-realtime-preview-2024-12-17'
  voice?: string;                    // Default: 'alloy'
  instructions?: string;             // System prompt
  temperature?: number;              // Default: 0.8
  max_response_output_tokens?: number; // Default: 4096
}
```

**Response:**
```typescript
{
  success: boolean;
  session: {
    token: string;        // Ephemeral token (60s TTL)
    expiresAt: number;    // Unix timestamp
    model: string;
    voice: string;
  }
}
```

**Error Responses:**
- `401`: Invalid API key
- `429`: Rate limit exceeded
- `500`: Server error

### Client Class: `RealtimeWebRTC`

**Constructor:**
```typescript
new RealtimeWebRTC(config: RealtimeConfig)

interface RealtimeConfig {
  model?: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  instructions?: string;
  temperature?: number;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  onAudioTrack?: (track: MediaStreamTrack) => void;
  onTranscript?: (text: string, role: 'user' | 'assistant') => void;
}
```

**Methods:**

- `async connect(): Promise<void>` - Establish WebRTC connection
- `disconnect(): void` - Close connection and cleanup
- `sendMessage(message: any): void` - Send control message via data channel
- `getConnectionState(): boolean` - Check if connected
- `async getStats(): Promise<RTCStatsReport | null>` - Get WebRTC stats

### React Component: `RealtimeVoice`

**Props:**
```typescript
interface RealtimeVoiceProps {
  onTranscript?: (text: string, role: 'user' | 'assistant') => void;
  instructions?: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  autoConnect?: boolean;
}
```

**Features:**
- Connect/disconnect controls
- Mute/unmute microphone
- Real-time transcript display
- Connection status indicator
- Error handling and display

## Voice Options

| Voice    | Description            | Best For                |
|----------|------------------------|-------------------------|
| `alloy`  | Neutral and balanced   | General conversations   |
| `echo`   | Warm and approachable  | Customer support        |
| `fable`  | Expressive and dynamic | Storytelling, creative  |
| `onyx`   | Deep and authoritative | Professional, formal    |
| `nova`   | Bright and energetic   | Enthusiastic, upbeat    |
| `shimmer`| Gentle and calm        | Meditation, soothing    |

## Configuration

### Audio Settings

The integration uses optimal audio settings for voice:

```typescript
{
  echoCancellation: true,    // Remove echo
  noiseSuppression: true,    // Filter background noise
  autoGainControl: true,     // Normalize volume
  sampleRate: 24000          // 24kHz for clarity
}
```

### VAD (Voice Activity Detection)

Server-side VAD configuration:

```typescript
{
  type: 'server_vad',
  threshold: 0.5,              // Sensitivity (0.0-1.0)
  prefix_padding_ms: 300,      // Capture before speech
  silence_duration_ms: 500     // Silence to end turn
}
```

### Model Parameters

```typescript
{
  model: 'gpt-4o-realtime-preview-2024-12-17',
  temperature: 0.8,                    // Creativity (0.0-1.0)
  max_response_output_tokens: 4096,   // Max response length
  modalities: ['text', 'audio']       // Output types
}
```

## Integration with Existing Interview System

To use Realtime in your existing interview flow:

```tsx
// In your interview start page
import { RealtimeVoice } from '@/app/components/RealtimeVoice';

function StartInterview() {
  const [useRealtime, setUseRealtime] = useState(false);

  if (useRealtime) {
    return (
      <RealtimeVoice
        voice="alloy"
        instructions={`
          You are conducting a job interview for ${interviewData.jobTitle}.
          Ask these questions one at a time:
          ${interviewData.interviewQuestions.map(q => q.question).join('\n')}
        `}
        onTranscript={(text, role) => {
          // Save to conversation manager
          if (role === 'user') {
            conversationManager?.addUserResponse(text);
          } else {
            conversationManager?.addAIResponse(text);
          }
        }}
      />
    );
  }

  // ... existing ElevenLabs flow
}
```

## Performance

### Metrics

- **Connection Setup**: ~1-2 seconds
- **Audio Latency**: ~200-500ms (vs 2-5s for traditional pipelines)
- **Bandwidth**: ~40-60 kbps (Opus codec, 24kHz mono)
- **Token TTL**: 60 seconds (requires reconnection after expiry)

### Optimization Tips

1. **Preload Connection**: Call `connect()` early in component lifecycle
2. **Reuse Instances**: Keep `RealtimeWebRTC` instance alive across renders
3. **Monitor Stats**: Use `getStats()` to track quality metrics
4. **Handle Reconnects**: Implement exponential backoff for retries

## Security

### Best Practices

1. ✅ **API Key Protection**: Never expose `OPENAI_REALTIME_API_KEY` to client
2. ✅ **Ephemeral Tokens**: 60s TTL limits exposure window
3. ✅ **No Storage**: Audio is not stored by OpenAI
4. ✅ **HTTPS Required**: All connections use TLS
5. ✅ **Rate Limiting**: Implement server-side rate limits on `/api/realtime-session`

### Recommended Rate Limits

```typescript
// In /api/realtime-session/route.ts
import { ratelimit } from '@/lib/redis'; // Example with Upstash

const limiter = ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 tokens per minute
});

export async function POST(req: NextRequest) {
  const { success } = await limiter.limit(
    req.headers.get('x-forwarded-for') ?? 'anonymous'
  );
  
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }
  
  // ... rest of handler
}
```

## Troubleshooting

### Common Issues

**Issue**: "Failed to create session"
- **Cause**: Invalid or missing `OPENAI_REALTIME_API_KEY`
- **Fix**: Verify API key in `.env.local` and restart server

**Issue**: "Microphone permission denied"
- **Cause**: User blocked microphone access
- **Fix**: Check browser permissions, use HTTPS in production

**Issue**: "Connection failed after SDP exchange"
- **Cause**: Firewall blocking WebRTC ports
- **Fix**: Check STUN/TURN server configuration, ensure UDP/TCP ports open

**Issue**: "Session expired" after 60 seconds
- **Cause**: Ephemeral token TTL reached
- **Fix**: Implement auto-reconnect logic with new token

**Issue**: Poor audio quality
- **Cause**: Network congestion or low bandwidth
- **Fix**: Check network stats via `getStats()`, reduce sample rate if needed

### Debug Mode

Enable verbose logging:

```typescript
const client = new RealtimeWebRTC({
  // ... config
  onError: (error) => {
    console.error('[Realtime Error]', error);
  }
});

// Check WebRTC stats
setInterval(async () => {
  const stats = await client.getStats();
  if (stats) {
    stats.forEach(report => {
      if (report.type === 'inbound-rtp' && report.kind === 'audio') {
        console.log('Audio stats:', {
          packetsLost: report.packetsLost,
          jitter: report.jitter,
          bytesReceived: report.bytesReceived
        });
      }
    });
  }
}, 5000);
```

## Cost Estimation

OpenAI Realtime API pricing (as of Dec 2024):

- **Audio Input**: $0.10 per minute
- **Audio Output**: $0.20 per minute
- **Text Input**: $5.00 per 1M tokens
- **Text Output**: $20.00 per 1M tokens

**Example**: 10-minute interview
- Cost: ~$3.00 (mostly audio time)
- vs Traditional: ~$0.50 (STT + LLM + TTS)
- **Tradeoff**: Higher cost for significantly better UX

## Resources

- [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime)
- [WebRTC API Reference](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Demo Page](/realtime-demo)

## Support

For issues or questions:
1. Check this documentation
2. Review OpenAI API status: https://status.openai.com
3. Enable debug logging and check browser console
4. Test with `/realtime-demo` page to isolate issues
