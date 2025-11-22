/**
 * OpenAI Realtime WebRTC Client
 * 
 * Manages WebRTC connection to OpenAI Realtime API for bidirectional audio streaming.
 * Handles session creation, peer connection lifecycle, and audio track management.
 */

export interface RealtimeConfig {
  model?: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  instructions?: string;
  temperature?: number;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  onAudioTrack?: (track: MediaStreamTrack) => void;
  onTranscript?: (text: string, role: 'user' | 'assistant') => void;
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
}

export interface RealtimeSession {
  token: string;
  expiresAt: number;
  model: string;
  voice: string;
}

export class RealtimeWebRTC {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private config: RealtimeConfig;
  private isConnected = false;

  constructor(config: RealtimeConfig = {}) {
    this.config = config;
  }

  /**
   * Connect to OpenAI Realtime API
   */
  async connect(): Promise<void> {
    try {
      console.log('RealtimeWebRTC: Starting connection...');

      // Step 1: Get ephemeral session token from our backend
      const session = await this.createSession();
      console.log('RealtimeWebRTC: Session created, expires at', new Date(session.expiresAt * 1000).toISOString());

      // Step 2: Create WebRTC peer connection
      this.peerConnection = new RTCPeerConnection();

      // Step 3: Set up audio element for remote audio playback
      this.audioElement = document.createElement('audio');
      this.audioElement.autoplay = true;
      this.audioElement.setAttribute('playsinline', 'true');
      this.audioElement.muted = false;
      this.audioElement.style.display = 'none';
      document.body.appendChild(this.audioElement);

      // Handle incoming audio tracks from OpenAI
      this.peerConnection.ontrack = (event) => {
        console.log('RealtimeWebRTC: Received remote audio track');
        if (this.audioElement) {
          this.audioElement.srcObject = event.streams[0];
          const playPromise = this.audioElement.play();
          if (playPromise) {
            playPromise.catch(err => {
              console.warn('RealtimeWebRTC: Unable to autoplay remote audio', err);
            });
          }
        }
        this.config.onAudioTrack?.(event.track);
        this.config.onRemoteStream?.(event.streams[0]);
      };

      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        console.log('RealtimeWebRTC: Connection state changed to', state);

        if (state === 'connected') {
          this.isConnected = true;
          this.config.onConnected?.();
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          this.isConnected = false;
          this.config.onDisconnected?.();
        }
      };

      // Step 4: Add local microphone track
      const micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000
        } 
      });

      micStream.getTracks().forEach(track => {
        this.peerConnection?.addTrack(track, micStream);
        console.log('RealtimeWebRTC: Added microphone track to peer connection');
      });
      // Expose local mic stream for UI analytics/visualization
      this.config.onLocalStream?.(micStream);

      // Step 5: Create data channel for control messages
      this.dataChannel = this.peerConnection.createDataChannel('oai-events');
      this.dataChannel.onmessage = this.handleDataChannelMessage.bind(this);
      this.dataChannel.onopen = () => {
        console.log('RealtimeWebRTC: Data channel opened');
        
        // Send session configuration with instructions
        if (this.config.instructions) {
          this.sendMessage({
            type: 'session.update',
            session: {
              instructions: this.config.instructions,
              voice: this.config.voice || 'alloy',
              input_audio_transcription: {
                model: 'whisper-1'
              }
            }
          });
        }
        
        // Trigger AI to start the conversation with the personalized greeting from system prompt
        this.sendMessage({
          type: 'response.create'
        });
      };

      // Step 6: Create and set local SDP offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      console.log('RealtimeWebRTC: Created local SDP offer');

      // Step 7: Send offer to OpenAI and get answer
      const baseUrl = 'https://api.openai.com/v1/realtime';
      const model = this.config.model || 'gpt-4o-realtime-preview-2024-12-17';

      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.token}`,
          'Content-Type': 'application/sdp'
        },
        body: offer.sdp
      });

      if (!sdpResponse.ok) {
        throw new Error(`Failed to exchange SDP: ${sdpResponse.status} ${sdpResponse.statusText}`);
      }

      const answerSdp = await sdpResponse.text();
      console.log('RealtimeWebRTC: Received remote SDP answer');

      // Step 8: Set remote description
      await this.peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp
      });

      console.log('RealtimeWebRTC: Connection established successfully');

    } catch (error) {
      console.error('RealtimeWebRTC: Connection failed:', error);
      this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Disconnect from OpenAI Realtime API
   */
  disconnect(): void {
    console.log('RealtimeWebRTC: Disconnecting...');

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.audioElement) {
      this.audioElement.srcObject = null;
      if (this.audioElement.isConnected) {
        this.audioElement.remove();
      }
      this.audioElement = null;
    }

    this.isConnected = false;
    this.config.onDisconnected?.();
    console.log('RealtimeWebRTC: Disconnected');
  }

  /**
   * Send a message via data channel
   */
  sendMessage(message: any): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.warn('RealtimeWebRTC: Data channel not open, cannot send message');
      return;
    }

    try {
      this.dataChannel.send(JSON.stringify(message));
      console.log('RealtimeWebRTC: Sent message:', message.type);
    } catch (error) {
      console.error('RealtimeWebRTC: Failed to send message:', error);
    }
  }

  /**
   * Handle incoming data channel messages
   */
  private handleDataChannelMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      console.log('RealtimeWebRTC: Received message:', message.type);

      // Handle transcript events
      if (message.type === 'conversation.item.input_audio_transcription.completed') {
        this.config.onTranscript?.(message.transcript, 'user');
      } else if (message.type === 'response.audio_transcript.delta') {
        this.config.onTranscript?.(message.delta, 'assistant');
      }

      // Additional event handling can be added here
    } catch (error) {
      console.error('RealtimeWebRTC: Failed to parse data channel message:', error);
    }
  }

  /**
   * Create ephemeral session token via backend endpoint
   */
  private async createSession(): Promise<RealtimeSession> {
    const response = await fetch('/api/realtime-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        voice: this.config.voice,
        instructions: this.config.instructions,
        temperature: this.config.temperature
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to create session');
    }

    const data = await response.json();
    return data.session;
  }

  /**
   * Check if currently connected
   */
  getConnectionState(): boolean {
    return this.isConnected;
  }

  /**
   * Get peer connection stats
   */
  async getStats(): Promise<RTCStatsReport | null> {
    if (!this.peerConnection) return null;
    return await this.peerConnection.getStats();
  }
}
