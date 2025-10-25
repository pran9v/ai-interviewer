"use client";
import React from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';

interface InterviewerAvatarProps {
    isPlaying: boolean;
    isSpeaking: boolean;
}

export function InterviewerAvatar({ isPlaying, isSpeaking }: InterviewerAvatarProps) {
    return (
        <div className="relative w-32 h-32 mx-auto mb-6">
            <motion.div
                className="absolute inset-0 bg-blue-500/20 rounded-full"
                animate={{
                    scale: isSpeaking ? [1, 1.1, 1] : 1,
                }}
                transition={{
                    duration: 2,
                    repeat: isSpeaking ? Infinity : 0,
                    ease: "easeInOut"
                }}
            />
            <div className="relative w-full h-full rounded-full overflow-hidden border-4 border-blue-500/30">
                <Image
                    src="/interviewer-avatar.png"
                    alt="AI Interviewer"
                    fill
                    className="object-cover"
                    priority
                />
            </div>
            {isPlaying && (
                <motion.div
                    className="absolute -right-2 -top-2 w-6 h-6 bg-green-500 rounded-full"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2 }}
                />
            )}
        </div>
    );
}