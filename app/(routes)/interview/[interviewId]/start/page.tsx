"use client"
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import axios from 'axios';
import { useConvex, useMutation } from 'convex/react';
import { useParams, useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mic, Video, LogOut, Check, ChevronRight, Loader2, Sparkles, MicOff, VideoOff } from 'lucide-react';
import { toast } from 'sonner';
import { FeedbackInfo } from '@/app/(routes)/dashboard/_components/FeedbackDialog';
import { ConversationManager, ConversationMessage } from '@/app/utils/conversation-manager';
import { AudioRecorder } from '@/app/utils/audio-recorder';
import { motion, AnimatePresence } from 'motion/react';
import { RealtimeVoice } from '@/app/components/RealtimeVoice';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';

export type InterviewData = {
    jobTitle: string | null,
    jobDescription: string | null,
    interviewQuestions: InterviewQuestions[],
    userId: string | null,
    _id: Id<'InterviewSessionTable'>,
    resumeUrl: string | null,
    status: string | null,
    feedback: FeedbackInfo | null,
    videoRequired?: boolean | null,
    conversation?: ConversationMessage[],
    currentQuestionIndex?: number,
    startedAt?: number,
    completedAt?: number
}

type InterviewQuestions = {
    answer: string,
    question: string
}

type Step = 'landing' | 'audio-check' | 'countdown' | 'interview' | 'completed' | 'feedback' | 'thank-you';

function StartInterview() {
    const { interviewId } = useParams();
    const { user } = useUser();
    const convex = useConvex();
    const router = useRouter();
    
    // State
    const [step, setStep] = useState<Step>('landing');
    const [interviewData, setInterviewData] = useState<InterviewData>();
    const [loading, setLoading] = useState(true);
    const [candidateName, setCandidateName] = useState('');
    const [selectedMic, setSelectedMic] = useState<string>('');
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [countdown, setCountdown] = useState(3);
    const [isInterviewStarted, setIsInterviewStarted] = useState(false);
    
    // Media Controls State
    const [isMicOn, setIsMicOn] = useState(true);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [callSeconds, setCallSeconds] = useState(0);

    // Video refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
    const [audioLevel, setAudioLevel] = useState(0);
    const [showTranscript, setShowTranscript] = useState(false);

    // Existing Logic State
    const [conversationManager, setConversationManager] = useState<ConversationManager | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<string>('');
    const [audioRecorder] = useState(() => new AudioRecorder());
    
    // Mutations
    const updateFeedback = useMutation(api.Interview.UpdateFeedback);
    const startInterview = useMutation(api.Interview.StartInterview);
    const updateConversation = useMutation(api.Interview.UpdateConversation);

    // Refs
    const realtimeClientRef = useRef<any>(null);
    const userTranscriptBuffer = useRef<string>('');
    const assistantTranscriptBuffer = useRef<string>('');

    // Load Data
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
        const result = await convex.query(api.Interview.GetInterviewQuestions, {
                    interviewRecordId: interviewId as Id<'InterviewSessionTable'>
        });
                // @ts-ignore
        setInterviewData(result);

                if (typeof result?.videoRequired === 'boolean') {
                    setIsVideoOn(result.videoRequired);
                }
                
                if (user?.firstName) {
                    setCandidateName(user.firstName);
                }
            } catch (err) {
                console.error(err);
                toast.error('Failed to load interview data');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [interviewId, user, convex]);

    // Initialize Conversation Manager
    useEffect(() => {
        if (interviewData?.interviewQuestions) {
            const questions = interviewData.interviewQuestions.map(q => q.question);
            const manager = new ConversationManager(questions);
            setConversationManager(manager);
        }
    }, [interviewData]);

    // Audio/Video Setup
    useEffect(() => {
        const getDevices = async () => {
            try {
                const devs = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devs.filter(d => d.kind === 'audioinput');
                setDevices(audioInputs);
                if (audioInputs.length > 0) {
                    setSelectedMic(prev => prev || audioInputs[0].deviceId);
                }
            } catch (err) {
                console.error('Error fetching devices', err);
            }
        };
        getDevices();
    }, []);

    // Start Camera
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: { deviceId: selectedMic ? { exact: selectedMic } : undefined } 
            });
            setVideoStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            const [audioTrack] = stream.getAudioTracks();
            const audioSettings = audioTrack?.getSettings();
            if (audioSettings?.deviceId) {
                setSelectedMic(audioSettings.deviceId);
            }

            try {
                const devs = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devs.filter(d => d.kind === 'audioinput');
                setDevices(audioInputs);
            } catch (deviceErr) {
                console.warn('Failed to refresh audio devices after permission grant:', deviceErr);
            }

            // Simple audio visualizer for check step
            const audioContext = new AudioContext();
            const analyser = audioContext.createAnalyser();
            const microphone = audioContext.createMediaStreamSource(stream);
            microphone.connect(analyser);
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            const updateLevel = () => {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for(let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;
                setAudioLevel(average);
                requestAnimationFrame(updateLevel);
            };
            updateLevel();

        } catch (err) {
            console.error('Error starting camera', err);
            toast.error('Could not access camera/microphone');
        }
    };

    useEffect(() => {
        if (step === 'audio-check' || step === 'interview') {
            startCamera();
        }
        return () => {
            if (videoStream) {
                videoStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [step]);

    // Media Control Handlers
    const toggleMic = () => {
        const newState = !isMicOn;
        setIsMicOn(newState);
        
        // Toggle local stream audio track (if exists)
        if (videoStream) {
            videoStream.getAudioTracks().forEach(track => {
                track.enabled = newState;
            });
        }
    };

    const toggleVideo = () => {
        if (interviewData?.videoRequired && isVideoOn) {
            toast.warning('Video is required for this interview.');
            return;
        }
        const newState = !isVideoOn;
        setIsVideoOn(newState);
        
        // Toggle local stream video track
        if (videoStream) {
            videoStream.getVideoTracks().forEach(track => {
                track.enabled = newState;
            });
        }
    };

    // Logic: Start Interview Flow
    const handleStartCountdown = () => {
        setStep('countdown');
        let count = 3; 
        const interval = setInterval(() => {
            count--;
            setCountdown(count);
            if (count === 0) {
                clearInterval(interval);
                beginInterview();
            }
                    }, 1000);
    };

    const beginInterview = async () => {
        try {
            setCallSeconds(0);
            setStep('interview');
            setIsInterviewStarted(true);
            
            // DB update
            await startInterview({
                recordId: interviewData!._id
            });

            // Get first question to trigger RealtimeVoice
            const firstQuestion = await conversationManager?.askNextQuestion();
            if (firstQuestion) {
                setCurrentQuestion(firstQuestion);
            }
            
            // Trigger connect on RealtimeVoice if ref exists (it should now mount)
            // Note: We use autoConnect on the component for simplicity
        } catch (err) {
            console.error(err);
            toast.error('Failed to start interview session');
        }
    };

    useEffect(() => {
        let timer: ReturnType<typeof setInterval> | null = null;
        if (step === 'interview') {
            timer = setInterval(() => {
                setCallSeconds(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (timer) {
                clearInterval(timer);
            }
        };
    }, [step]);

    const formatCallDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleEndInterview = async () => {
        try {
            // Disconnect Realtime
            if (realtimeClientRef.current) {
                    realtimeClientRef.current.disconnect();
            }
            
            setStep('completed');
            
        } catch (err) {
            console.error(err);
        }
    };
    
    const submitFeedback = async (rating: number, text: string) => {
        try {
            setStep('thank-you');
            
            // Process full transcript
            const conversation = conversationManager?.getConversation() || [];
             if (conversation.length > 0) {
            const response = await axios.post('/api/interview-feedback', {
                messages: conversation
            });
            const feedback = response.data;
            await updateFeedback({
                recordId: interviewData!._id,
                feedback: feedback
            });
             }
        } catch (err) {
            console.error('Error generating feedback:', err);
            // Still show thank you
        }
    };

    // Views
    
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen font-sans text-gray-900" style={{
            background: 'linear-gradient(135deg, #99C2FF 0%, #ffffff 50%, #99C2FF 100%)'
        }}>
            <AnimatePresence mode="wait">
                
                {/* 1. Landing / Get Ready */}
                {step === 'landing' && (
                    <motion.div 
                        key="landing"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="flex flex-col items-center justify-center min-h-screen p-4"
                    >
                        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-gray-100">
                            <h1 className="text-2xl font-bold mb-2">Get Ready for your interview!</h1>
                            <p className="text-gray-500 text-sm mb-8">
                                This screening interview is created by <span className="text-blue-600 font-medium">Matryc AI</span> and moderated by Matryc AI interviewer.
                            </p>
                            
                            <div className="bg-gray-50 rounded-xl p-1 mb-8">
                                <Input 
                                    value={candidateName}
                                    onChange={(e) => setCandidateName(e.target.value)}
                                    placeholder="Enter your name"
                                    className="border-0 bg-transparent text-center text-lg h-12 focus-visible:ring-0"
                                />
                            </div>

                            <div className="flex gap-4">
                                <Button variant="outline" className="flex-1 rounded-full h-12" onClick={() => router.back()}>
                                    Back
                                </Button>
                                <Button 
                                    className="flex-1 rounded-full h-12 bg-blue-500 hover:bg-blue-600 text-white"
                                    onClick={() => setStep('audio-check')}
                                    disabled={!candidateName.trim()}
                                >
                                    Next
                                </Button>
                            </div>
                            
                            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
                                <div className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center">!</div>
                                View Program and interview details
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* 2. Audio Check */}
                {step === 'audio-check' && (
                    <motion.div 
                        key="audio-check"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="flex flex-col items-center justify-center min-h-screen p-4"
                    >
                        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-gray-100">
                            <h2 className="text-2xl font-bold mb-2">Double check your audio</h2>
                            <p className="text-gray-500 text-sm mb-8">
                                Before you start, make sure your audio is set up properly.
                            </p>

                            <div className="mb-8 text-left">
                                <label className="text-xs font-semibold text-gray-900 mb-2 block">Microphone</label>
                                <div className="relative">
                                    <select 
                                        className="w-full p-3 bg-gray-50 rounded-xl appearance-none border-0 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={selectedMic}
                                        onChange={(e) => setSelectedMic(e.target.value)}
                                    >
                                        {devices.map((device, idx) => {
                                            const cleanedLabel = device.label?.trim();
                                            const isDefault = device.deviceId === 'default';
                                            const label = cleanedLabel && cleanedLabel.length > 0
                                                ? cleanedLabel
                                                : isDefault
                                                    ? 'Default Microphone'
                                                    : `Microphone ${idx + 1}`;
                                            return (
                                                <option key={`${device.deviceId}-${idx}`} value={device.deviceId}>
                                                    {label}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <div className="absolute right-3 top-3 pointer-events-none text-gray-400">
                                        <ChevronRight className="w-4 h-4 rotate-90" />
                                    </div>
                                </div>
                                
                                {/* Audio Meter */}
                                <div className="mt-4 h-1 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-green-500 transition-all duration-100"
                                        style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
                                    />
                                </div>
                                <p className="text-xs text-gray-400 mt-1">Speak to test your microphone</p>
                            </div>

                            <div className="flex gap-4">
                                <Button variant="outline" className="flex-1 rounded-full h-12" onClick={() => setStep('landing')}>
                                    Back
                                </Button>
                                <Button 
                                    className="flex-1 rounded-full h-12 bg-blue-500 hover:bg-blue-600 text-white"
                                    onClick={handleStartCountdown}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* 3. Countdown */}
                {step === 'countdown' && (
                    <motion.div 
                        key="countdown"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center min-h-screen bg-white"
                    >
                        <div className="bg-white rounded-3xl shadow-2xl p-12 text-center min-w-[300px]">
                            <h2 className="text-3xl font-bold mb-2">Starts in... {countdown}</h2>
                            <p className="text-gray-500 text-sm mb-6">Your interview is starting soon.</p>
                            <Button className="w-full rounded-full h-12 bg-blue-500 hover:bg-blue-600 text-white">
                                Get ready...
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* 4. Interview */}
                {step === 'interview' && (
                    <motion.div 
                        key="interview"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="h-screen w-full flex items-center justify-center p-4 md:p-8 relative overflow-hidden"
                    >
                        {/* Background Decoration */}
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-50 to-indigo-50 -z-10" />

                        <AnimatePresence>
                            {showTranscript && (
                                <>
                                    <motion.div
                                        key="transcript-overlay"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px] z-30"
                                        onClick={() => setShowTranscript(false)}
                                    />
                                    <motion.aside
                                        key="transcript-panel"
                                        initial={{ x: '100%' }}
                                        animate={{ x: 0 }}
                                        exit={{ x: '100%' }}
                                        transition={{ type: 'spring', damping: 20, stiffness: 220 }}
                                        className="absolute top-0 right-0 h-full w-full md:w-96 bg-white shadow-2xl z-40 flex flex-col border-l border-gray-100"
                                        onClick={(event) => event.stopPropagation()}
                                    >
                                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-900">Transcript</h3>
                                                <p className="text-xs text-gray-500">Live conversation log</p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="rounded-full"
                                                onClick={() => setShowTranscript(false)}
                                                aria-label="Close transcript"
                                            >
                                                <span className="text-xl leading-none">&times;</span>
                                            </Button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/70">
                                            <div className="space-y-4 text-sm leading-relaxed">
                                                <div className="flex gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-semibold">
                                                        AI
                                                    </div>
                                                    <div className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-blue-100">
                                                        <div className="text-xs uppercase tracking-wide text-blue-500 mb-1">12:00 PM • AI</div>
                                                        <p className="text-gray-700">
                                                            Welcome! Let’s take a moment to make sure you’re comfortable before we begin.
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-3 flex-row-reverse">
                                                    <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-700 flex items-center justify-center text-sm font-semibold">
                                                        You
                                                    </div>
                                                    <div className="flex-1 bg-blue-500/10 rounded-2xl p-4 shadow-sm border border-blue-100">
                                                        <div className="text-xs uppercase tracking-wide text-blue-600 mb-1 text-right">12:01 PM • You</div>
                                                        <p className="text-blue-900 text-right">
                                                            Sounds great — I’m ready to get started!
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-semibold">
                                                        AI
                                                    </div>
                                                    <div className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-blue-100">
                                                        <div className="text-xs uppercase tracking-wide text-blue-500 mb-1">12:02 PM • AI</div>
                                                        <p className="text-gray-700">
                                                            Perfect. To get started, could you walk me through why you’re interested in the program?
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="border-t border-gray-100 p-6 bg-white flex items-center justify-between gap-3">
                                            <div className="text-xs text-gray-400">
                                                Transcript updates in real-time while the interview is in progress.
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" onClick={() => setShowTranscript(false)}>
                                                    Minimise
                                                </Button>
                                                <Button size="sm">
                                                    Export
                                                </Button>
                                            </div>
                                        </div>
                                    </motion.aside>
                                </>
                            )}
                        </AnimatePresence>

                        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl h-[85vh] overflow-hidden flex flex-col md:flex-row relative">
                            
                            {/* Header */}
                            <div className="absolute top-6 left-8 z-20 flex items-center gap-3">
                                <div className="text-xl font-bold text-gray-900">
                                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="h-4 w-px bg-gray-300" />
                                <div className="text-blue-600 font-medium">{interviewData?.jobTitle || 'Interview'}</div>
                            </div>

                            <div className="absolute top-6 right-8 z-30">
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    className="rounded-full bg-blue-50 text-blue-600 border border-blue-100"
                                    onClick={() => setShowTranscript(true)}
                                >
                                    <Sparkles className="w-4 h-4 mr-1" /> Transcript
                                </Button>
                            </div>

                            {/* AI Avatar Section */}
                            <div className="flex-1 bg-blue-50/50 relative flex items-center justify-center p-8">
                                <div className="relative w-48 h-48 md:w-64 md:h-64">
                                    {/* Simple Avatar Placeholder */}
                                    <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-lg relative z-10">
                                         {/* Pulse effect handled by RealtimeVoice indirectly or we simulate */}
                                         <div className="absolute inset-0 rounded-full border-4 border-white opacity-20 animate-ping" />
                                         <span className="text-4xl text-white font-bold">AI</span>
                </div>

                                    {/* Render RealtimeVoice hidden but active */}
                                    <div className="absolute top-0 left-0 w-full h-full opacity-0 pointer-events-none">
                {currentQuestion && (
                        <RealtimeVoice
                            ref={realtimeClientRef}
                                                autoConnect={true}
                                                isMicEnabled={isMicOn}
                                                userName={candidateName}
                                                instructions={`BACKGROUND:
You are the AI screener for New York University.
GREETING:
Say: "Hey ${candidateName}, hope you're ready for your interview. Shall we begin?"
Wait for confirmation.
QUESTIONS:
${interviewData?.interviewQuestions.map((q, i) => `Q${i + 1}: "${q.question}"`).join('\n')}
COMPLETION:
When finished, say: "Thank you for your time. This concludes our interview."
`}
                            onTranscript={(transcript, role) => {
                                if (role === 'user') {
                                    userTranscriptBuffer.current += transcript;
                                                        // Logic to detect end
                                                        if (transcript.toLowerCase().includes('end the interview')) {
                                                            handleEndInterview();
                                                        }
                                                        // Simple sync to ConversationManager
                                                        if (transcript.match(/[.?!]$/)) {
                                                             conversationManager?.addUserResponse(userTranscriptBuffer.current);
                                        userTranscriptBuffer.current = '';
                                    }
                                                    } else {
                                    assistantTranscriptBuffer.current += transcript;
                                                        if (transcript.match(/[.?!]$/) && transcript.includes('?')) {
                                            conversationManager?.getConversation().push({
                                                from: 'bot',
                                                                text: assistantTranscriptBuffer.current,
                                                timestamp: Date.now()
                                            });
                                        assistantTranscriptBuffer.current = '';
                                    }
                                                        if (transcript.toLowerCase().includes('concludes our interview')) {
                                                            setTimeout(handleEndInterview, 3000);
                                                        }
                                                    }
                                                }}
                                            />
                                         )}
                                    </div>
                                </div>
                            </div>

                            {/* User Video Section */}
                            <div className="flex-1 bg-gray-100 relative overflow-hidden">
                                <video 
                                    ref={videoRef} 
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className="w-full h-full object-cover transform scale-x-[-1]" 
                                />
                                {!isVideoOn && (
                                    <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                                        <div className="w-24 h-24 rounded-full bg-gray-600 flex items-center justify-center">
                                            <span className="text-2xl text-white font-bold">{candidateName.charAt(0)}</span>
                                        </div>
                                    </div>
                                )}
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 px-4 py-1 rounded-full backdrop-blur-md">
                                    <span className="text-white text-sm font-medium">{candidateName} (You)</span>
                                    </div>
                                </div>

                            {/* Controls Bar */}
                            <div className="absolute bottom-8 left-0 w-full flex justify-center items-center gap-6 z-30 pointer-events-none">
                                <div className="bg-white rounded-full shadow-xl p-2 flex items-center gap-4 pointer-events-auto border border-gray-100">
                                    <Button 
                                        variant={isMicOn ? "ghost" : "destructive"} 
                                        size="icon" 
                                        className={`rounded-full h-12 w-12 ${isMicOn ? 'hover:bg-gray-100' : ''}`}
                                        onClick={toggleMic}
                                    >
                                        {isMicOn ? <Mic className="w-5 h-5 text-gray-700" /> : <MicOff className="w-5 h-5 text-white" />}
                                    </Button>
                                    <Button 
                                        variant={isVideoOn ? "ghost" : "destructive"} 
                                        size="icon" 
                                        className={`rounded-full h-12 w-12 ${isVideoOn ? 'hover:bg-gray-100' : ''}`}
                                        onClick={toggleVideo}
                                    >
                                        {isVideoOn ? <Video className="w-5 h-5 text-gray-700" /> : <VideoOff className="w-5 h-5 text-white" />}
                                    </Button>
                                <Button 
                                        className="rounded-full h-12 px-8 bg-red-500 hover:bg-red-600 text-white"
                                        onClick={handleEndInterview}
                                    >
                                        <span className="mr-2 font-medium">End Call</span>
                                        <LogOut className="w-4 h-4" />
                                </Button>
                                </div>
                                <div className="absolute right-8 bg-white rounded-full shadow-sm px-3 py-1.5 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                    <span className="text-xs font-mono text-gray-600">{formatCallDuration(callSeconds)}</span>
                                </div>
                            </div>

                        </div>
                            </motion.div>
                        )}

                {/* 5. Completed */}
                {step === 'completed' && (
                    <motion.div 
                        key="completed"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="min-h-screen flex items-center justify-center p-4"
                    >
                         <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center border border-gray-100">
                            <h2 className="text-xl font-bold mb-2">Your Interview has ended</h2>
                            <p className="text-gray-500 text-s mb-8">
                                Duration: {formatCallDuration(callSeconds)}
                            </p>
                            
                            <div className="flex gap-4">
                                <Button variant="outline" className="flex-1 rounded-full" onClick={() => window.location.reload()}>
                                    Start over
                                </Button>
                                <Button 
                                    className="flex-1 rounded-full bg-blue-500 hover:bg-blue-600 text-white"
                                    onClick={() => setStep('feedback')}
                                >
                                    Done
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* 6. Feedback */}
                {step === 'feedback' && (
                    <motion.div
                        key="feedback"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="min-h-screen flex items-center justify-center p-4"
                    >
                         <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-gray-100 relative">
                            {/* Rating Emoji Helper */}
                            <div className="flex justify-center gap-4 mb-6">
                                {['😫', '😔', '😐', '😊', '😍'].map((emoji, i) => (
                                    <button key={i} className="text-4xl hover:scale-110 transition-transform p-2 bg-gray-50 rounded-full hover:bg-blue-50">
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                            
                            <h2 className="text-xl font-bold mb-2">How are you feeling?</h2>
                            <p className="text-gray-500 text-xs mb-6">
                                Give your experience a rating and tell us how it went.
                            </p>

                            <div className="bg-gray-50 rounded-xl p-3 mb-6">
                                <textarea 
                                    className="w-full bg-transparent border-0 focus:ring-0 text-sm resize-none"
                                    rows={3}
                                    placeholder="Write your feedback here..."
                                />
                            </div>
                            
                            <div className="flex gap-4">
                                <Button variant="outline" className="flex-1 rounded-full h-12" onClick={() => setStep('landing')}>
                                    Start over
                                </Button>
                        <Button 
                                    className="flex-1 rounded-full h-12 bg-blue-500 hover:bg-blue-600 text-white"
                                    onClick={() => submitFeedback(5, '')}
                                >
                                    Done
                        </Button>
                            </div>
                        </div>
                    </motion.div>
                )}

                 {/* 7. Thank You */}
                 {step === 'thank-you' && (
                    <motion.div 
                        key="thank-you"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="min-h-screen flex items-center justify-center p-4"
                    >
                         <div className="bg-white rounded-3xl shadow-xl p-10 max-w-sm w-full text-center border border-gray-100">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600">
                                <Check className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
                            <p className="text-gray-500 text-sm mb-8">
                                So, what next?
                            </p>
                            
                            <div className="bg-blue-50 rounded-xl p-4 mb-4 text-left">
                                <h3 className="font-semibold text-sm text-blue-900 mb-1">You'll receive a confirmation email</h3>
                                <p className="text-xs text-blue-700 leading-relaxed">
                                    This is to let you know that your interview has been submitted successfully and your recruiter will review your interview shortly.
                                </p>
                            </div>

                            <Button 
                                className="w-full rounded-full h-12 bg-blue-500 hover:bg-blue-600 text-white mt-4"
                                onClick={() => router.push('/dashboard')}
                            >
                                Take me to Matryc
                            </Button>
            </div>
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
    )
}

export default StartInterview
