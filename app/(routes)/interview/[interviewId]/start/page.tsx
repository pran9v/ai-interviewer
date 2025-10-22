"use client"
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import axios from 'axios';
import { useConvex, useMutation } from 'convex/react';
import { useParams, useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mic, MicOff, Play, Pause, Volume2, VolumeX, Keyboard } from 'lucide-react';
import { toast } from 'sonner';
import { FeedbackInfo } from '@/app/(routes)/dashboard/_components/FeedbackDialog';
import { ConversationManager, ConversationMessage } from '@/app/utils/conversation-manager';
import { AudioRecorder } from '@/app/utils/audio-recorder';

export type InterviewData = {
    jobTitle: string | null,
    jobDescription: string | null,
    interviewQuestions: InterviewQuestions[],
    userId: string | null,
    _id: Id<'InterviewSessionTable'>,
    resumeUrl: string | null,
    status: string | null,
    feedback: FeedbackInfo | null,
    conversation?: ConversationMessage[],
    currentQuestionIndex?: number,
    startedAt?: number,
    completedAt?: number
}

type InterviewQuestions = {
    answer: string,
    question: string
}

function StartInterview() {
    const { interviewId } = useParams();
    const convex = useConvex();
    const [interviewData, setInterviewData] = useState<InterviewData>();
    const [isRecording, setIsRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [conversationManager, setConversationManager] = useState<ConversationManager | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<string>('');
    const [audioRecorder] = useState(() => new AudioRecorder());
    const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
    const [showTextInput, setShowTextInput] = useState(false);
    const [textResponse, setTextResponse] = useState('');
    
    const updateFeedback = useMutation(api.Interview.UpdateFeedback);
    const startInterview = useMutation(api.Interview.StartInterview);
    const updateConversation = useMutation(api.Interview.UpdateConversation);
    const router = useRouter();

    useEffect(() => {
        GetInterviewQuestions();
    }, [interviewId])

    const GetInterviewQuestions = async () => {
        const result = await convex.query(api.Interview.GetInterviewQuestions, {
            //@ts-ignore
            interviewRecordId: interviewId
        });
        console.log(result);
        //@ts-ignore
        setInterviewData(result);
    }

    useEffect(() => {
        if (interviewData?.interviewQuestions) {
            const questions = interviewData.interviewQuestions.map(q => q.question);
            const manager = new ConversationManager(questions);
            setConversationManager(manager);
        }
    }, [interviewData])

    useEffect(() => {
        // Automatically start recording when a new question comes up
        if (currentQuestion && !conversationManager?.isComplete() && !showTextInput && !isRecording) {
            startRecording();
        }
    }, [currentQuestion, conversationManager, showTextInput]);

    const speakText = async (text: string): Promise<void> => {
        try {
            setIsPlaying(true);
            
            const response = await fetch('/api/elevenlabs/text-to-speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            if (!response.ok) {
                throw new Error('Failed to generate speech');
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            // Stop any existing audio
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }
            
            setCurrentAudio(audio);
            
            audio.onended = () => {
                setIsPlaying(false);
                URL.revokeObjectURL(audioUrl);
            };

            audio.onerror = () => {
                setIsPlaying(false);
                toast.error('Error playing audio');
                URL.revokeObjectURL(audioUrl);
            };

            if (!isMuted) {
                await audio.play();
            } else {
                setIsPlaying(false);
            }
        } catch (error) {
            console.error('Error speaking text:', error);
            setIsPlaying(false);
            toast.error('Failed to play audio');
        }
    };

  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');

      const response = await fetch('/api/elevenlabs/speech-to-text', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle quota exceeded error
        if (response.status === 429 && errorData.fallback) {
          toast.error('OpenAI quota exceeded. Please add credits to your OpenAI account.');
          throw new Error('OpenAI quota exceeded');
        }
        
        throw new Error('Failed to transcribe audio');
      }

      const result = await response.json();
      return result.text;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    }
  };

    const askNextQuestion = async (): Promise<boolean> => {
        if (!conversationManager) return false;

        const question = await conversationManager.askNextQuestion();
        if (!question) {
            // Interview complete
            await endInterview();
            return false;
        }

        setCurrentQuestion(question);
        await speakText(question);
        
        // Update conversation in database
        await updateConversation({
            recordId: interviewData!._id,
            conversation: conversationManager.getConversation(),
            currentQuestionIndex: conversationManager.getCurrentQuestionIndex()
        });

        return true;
    };

    const startRecording = async () => {
        try {
            await audioRecorder.startRecording();
            setIsRecording(true);
            toast.success('Recording started');
        } catch (error) {
            console.error('Error starting recording:', error);
            toast.error('Failed to start recording. Please check microphone permissions.');
        }
    };

    const stopRecording = async () => {
        try {
            const audioBlob = await audioRecorder.stopRecording();
            setIsRecording(false);
            
            // Convert to WAV for better compatibility
            const wavBlob = await audioRecorder.convertToWav(audioBlob);
            
            // Transcribe audio
            const transcription = await transcribeAudio(wavBlob);
            
            if (transcription.trim()) {
                // Add user response to conversation
                conversationManager?.addUserResponse(transcription);
                
                // Update conversation in database
                await updateConversation({
                    recordId: interviewData!._id,
                    conversation: conversationManager?.getConversation() || [],
                    currentQuestionIndex: conversationManager?.getCurrentQuestionIndex() || 0
                });

                // Ask next question
                await askNextQuestion();
            } else {
                toast.warning('No speech detected. Please try again.');
            }
        } catch (error) {
            console.error('Error stopping recording:', error);
            
            // If transcription fails due to quota, offer text input fallback
            if (error instanceof Error && error.message === 'OpenAI quota exceeded') {
                toast.error('Speech-to-text unavailable. Please type your response instead.');
                setShowTextInput(true);
            } else {
                toast.error('Failed to process recording');
            }
        }
    };

    const submitTextResponse = async () => {
        if (!textResponse.trim()) {
            toast.error('Please enter your response');
            return;
        }

        try {
            // Add user response to conversation
            conversationManager?.addUserResponse(textResponse.trim());
            
            // Update conversation in database
            await updateConversation({
                recordId: interviewData!._id,
                conversation: conversationManager?.getConversation() || [],
                currentQuestionIndex: conversationManager?.getCurrentQuestionIndex() || 0
            });

            // Clear text input and hide it
            setTextResponse('');
            setShowTextInput(false);

            // Ask next question
            await askNextQuestion();
        } catch (error) {
            console.error('Error submitting text response:', error);
            toast.error('Failed to submit response');
        }
    };

    const startInterviewSession = async () => {
        try {
            setLoading(true);
            
            // Mark interview as started
            await startInterview({
                recordId: interviewData!._id
            });

            // Start with first question
            await askNextQuestion();
            
            toast.success('Interview started!');
        } catch (error) {
            console.error('Error starting interview:', error);
            toast.error('Failed to start interview');
        } finally {
            setLoading(false);
        }
    };

    const endInterview = async () => {
        try {
            setLoading(true);
            
            // Stop any playing audio
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }

            // Generate feedback
            const conversation = conversationManager?.getConversation() || [];
            const response = await axios.post('/api/interview-feedback', {
                messages: conversation
            });

            const feedback = response.data;

            // Update interview with feedback
            await updateFeedback({
                recordId: interviewData!._id,
                feedback: feedback
            });

            toast.success('Interview completed!');
            
            // Redirect to results
            router.push(`/interview/${interviewId}/results`);
        } catch (error) {
            console.error('Error ending interview:', error);
            toast.error('Failed to complete interview');
        } finally {
            setLoading(false);
        }
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
        if (currentAudio) {
            currentAudio.muted = !isMuted;
        }
    };

    const progress = conversationManager?.getProgress() || { current: 0, total: 0, percentage: 0 };

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {interviewData?.jobTitle || 'AI Interview'}
                    </h1>
                    <p className="text-gray-600">
                        {interviewData?.jobDescription || 'Voice-based interview session'}
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">
                            Question {progress.current} of {progress.total}
                        </span>
                        <span className="text-sm text-gray-500">
                            {progress.percentage}% Complete
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress.percentage}%` }}
                        ></div>
                    </div>
                </div>

                {/* Current Question */}
                {currentQuestion && (
                    <div className="bg-white rounded-lg p-6 mb-8 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Question:</h3>
                        <p className="text-gray-700 text-lg leading-relaxed">{currentQuestion}</p>
                    </div>
                )}

                {/* Conversation History */}
                {conversationManager?.getConversation() && conversationManager.getConversation().length > 0 && (
                    <div className="bg-white rounded-lg p-6 mb-8 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversation:</h3>
                        <div className="space-y-4 max-h-64 overflow-y-auto">
                            {conversationManager.getConversation().map((message, index) => (
                                <div 
                                    key={index} 
                                    className={`p-3 rounded-lg ${
                                        message.from === 'bot' 
                                            ? 'bg-blue-50 border-l-4 border-blue-400' 
                                            : 'bg-green-50 border-l-4 border-green-400'
                                    }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className="font-medium text-sm text-gray-600">
                                            {message.from === 'bot' ? 'Interviewer' : 'You'}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {new Date(message.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <p className="text-gray-800 mt-1">{message.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Controls */}
                <div className="bg-white rounded-lg p-6 shadow-sm">
                    <div className="flex flex-col items-center space-y-4">
                        {/* Status */}
                        <div className="text-center">
                            {isPlaying && (
                                <p className="text-blue-600 font-medium">🎤 Interviewer is speaking...</p>
                            )}
                            {isRecording && (
                                <p className="text-red-600 font-medium">🔴 Recording your response...</p>
                            )}
                            {!isPlaying && !isRecording && !currentQuestion && (
                                <p className="text-gray-600">Click "Start Interview" to begin</p>
                            )}
                        </div>

                        {/* Control Buttons */}
                        <div className="flex items-center space-x-4">
                            {/* Start Interview Button */}
                            {!currentQuestion && (
                                <Button 
                                    onClick={startInterviewSession}
                                    disabled={loading}
                                    size="lg"
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    {loading ? 'Starting...' : 'Start Interview'}
                                </Button>
                            )}
                            {/* RECORDING BUTTON REMOVED */}
                            {/* Text Input Fallback */}
                            {showTextInput && (
                                <div className="flex items-center space-x-2">
                                    <Input
                                        value={textResponse}
                                        onChange={(e) => setTextResponse(e.target.value)}
                                        placeholder="Type your response here..."
                                        className="min-w-64"
                                        onKeyPress={(e) => e.key === 'Enter' && submitTextResponse()}
                                    />
                                    <Button
                                        onClick={submitTextResponse}
                                        disabled={loading}
                                        size="lg"
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        Submit
                                    </Button>
                                </div>
                            )}
                            {/* End Interview Button */}
                            {conversationManager?.isComplete() && (
                                <Button
                                    onClick={endInterview}
                                    disabled={loading}
                                    size="lg"
                                    className="bg-gray-600 hover:bg-gray-700"
                                >
                                    {loading ? 'Completing...' : 'End Interview'}
                                </Button>
                            )}
                            {/* Mute Button */}
                            <Button
                                onClick={toggleMute}
                                variant="outline"
                                size="lg"
                            >
                                {isMuted ? (
                                    <>
                                        <VolumeX className="w-5 h-5 mr-2" />
                                        Unmute
                                    </>
                                ) : (
                                    <>
                                        <Volume2 className="w-5 h-5 mr-2" />
                                        Mute
                                    </>
                                )}
                            </Button>
                        </div>
                        {/* Instructions */}
                        <div className="text-center text-sm text-gray-500 max-w-md">
                            <p>
                                {!currentQuestion && "Make sure your microphone is working before starting."}
                                {currentQuestion && !isRecording && !showTextInput && "Interview is live. Your answers will be automatically recorded."}
                                {isRecording && "Speak clearly into your microphone. Recording is automatic for each response."}
                                {showTextInput && "Speech-to-text is unavailable. Please type your response and press Enter or click Submit."}
                                {conversationManager?.isComplete() && "Interview completed! Click 'End Interview' to generate feedback."}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default StartInterview