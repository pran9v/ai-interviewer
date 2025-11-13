"use client";

import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff } from 'lucide-react';
import { RealtimeWebRTC } from '@/app/utils/realtime-webrtc';
import { motion } from 'motion/react';

interface RealtimeVoiceProps {
  onTranscript?: (text: string, role: 'user' | 'assistant') => void;
  instructions?: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  autoConnect?: boolean;
  hideBranding?: boolean;
  showSpeakingIndicators?: boolean;
  userName?: string;
}

export interface RealtimeVoiceHandle {
  disconnect: () => void;
}

export const RealtimeVoice = forwardRef<RealtimeVoiceHandle, RealtimeVoiceProps>(({ 
  onTranscript, 
  instructions,
  voice = 'alloy',
  autoConnect = false,
  hideBranding = false,
  showSpeakingIndicators = false,
  userName,
}, ref) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Array<{ text: string; role: 'user' | 'assistant' }>>([]);
  
  const clientRef = useRef<RealtimeWebRTC | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // Audio analysis for speaking indicators
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
  // Use Float32Array for analyser time-domain data (broad TS compatibility)
  const micDataRef = useRef<Float32Array | null>(null);
  const remoteDataRef = useRef<Float32Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const [userLevel, setUserLevel] = useState(0);
  const [assistantLevel, setAssistantLevel] = useState(0);

  useEffect(() => {
    if (autoConnect) {
      handleConnect();
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // Create WebRTC client
      clientRef.current = new RealtimeWebRTC({
        voice,
        instructions,
        onConnected: () => {
          console.log('RealtimeVoice: Connected to OpenAI Realtime');
          setIsConnected(true);
          setIsConnecting(false);
        },
        onDisconnected: () => {
          console.log('RealtimeVoice: Disconnected from OpenAI Realtime');
          setIsConnected(false);
          setIsConnecting(false);
        },
        onError: (err) => {
          console.error('RealtimeVoice: Error:', err);
          setError(err.message);
          setIsConnecting(false);
          setIsConnected(false);
        },
        onTranscript: (text, role) => {
          console.log(`RealtimeVoice: Transcript [${role}]:`, text);
          setTranscripts(prev => [...prev, { text, role }]);
          onTranscript?.(text, role);
        },
        onLocalStream: (stream) => {
          localStreamRef.current = stream;
          if (showSpeakingIndicators) setupMicAnalyser(stream);
        },
        onRemoteStream: (stream) => {
          remoteStreamRef.current = stream;
          if (showSpeakingIndicators) setupRemoteAnalyser(stream);
        },
      });

      await clientRef.current.connect();

    } catch (err) {
      console.error('RealtimeVoice: Failed to connect:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setIsConnected(false);
    setTranscripts([]);
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  // Setup analysers
  const ensureAudioContext = () => {
    if (!audioCtxRef.current) {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    return audioCtxRef.current!;
  };

  const setupMicAnalyser = (stream: MediaStream) => {
    const ctx = ensureAudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
  micAnalyserRef.current = analyser;
  micDataRef.current = new Float32Array(analyser.fftSize);
    startRaf();
  };

  const setupRemoteAnalyser = (stream: MediaStream) => {
    const ctx = ensureAudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
  remoteAnalyserRef.current = analyser;
  remoteDataRef.current = new Float32Array(analyser.fftSize);
    startRaf();
  };

  const startRaf = () => {
    if (rafRef.current) return;
    const tick = () => {
      if (micAnalyserRef.current && micDataRef.current) {
        const micArray = micDataRef.current;
        if (micArray) {
          // Cast to any to satisfy lib.dom type differences across TS versions
          micAnalyserRef.current.getFloatTimeDomainData(micArray as any);
          const lvl = computeLevel(micArray);
          setUserLevel(prev => lvl * 0.8 + prev * 0.2);
        }
      }
      if (remoteAnalyserRef.current && remoteDataRef.current) {
        const rArray = remoteDataRef.current;
        if (rArray) {
          // Cast to any to satisfy lib.dom type differences across TS versions
          remoteAnalyserRef.current.getFloatTimeDomainData(rArray as any);
          const lvl = computeLevel(rArray);
          setAssistantLevel(prev => lvl * 0.8 + prev * 0.2);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const computeLevel = (data: ArrayLike<number>) => {
    // Compute RMS of time-domain signal in [-1, 1]
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i] as number;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    return Math.min(1, rms * 3); // scale
  };

  const BarViz = ({ level }: { level: number }) => {
    const bars = 5;
    const arr = Array.from({ length: bars });
    return (
      <div className="flex items-end gap-1 h-8">
        {arr.map((_, i) => {
          const bias = (i + 1) / bars;
          const h = Math.max(2, Math.min(32, level * 32 * (0.6 + 0.4 * bias)));
          return <div key={i} className="w-1.5 bg-gradient-to-t from-indigo-500 to-blue-400 rounded" style={{ height: `${h}px` }} />
        })}
      </div>
    );
  };

  // Expose disconnect method to parent via ref
  useImperativeHandle(ref, () => ({
    disconnect: handleDisconnect
  }));

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header (hidden if hideBranding) */}
      {!hideBranding && (
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">OpenAI Realtime Voice</h2>
          <p className="text-sm text-gray-600">WebRTC-powered bidirectional audio streaming</p>
        </div>
      )}

      {/* Connection Status */}
      <div className="flex items-center justify-center mb-6">
        <motion.div
          className={`w-3 h-3 rounded-full mr-2 ${
            isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500' : 'bg-gray-400'
          }`}
          animate={{
            scale: isConnected ? [1, 1.2, 1] : 1,
          }}
          transition={{
            duration: 2,
            repeat: isConnected ? Infinity : 0,
          }}
        />
        <span className="text-sm font-medium text-gray-700">
          {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
        </span>
      </div>

      {/* Speaking Indicators */}
      {showSpeakingIndicators && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-lg border bg-gradient-to-br from-indigo-50 to-white">
            <div className="text-xs font-medium text-indigo-700 mb-2">Interviewer</div>
            <BarViz level={assistantLevel} />
          </div>
          <div className="p-4 rounded-lg border bg-gradient-to-br from-blue-50 to-white">
            <div className="text-xs font-medium text-blue-700 mb-2">You</div>
            <BarViz level={userLevel} />
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mb-6">
        {!isConnected ? (
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Phone className="w-5 h-5 mr-2" />
            {isConnecting ? 'Connecting...' : 'Connect'}
          </Button>
        ) : (
          <Button
            onClick={handleDisconnect}
            size="lg"
            variant="destructive"
          >
            <PhoneOff className="w-5 h-5 mr-2" />
            Disconnect
          </Button>
        )}
      </div>

      {/* Transcripts - Hidden for minimal UI */}
      {/* {transcripts.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Conversation:</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {transcripts.map((item, index) => (
              <div
                key={index}
                className={`p-2 rounded-lg text-sm ${
                  item.role === 'user'
                    ? 'bg-blue-50 text-blue-900 ml-8'
                    : 'bg-gray-50 text-gray-900 mr-8'
                }`}
              >
                <span className="font-medium">
                  {item.role === 'user' ? 'You: ' : 'AI: '}
                </span>
                {item.text}
              </div>
            ))}
          </div>
        </div>
      )} */}

      {/* Footer branding (hidden if hideBranding) */}
      {!hideBranding && (
        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-gray-500 text-center">
            Voice: {voice} • Model: gpt-4o-realtime-preview-2024-12-17
          </p>
        </div>
      )}
    </div>
  );
});

RealtimeVoice.displayName = 'RealtimeVoice';
