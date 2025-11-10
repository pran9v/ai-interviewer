"use client"
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import axios from 'axios';
import { useConvex, useMutation } from 'convex/react';
import { useParams, useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Keyboard, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { FeedbackInfo } from '@/app/(routes)/dashboard/_components/FeedbackDialog';
import { ConversationManager, ConversationMessage } from '@/app/utils/conversation-manager';
import { AudioRecorder } from '@/app/utils/audio-recorder';
import { motion } from 'motion/react';
import { RealtimeVoice } from '@/app/components/RealtimeVoice';

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
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [volume, setVolume] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const isAskingQuestionRef = useRef(false);
    const responseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const promptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const forcedNoVoiceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const hasHeardSpeechSinceStartRef = useRef(false);
    const realtimeClientRef = useRef<any>(null);
    const assistantTranscriptBuffer = useRef<string>(''); // Accumulate AI responses before checking
    const userTranscriptBuffer = useRef<string>(''); // Accumulate user responses before checking
    const FALLBACK_NO_VOICE_MS = 8000;
    const postTTSWatchdogTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Canonical helpers
    const clearAllTimers = () => {
        if (promptTimeoutRef.current) {
            clearTimeout(promptTimeoutRef.current);
            promptTimeoutRef.current = null;
        }
        if (responseTimeoutRef.current) {
            clearTimeout(responseTimeoutRef.current);
            responseTimeoutRef.current = null;
        }
        if (forcedNoVoiceTimerRef.current) {
            clearTimeout(forcedNoVoiceTimerRef.current);
            forcedNoVoiceTimerRef.current = null;
        }
        if (postTTSWatchdogTimerRef.current) {
            clearTimeout(postTTSWatchdogTimerRef.current);
            postTTSWatchdogTimerRef.current = null;
        }
    };
    const isWaiting = () => !!conversationManager?.isWaitingForResponse();
    
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

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            clearAllTimers();
        };
    }, []);

    const speakText = async (text: string, onComplete?: () => void): Promise<void> => {
        try {
            setIsPlaying(true);
            setIsSpeaking(true);
            // On TTS start, normalize state and clear timers
            clearAllTimers();
            setIsRecording(false);
            
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
            
            const schedulePostTTSWatchdog = () => {
                // Clear any previous watchdogs and schedule a short guard
                clearAllTimers();
                postTTSWatchdogTimerRef.current = setTimeout(async () => {
                    // If still waiting for response and not recording, try to (re)start
                    if (isWaiting() && !isRecording && !showTextInput) {
                        console.log('🎯 Post-TTS watchdog: auto-starting recording');
                        await startRecordingWithRetry();
                        setupResponseTimeout();
                    }
                }, 2500);
            };

            // Wrap end/error into a promise so callers can await TTS completion
            await new Promise<void>((resolve) => {
                audio.onended = () => {
                    console.log('TTS onended');
                    setIsPlaying(false);
                    setIsSpeaking(false);
                    URL.revokeObjectURL(audioUrl);
                    // When AI finishes speaking, automatically start recording
                    if (onComplete) {
                        onComplete();
                    }
                    schedulePostTTSWatchdog();
                    resolve();
                };

                audio.onerror = () => {
                    console.log('TTS onerror');
                    setIsPlaying(false);
                    setIsSpeaking(false);
                    toast.error('Error playing audio');
                    URL.revokeObjectURL(audioUrl);
                    if (onComplete) {
                        onComplete();
                    }
                    schedulePostTTSWatchdog();
                    resolve();
                };

                (async () => {
                    if (!isMuted) {
                        console.log('TTS starting playback');
                        await audio.play();
                    } else {
                        console.log('TTS muted, skipping playback');
                        setIsPlaying(false);
                        setIsSpeaking(false);
                        if (onComplete) {
                            onComplete();
                        }
                        schedulePostTTSWatchdog();
                        resolve();
                    }
                })();
            });
        } catch (error) {
            console.error('Error speaking text:', error);
            setIsPlaying(false);
            setIsSpeaking(false);
            toast.error('Failed to play audio');
            if (onComplete) {
                onComplete();
            }
            // Even on error, set watchdog to ensure recording starts
            clearAllTimers();
            postTTSWatchdogTimerRef.current = setTimeout(async () => {
                if (isWaiting() && !isRecording && !showTextInput) {
                    console.log('🎯 Post-TTS watchdog (error path): auto-starting recording');
                    await startRecordingWithRetry();
                    setupResponseTimeout();
                }
            }, 2500);
        }
    };

    // Retry helper to guarantee mic start
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
    const startRecordingWithRetry = async (retries: number = 2, delayMs: number = 1000) => {
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                await startRecording();
                // Confirm start by checking state shortly after
                await sleep(150);
                if (isRecording || audioRecorder.isRecording()) return;
                throw new Error('Recorder did not start');
            } catch (err) {
                console.warn('startRecordingWithRetry: attempt', attempt + 1, 'failed:', err);
                if (attempt < retries) {
                    await sleep(delayMs);
                    continue;
                }
                // Final fallback: enable text input as a recovery path
                setShowTextInput(true);
                toast.error('Could not auto-start microphone. Please type your answer.');
                try { console.warn('telemetry: mic_auto_start_failed'); } catch {}
            }
        }
    };

  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    try {
      console.log('transcribeAudio: starting, blob size:', audioBlob.size, 'type:', audioBlob.type);
      
      if (!audioBlob || audioBlob.size === 0) {
        console.error('transcribeAudio: empty or invalid blob');
        throw new Error('Cannot transcribe empty audio');
      }
      
      const formData = new FormData();
      // Use appropriate filename based on blob type
      const filename = audioBlob.type.includes('wav') ? 'recording.wav' : 'recording.webm';
      formData.append('audio', audioBlob, filename);
      console.log('transcribeAudio: sending to /api/elevenlabs/speech-to-text as', filename);

      const response = await fetch('/api/elevenlabs/speech-to-text', {
        method: 'POST',
        body: formData
      });

      console.log('transcribeAudio: response status:', response.status);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (jsonErr) {
          console.error('transcribeAudio: failed to parse error response as JSON');
          throw new Error(`Transcription failed with status ${response.status}`);
        }
        
        console.error('transcribeAudio: error response:', errorData);
        
        // Handle quota exceeded error
        if (response.status === 429 && errorData.fallback) {
          toast.error('OpenAI quota exceeded. Please add credits to your OpenAI account.');
          throw new Error('OpenAI quota exceeded');
        }
        
        throw new Error(errorData.error || 'Failed to transcribe audio');
      }

      const result = await response.json();
      console.log('transcribeAudio: success, text length:', result.text?.length || 0);
      return result.text || '';
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    }
  };

    const askNextQuestion = async (useTransition: boolean = false): Promise<boolean> => {
        if (!conversationManager) return false;

        // NEW: Prevent multiple simultaneous AI responses (mutex lock)
        if (isAskingQuestionRef.current) {
            console.warn('⚠️ askNextQuestion: already asking a question, blocking duplicate call');
            return false;
        }

        // Acquire lock
        isAskingQuestionRef.current = true;
        console.log('🔒 askNextQuestion: lock acquired, transitioning. useTransition =', useTransition);

        // Clear all timers on question transition
        clearAllTimers();

        const question = await conversationManager.askNextQuestion();
        if (!question) {
            // Interview complete
            isAskingQuestionRef.current = false; // Release lock
            console.log('🔓 askNextQuestion: lock released (interview complete)');
            await endInterview();
            return false;
        }

        // If not the first question and we want a transition, add a natural transition phrase
        let questionToSpeak = question;
        if (useTransition && conversationManager.getCurrentQuestionIndex() > 1) {
            const transition = conversationManager.getTransitionPhrase();
            questionToSpeak = `${transition} ${question}`;
        }

        setCurrentQuestion(question);
        console.log('askNextQuestion: currentIndex =', conversationManager.getCurrentQuestionIndex(), 'question =', questionToSpeak);
        
        // Speak the question and when done, auto-start recording (and await completion)
        try {
            await speakText(questionToSpeak, async () => {
                console.log('askNextQuestion: TTS finished callback — scheduling 500ms auto-start');
                setTimeout(async () => {
                    if (!isRecording && !showTextInput && conversationManager?.isWaitingForResponse()) {
                        try {
                            console.log('askNextQuestion: 500ms auto-start — calling startRecording');
                            await startRecording();
                            // CRITICAL: Set up response timeout after auto-start
                            setupResponseTimeout();
                        } catch (err) {
                            console.error('Failed to auto-start recording after question:', err);
                            toast.error('Failed to start recording. Please check your microphone.');
                        }
                    } else {
                        console.warn('askNextQuestion: 500ms auto-start skipped. isRecording:', isRecording, 'showTextInput:', showTextInput, 'waiting:', conversationManager?.isWaitingForResponse());
                    }
                }, 500);
            });
            console.log('askNextQuestion: speakText promise resolved (TTS complete)');
            
            // NEW: Release lock after TTS completes and recording starts
            isAskingQuestionRef.current = false;
            console.log('🔓 askNextQuestion: lock released (TTS complete, user can respond)');
        } catch (err) {
            console.error('Error speaking question:', err);
            toast.error('Failed to play question audio. Continuing...');
            
            // NEW: Release lock even on error
            isAskingQuestionRef.current = false;
            console.log('🔓 askNextQuestion: lock released (error path)');
            
            // Even if speech fails, still try to start recording
            setTimeout(async () => {
                if (!isRecording && !showTextInput && conversationManager?.isWaitingForResponse()) {
                    try {
                        await startRecording();
                        setupResponseTimeout();
                    } catch (err2) {
                        console.error('Failed to start recording after speech error:', err2);
                    }
                }
            }, 500);
        }
        
        // Update conversation in database with error handling
        try {
            await updateConversation({
                recordId: interviewData!._id,
                conversation: conversationManager.getConversation(),
                currentQuestionIndex: conversationManager.getCurrentQuestionIndex()
            });
        } catch (err) {
            console.error('Failed to update conversation in database:', err);
            // Don't block the flow on DB errors
        }

        return true;
    };

    const setupResponseTimeout = () => {
        // Clear any existing timeout
        if (promptTimeoutRef.current) {
            clearTimeout(promptTimeoutRef.current);
        }

        // Prompt user after 20 seconds if no response AND no voice detected
        // This gives more time and only prompts if truly silent
        promptTimeoutRef.current = setTimeout(async () => {
            // Only prompt if:
            // 1. We're waiting for response
            // 2. Not currently recording
            // 3. Volume is very low (user not speaking)
            if (conversationManager?.isWaitingForResponse() && !isRecording && volume < 5) {
                const prompt = conversationManager.getPromptForNoResponse();
                await speakText(prompt, async () => {
                    // After prompting, wait a bit more and start recording if still no response
                    setTimeout(async () => {
                        if (!isRecording && !showTextInput && conversationManager?.isWaitingForResponse() && volume < 5) {
                            await startRecording();
                            setupResponseTimeout(); // Reset timeout
                        }
                    }, 1000);
                });
            } else if (volume >= 5) {
                // User is speaking, reset timeout
                setupResponseTimeout();
            }
        }, 20000); // 20 seconds - longer timeout
    };

    const startRecording = async () => {
        try {
            console.log('startRecording: attempting to start, current isRecording:', isRecording, 'isAskingQuestion:', isAskingQuestionRef.current);
            
            // Prevent multiple simultaneous recording sessions
            if (isRecording) {
                console.warn('startRecording: already recording, ignoring duplicate call');
                return;
            }

            // NEW: Prevent recording if AI is currently asking a question
            if (isAskingQuestionRef.current) {
                console.warn('startRecording: AI is asking question, ignoring recording start');
                return;
            }

            // Normalize: clear all timers before starting a fresh recording session
            clearAllTimers();
            
            // Reset speech tracking for this session
            hasHeardSpeechSinceStartRef.current = false;

            // Set up silence detection callback - always safe / idempotent
            audioRecorder.setOnSilenceDetected(() => {
                console.log('🚀 Silence detected callback triggered - calling stopRecording(silence)');
                stopRecording('silence');
            });
            
            // Set up volume update callback for visualization & speech detection heuristic
            audioRecorder.setOnVolumeUpdate((vol: number) => {
                setVolume(vol);
                // Mark speech detected if volume passes a modest threshold once
                if (!hasHeardSpeechSinceStartRef.current && vol > 12) {
                    hasHeardSpeechSinceStartRef.current = true;
                    console.log('🎤 SPEECH DETECTED → hasHeardSpeechSinceStartRef = true, volume:', vol);
                }
            });
            
            await audioRecorder.startRecording();
            setIsRecording(true);
            setVolume(0); // Reset volume when starting
            console.log('startRecording: successfully started, isRecording set to true');
            toast.success('Recording started');

            // If TTS watchdog was pending, clear it since we've successfully started
            if (postTTSWatchdogTimerRef.current) {
                clearTimeout(postTTSWatchdogTimerRef.current);
                postTTSWatchdogTimerRef.current = null;
            }

            // Clear any previous watchdogs
            clearAllTimers();
            // Start fallback watchdog: if no speech at all in N ms, force stop (watchdog)
            forcedNoVoiceTimerRef.current = setTimeout(() => {
                if (isRecording && !hasHeardSpeechSinceStartRef.current) {
                    console.log('⚠️ Watchdog fallback triggered: no voice detected within', FALLBACK_NO_VOICE_MS, 'ms. Forcing stopRecording(watchdog)');
                    stopRecording('watchdog');
                }
            }, FALLBACK_NO_VOICE_MS);
        } catch (error) {
            console.error('Error starting recording:', error);
            setIsRecording(false); // Ensure state is reset on error
            toast.error('Failed to start recording. Please check microphone permissions.');
        }
    };

    const stopRecording = async (source: 'silence' | 'manual' | 'watchdog' = 'manual') => {
        try {
            console.log('stopRecording:', source, 'attempting to stop, current isRecording:', isRecording, 'isProcessing:', isProcessing, 'isStopping:', isStopping, 'isAskingQuestion:', isAskingQuestionRef.current);

            // Idempotent guards
            if (!isRecording && !audioRecorder.isRecording() && !isStopping) {
                console.warn('stopRecording:', source, 'nothing to stop (already inactive)');
                return;
            }
            if (isStopping) {
                console.warn('stopRecording:', source, 'already stopping; ignoring duplicate call');
                return;
            }

            // NEW: Prevent processing if AI is currently asking a question
            if (isAskingQuestionRef.current) {
                console.warn('stopRecording:', source, 'AI is asking question, deferring stop until question complete');
                setIsRecording(false);
                setIsStopping(false);
                return;
            }

            // NEW: Block if already processing another transcription
            if (isProcessing) {
                console.warn('stopRecording:', source, 'already processing a transcription, blocking duplicate');
                setIsRecording(false);
                setIsStopping(false);
                return;
            }

            setIsStopping(true);
            setIsRecording(false); // Early flag to prevent more triggers
            setIsProcessing(true); // Queue processing exactly once
            
            // Clear all timers when we stop recording for any reason
            clearAllTimers();

            console.log('stopRecording:', source, 'calling audioRecorder.stopRecording()');
            const audioBlob = await audioRecorder.stopRecording();
            setVolume(0); // Reset volume when stopping
            console.log('stopRecording:', source, 'successfully stopped, blob size:', audioBlob.size, 'type:', audioBlob.type);
            
            // Validate audio blob before transcription
            if (!audioBlob || audioBlob.size === 0) {
                throw new Error('Empty audio recording');
            }
            
            if (audioBlob.size < 100) {
                console.error('stopRecording: blob too small, likely corrupted or too short');
                throw new Error('Recording too short. Please speak for at least 1 second.');
            }
            
            // Convert to WAV for better compatibility and reliability
            toast.info('Processing your response...');
            console.log('stopRecording: converting to WAV format');
            let processedBlob: Blob;
            try {
                processedBlob = await audioRecorder.convertToWav(audioBlob);
                console.log('stopRecording: WAV conversion successful, size:', processedBlob.size);
            } catch (convErr) {
                console.warn('stopRecording: WAV conversion failed, using original blob:', convErr);
                processedBlob = audioBlob; // Fallback to original
            }
            
            console.log('stopRecording: starting transcription, format:', processedBlob.type);
            const transcription = await transcribeAudio(processedBlob);
            console.log('stopRecording: transcription result:', transcription ? `"${transcription.substring(0, 50)}..."` : 'empty');
            
            if (transcription && transcription.trim()) {
                // Add user response to conversation
                conversationManager?.addUserResponse(transcription);
                toast.success('Response captured!');
                
                // Update conversation in database
                try {
                    await updateConversation({
                        recordId: interviewData!._id,
                        conversation: conversationManager?.getConversation() || [],
                        currentQuestionIndex: conversationManager?.getCurrentQuestionIndex() || 0
                    });
                } catch (dbErr) {
                    console.error('Database update error (non-blocking):', dbErr);
                }

                // Add natural transition phrase before moving to next question
                const transitionPhrase = "Okay, let's proceed to the next question.";
                await speakText(transitionPhrase, async () => {
                    // Ask next question with additional transition
                    await askNextQuestion(true);
                    setIsProcessing(false);
                    setIsStopping(false);
                });
            } else {
                console.warn('stopRecording: no transcription, restarting recording');
                setIsProcessing(false);
                setIsStopping(false);
                toast.warning('No speech detected. Please try again.');
                // Restart recording if no speech detected
                if (conversationManager?.isWaitingForResponse()) {
                    setTimeout(async () => {
                        await startRecording();
                        setupResponseTimeout();
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('Error stopping recording:', error);
            setIsRecording(false); // Ensure state is reset on error
            setIsProcessing(false);
            setIsStopping(false);
            
            // If transcription fails due to quota, offer text input fallback
            if (error instanceof Error && error.message === 'OpenAI quota exceeded') {
                toast.error('Speech-to-text unavailable. Please type your response instead.');
                setShowTextInput(true);
            } else if (error instanceof Error && error.message === 'Empty audio recording') {
                toast.error('No audio captured. Please try speaking again.');
                // Retry recording
                if (conversationManager?.isWaitingForResponse()) {
                    setTimeout(async () => {
                        await startRecording();
                        setupResponseTimeout();
                    }, 1000);
                }
            } else if (error instanceof Error && error.message.includes('Recording too short')) {
                toast.error('Recording was too short. Please speak for at least 1 second.');
                setIsProcessing(false);
                setIsStopping(false);
                // Retry recording
                if (conversationManager?.isWaitingForResponse()) {
                    setTimeout(async () => {
                        await startRecording();
                        setupResponseTimeout();
                    }, 1000);
                }
            } else if (error instanceof Error && error.message.includes('corrupted')) {
                toast.error('Audio recording corrupted. Please try again.');
                setIsProcessing(false);
                setIsStopping(false);
                // Retry recording
                if (conversationManager?.isWaitingForResponse()) {
                    setTimeout(async () => {
                        await startRecording();
                        setupResponseTimeout();
                    }, 1000);
                }
            } else {
                toast.error('Failed to process recording');
                // Retry recording if still waiting for response
                if (conversationManager?.isWaitingForResponse()) {
                    setTimeout(async () => {
                        await startRecording();
                        setupResponseTimeout();
                    }, 2000);
                }
            }
        }
    };

    const submitTextResponse = async () => {
        try {
            if (!textResponse.trim()) {
                toast.error('Please enter your response');
                return;
            }

            // Clear timeouts
            if (promptTimeoutRef.current) {
                clearTimeout(promptTimeoutRef.current);
                promptTimeoutRef.current = null;
            }
            if (responseTimeoutRef.current) {
                clearTimeout(responseTimeoutRef.current);
                responseTimeoutRef.current = null;
            }

            // Add user response to conversation
            conversationManager?.addUserResponse(textResponse.trim());

            // Update conversation in database
            await updateConversation({
                recordId: interviewData!._id,
                conversation: conversationManager?.getConversation() || [],
                currentQuestionIndex: conversationManager?.getCurrentQuestionIndex() || 0
            });

            // Clear text input and hide it
            const responseText = textResponse.trim();
            setTextResponse('');
            setShowTextInput(false);

            // Ask next question with transition
            await askNextQuestion(true);
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

            // Set first question to trigger Realtime component display
            const firstQuestion = await conversationManager?.askNextQuestion();
            if (firstQuestion) {
                setCurrentQuestion(firstQuestion);
            }
            
            toast.success('Interview started! Connect to begin.');
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
            
            // Disconnect Realtime WebRTC if connected
            if (realtimeClientRef.current) {
                try {
                    realtimeClientRef.current.disconnect();
                } catch (err) {
                    console.error('Error disconnecting Realtime client:', err);
                }
            }
            
            // Stop any playing audio
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }

            // Generate feedback
            const conversation = conversationManager?.getConversation() || [];
            
            if (conversation.length === 0) {
                toast.error('No conversation found to generate feedback');
                router.push('/dashboard');
                return;
            }
            
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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center py-8 px-4">
            <div className="max-w-3xl w-full">
                {/* Header */}
                <div className="text-center mb-12">
                    <motion.h1 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl font-bold text-gray-900 mb-4"
                    >
                        {interviewData?.jobTitle || 'AI Interview'}
                    </motion.h1>
                    <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-lg text-gray-600"
                    >
                        Connect to start your voice interview
                    </motion.p>
                </div>

                {/* Realtime Voice Component */}
                {currentQuestion && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <RealtimeVoice
                            ref={realtimeClientRef}
                            onTranscript={(transcript, role) => {
                                if (role === 'user') {
                                    // Accumulate user transcript
                                    userTranscriptBuffer.current += transcript;
                                    
                                    // Only process full sentences (when we get a pause or complete thought)
                                    if (transcript.includes('.') || transcript.includes('?') || transcript.includes('!')) {
                                        const fullResponse = userTranscriptBuffer.current.trim();
                                        conversationManager?.addUserResponse(fullResponse);
                                        
                                        // Check if user is ending the interview (only on complete sentences)
                                        const endPhrases = ['end the interview', 'finish the interview', "i'm done with the interview", "that's all for today", 'no more questions', 'end this interview'];
                                        const lowerResponse = fullResponse.toLowerCase();
                                        if (endPhrases.some(phrase => lowerResponse.includes(phrase))) {
                                            console.log('User indicated interview end:', fullResponse);
                                            setTimeout(() => endInterview(), 3000);
                                        }
                                        
                                        // Update Convex conversation
                                        updateConversation({
                                            recordId: interviewData!._id,
                                            conversation: conversationManager?.getConversation() || [],
                                            currentQuestionIndex: conversationManager?.getCurrentQuestionIndex() || 0
                                        });
                                        
                                        // Clear buffer after processing
                                        userTranscriptBuffer.current = '';
                                    }
                                } else if (role === 'assistant') {
                                    // Accumulate AI transcript
                                    assistantTranscriptBuffer.current += transcript;
                                    
                                    // Only process full sentences
                                    if (transcript.includes('.') || transcript.includes('?') || transcript.includes('!')) {
                                        const fullResponse = assistantTranscriptBuffer.current.trim();
                                        
                                        // Only save QUESTIONS to conversation history (not acknowledgments)
                                        // Check if this is an actual interview question (contains "?")
                                        if (fullResponse.includes('?')) {
                                            conversationManager?.getConversation().push({
                                                from: 'bot',
                                                text: fullResponse,
                                                timestamp: Date.now()
                                            });
                                        }
                                        
                                        // Check if AI is concluding the interview (only on complete sentences)
                                        const aiEndPhrases = ['this concludes our interview', 'that concludes our interview', 'this completes our interview', 'end of our interview', "we've completed the interview"];
                                        const lowerResponse = fullResponse.toLowerCase();
                                        if (aiEndPhrases.some(phrase => lowerResponse.includes(phrase))) {
                                            console.log('AI concluded the interview:', fullResponse);
                                            setTimeout(() => endInterview(), 5000);
                                        }
                                        
                                        // Clear buffer after processing
                                        assistantTranscriptBuffer.current = '';
                                    }
                                }
                            }}
                            instructions={`You are a professional interviewer conducting a live conversation for the role of ${interviewData?.jobTitle}.

GREETING (First thing you say):
Start with a warm, natural greeting. Choose ONE of these styles randomly:
- "Hi! Thanks for joining me today. I'm excited to learn more about you. Are you ready to get started?"
- "Hello! Great to meet you. I hope you're doing well today. Shall we begin the interview?"
- "Hey there! Thanks for taking the time to speak with me. Are you all set to dive in?"
- "Good to see you! I'm looking forward to our conversation. Ready when you are!"

Wait for their confirmation before asking the first question.

INTERVIEW QUESTIONS:
Once they're ready, ask the following questions one at a time, in order:
${interviewData?.interviewQuestions.map((q, i) => `   Q${i + 1}: "${q.question}"`).join('\n')}

GUIDELINES:
- After each question, pause and wait for the candidate to finish speaking
- When they finish, give a brief, natural acknowledgment like "Thanks for sharing that" or "I appreciate your answer"
- Keep your tone warm, confident, and conversational — like a real interviewer
- Don't skip or change the question order
- Continue until every question has been asked and answered
- When all questions are done, say exactly: "Thank you for your time today. This concludes our interview."
- Stay focused on the interview questions only`}
                        />
                    </motion.div>
                )}

                {/* Start Interview Button */}
                {!currentQuestion && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex justify-center"
                    >
                        <Button 
                            onClick={startInterviewSession}
                            disabled={loading}
                            size="lg"
                            className="bg-purple-600 hover:bg-purple-700 px-12 py-6 text-lg"
                        >
                            <Zap className="w-5 h-5 mr-2" />
                            {loading ? 'Starting...' : 'Start Interview'}
                        </Button>
                    </motion.div>
                )}
            </div>
        </div>
    )
}

export default StartInterview