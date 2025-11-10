"use client";

import React, { useState } from 'react';
import { RealtimeVoice } from '@/app/components/RealtimeVoice';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Info } from 'lucide-react';
import Link from 'next/link';

export default function RealtimeDemo() {
  const [selectedVoice, setSelectedVoice] = useState<'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'>('alloy');
  const [conversationLog, setConversationLog] = useState<Array<{ text: string; role: 'user' | 'assistant'; timestamp: Date }>>([]);

  const voices = [
    { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
    { id: 'echo', name: 'Echo', description: 'Warm and approachable' },
    { id: 'fable', name: 'Fable', description: 'Expressive and dynamic' },
    { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
    { id: 'nova', name: 'Nova', description: 'Bright and energetic' },
    { id: 'shimmer', name: 'Shimmer', description: 'Gentle and calm' }
  ] as const;

  const handleTranscript = (text: string, role: 'user' | 'assistant') => {
    setConversationLog(prev => [...prev, { text, role, timestamp: new Date() }]);
  };

  const downloadConversation = () => {
    const conversation = conversationLog.map(entry => 
      `[${entry.timestamp.toLocaleTimeString()}] ${entry.role.toUpperCase()}: ${entry.text}`
    ).join('\n\n');

    const blob = new Blob([conversation], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `realtime-conversation-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            OpenAI Realtime Voice Demo
          </h1>
          <p className="text-lg text-gray-600">
            Experience WebRTC-powered bidirectional audio streaming with GPT-4o
          </p>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-blue-900 mb-1">How it works</h3>
              <p className="text-sm text-blue-800">
                This demo uses OpenAI's Realtime API to establish a direct WebRTC connection between your browser and OpenAI's servers. 
                Your voice is streamed in real-time, and the AI responds with both text and audio. No polling, no delays—just natural conversation.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Voice Selection */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Voice Selection</h2>
              <div className="space-y-2">
                {voices.map((voice) => (
                  <button
                    key={voice.id}
                    onClick={() => setSelectedVoice(voice.id as any)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      selectedVoice === voice.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">{voice.name}</div>
                    <div className="text-sm text-gray-600">{voice.description}</div>
                  </button>
                ))}
              </div>

              {/* Stats */}
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Session Stats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Messages:</span>
                    <span className="font-medium text-gray-900">{conversationLog.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">User:</span>
                    <span className="font-medium text-gray-900">
                      {conversationLog.filter(m => m.role === 'user').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Assistant:</span>
                    <span className="font-medium text-gray-900">
                      {conversationLog.filter(m => m.role === 'assistant').length}
                    </span>
                  </div>
                </div>

                {conversationLog.length > 0 && (
                  <Button
                    onClick={downloadConversation}
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                  >
                    Download Transcript
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Realtime Component */}
          <div className="lg:col-span-2">
            <RealtimeVoice
              voice={selectedVoice}
              onTranscript={handleTranscript}
              instructions={
                "You are a helpful and friendly AI assistant. " +
                "Have natural conversations with the user. " +
                "Be concise but informative. " +
                "If the user asks about technical topics, provide clear explanations."
              }
            />

            {/* Technical Details */}
            <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Technical Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Connection</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• Protocol: WebRTC</li>
                    <li>• Audio: Opus codec</li>
                    <li>• Sample Rate: 24kHz</li>
                    <li>• Latency: ~200-500ms</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Features</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• Server VAD (Voice Activity Detection)</li>
                    <li>• Echo cancellation</li>
                    <li>• Noise suppression</li>
                    <li>• Auto gain control</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Model</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• GPT-4o Realtime Preview</li>
                    <li>• Multimodal: Text + Audio</li>
                    <li>• Context: 128k tokens</li>
                    <li>• Temperature: 0.8</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Security</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• Ephemeral tokens (60s TTL)</li>
                    <li>• No audio storage</li>
                    <li>• End-to-end encryption</li>
                    <li>• HTTPS + WSS</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-600">
          <p>
            Powered by{' '}
            <a 
              href="https://platform.openai.com/docs/guides/realtime" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              OpenAI Realtime API
            </a>
            {' '}• Built with Next.js, TypeScript, and WebRTC
          </p>
        </div>
      </div>
    </div>
  );
}
