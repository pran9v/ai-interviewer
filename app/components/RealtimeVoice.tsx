"use client";

import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { RealtimeWebRTC } from '@/app/utils/realtime-webrtc';
import { motion } from 'motion/react';

interface RealtimeVoiceProps {
  onTranscript?: (text: string, role: 'user' | 'assistant') => void;
  instructions?: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  autoConnect?: boolean;
}

export interface RealtimeVoiceHandle {
  disconnect: () => void;
}

export const RealtimeVoice = forwardRef<RealtimeVoiceHandle, RealtimeVoiceProps>(({ 
  onTranscript, 
  instructions,
  voice = 'alloy',
  autoConnect = false 
}, ref) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Array<{ text: string; role: 'user' | 'assistant' }>>([]);
  
  const clientRef = useRef<RealtimeWebRTC | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

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
        }
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
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  // Expose disconnect method to parent via ref
  useImperativeHandle(ref, () => ({
    disconnect: handleDisconnect
  }));

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          OpenAI Realtime Voice
        </h2>
        <p className="text-sm text-gray-600">
          WebRTC-powered bidirectional audio streaming
        </p>
      </div>

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

      {/* Info */}
      <div className="mt-6 pt-4 border-t">
        <p className="text-xs text-gray-500 text-center">
          Voice: {voice} • Model: gpt-4o-realtime-preview-2024-12-17
        </p>
      </div>
    </div>
  );
});

RealtimeVoice.displayName = 'RealtimeVoice';
