"use client";
import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface VoiceAssistantProps {
    isSpeaking: boolean;
    isListening: boolean;
    volume?: number; // 0-100
}

export function VoiceAssistant({ isSpeaking, isListening, volume = 0 }: VoiceAssistantProps) {
    const [bars, setBars] = useState<number[]>([]);

    // Generate random bar heights for speaking animation
    useEffect(() => {
        if (isSpeaking) {
            const interval = setInterval(() => {
                setBars(Array.from({ length: 20 }, () => Math.random() * 60 + 20));
            }, 150);
            return () => clearInterval(interval);
        } else if (isListening) {
            // For listening, use volume-based bars
            const volumeHeight = (volume / 100) * 80;
            setBars(Array.from({ length: 20 }, (_, i) => {
                const position = Math.abs(i - 10) / 10; // 0 at center, 1 at edges
                return volumeHeight * (1 - position * 0.7);
            }));
        } else {
            setBars(Array.from({ length: 20 }, () => 10));
        }
    }, [isSpeaking, isListening, volume]);

    // Subtle scale based on state
    const getScale = () => {
        if (isSpeaking) {
            return [1, 1.05, 1];
        } else if (isListening) {
            const volumeScale = 1 + (volume / 100) * 0.08;
            return volumeScale;
        }
        return 1.0;
    };

    return (
        <div className="relative flex flex-col items-center justify-center w-full py-8 mb-6">
            {/* Main circle with avatar/icon */}
            <motion.div
                className="relative mb-6"
                animate={{
                    scale: getScale(),
                }}
                transition={{
                    duration: isSpeaking ? 2 : 0.15,
                    repeat: isSpeaking ? Infinity : 0,
                    ease: "easeInOut"
                }}
            >
                <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
                    isSpeaking 
                        ? 'bg-gradient-to-br from-blue-400 to-blue-600' 
                        : isListening 
                        ? 'bg-gradient-to-br from-green-400 to-green-600'
                        : 'bg-gradient-to-br from-gray-300 to-gray-500'
                }`}>
                    {isSpeaking ? (
                        <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                        </svg>
                    ) : isListening ? (
                        <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        </svg>
                    ) : (
                        <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                        </svg>
                    )}
                </div>

                {/* Animated pulse ring */}
                {(isListening && volume > 15) || isSpeaking && (
                    <motion.div
                        className={`absolute inset-0 rounded-full border-2 ${
                            isSpeaking ? 'border-blue-400' : 'border-green-400'
                        }`}
                        animate={{
                            scale: [1, 1.4, 1],
                            opacity: [0.4, 0, 0.4],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeOut"
                        }}
                    />
                )}
            </motion.div>

            {/* Waveform Visualization */}
            <div className="flex items-center justify-center gap-1 h-20 mb-4">
                {bars.map((height, index) => (
                    <motion.div
                        key={index}
                        className={`w-1.5 rounded-full ${
                            isSpeaking 
                                ? 'bg-blue-500' 
                                : isListening 
                                ? 'bg-green-500'
                                : 'bg-gray-300'
                        }`}
                        animate={{
                            height: `${height}%`,
                        }}
                        transition={{
                            duration: 0.15,
                            ease: "easeOut"
                        }}
                    />
                ))}
            </div>

            {/* Status text with enhanced styling */}
            <motion.div
                className="mt-2 text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                {isSpeaking && (
                    <div className="space-y-1">
                        <p className="text-blue-600 font-semibold text-base">
                            Interviewer is speaking...
                        </p>
                        <p className="text-gray-500 text-xs">
                            Please listen carefully
                        </p>
                    </div>
                )}
                {isListening && (
                    <div className="space-y-1">
                        <p className="text-green-600 font-semibold text-base">
                            {volume > 10 ? '🎤 Listening...' : 'Waiting for your response...'}
                        </p>
                        {volume > 10 && (
                            <p className="text-gray-500 text-xs">
                                Voice detected - speak clearly
                            </p>
                        )}
                    </div>
                )}
                {!isSpeaking && !isListening && (
                    <div className="space-y-1">
                        <p className="text-gray-600 font-medium text-base">
                            Ready
                        </p>
                        <p className="text-gray-400 text-xs">
                            Waiting to begin...
                        </p>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
