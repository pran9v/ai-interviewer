"use client";
import React from 'react';

interface InterviewControlsProps {
    isRecording: boolean;
    isPlaying: boolean;
    isMuted: boolean;
    showTextInput: boolean;
    totalQuestions: number;
    currentQuestionIndex: number;
    onToggleMute: () => void;
    onStartRecording: () => void;
    onStopRecording: () => void;
    onSwitchToText: () => void;
    onSwitchToVoice: () => void;
    onSubmitText: () => void;
    textResponse: string;
    onTextChange: (text: string) => void;
}

export function InterviewControls({
    isRecording,
    isPlaying,
    isMuted,
    showTextInput,
    totalQuestions,
    currentQuestionIndex,
    onToggleMute,
    onStartRecording,
    onStopRecording,
    onSwitchToText,
    onSwitchToVoice,
    onSubmitText,
    textResponse,
    onTextChange,
}: InterviewControlsProps) {
    const progress = ((currentQuestionIndex + 1) * 100) / totalQuestions;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-center gap-4">
                <button
                    onClick={onSwitchToVoice}
                    className={`px-4 py-2 rounded-lg transition-all ${
                        !showTextInput
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    Voice Response
                </button>
                <button
                    onClick={onSwitchToText}
                    className={`px-4 py-2 rounded-lg transition-all ${
                        showTextInput
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    Text Response
                </button>
            </div>

            {showTextInput ? (
                <div className="space-y-4">
                    <textarea
                        value={textResponse}
                        onChange={(e) => onTextChange(e.target.value)}
                        placeholder="Type your response..."
                        className="w-full min-h-[100px] p-3 border rounded-lg"
                    />
                    <div className="flex justify-center">
                        <button
                            onClick={onSubmitText}
                            disabled={!textResponse.trim()}
                            className={`px-6 py-2 rounded-lg ${
                                textResponse.trim()
                                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            Submit Response
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex justify-center gap-4">
                    {!isRecording ? (
                        <button
                            onClick={onStartRecording}
                            disabled={isPlaying}
                            className={`px-6 py-2 rounded-lg flex items-center gap-2 ${
                                isPlaying
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-blue-500 text-white hover:bg-blue-600'
                            }`}
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                            </svg>
                            Start Recording
                        </button>
                    ) : (
                        <button
                            onClick={onStopRecording}
                            className="px-6 py-2 rounded-lg flex items-center gap-2 bg-red-500 text-white hover:bg-red-600"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.51-2.31.51-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                            </svg>
                            Stop Recording
                        </button>
                    )}
                </div>
            )}

            <div className="flex justify-center">
                <button
                    onClick={onToggleMute}
                    className={`p-2 rounded-full ${
                        isMuted ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-700'
                    }`}
                >
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        {isMuted ? (
                            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                        ) : (
                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                        )}
                    </svg>
                </button>
            </div>

            <div className="mt-8">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Progress</span>
                    <span>{`Question ${currentQuestionIndex + 1} of ${totalQuestions}`}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
}