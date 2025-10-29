"use client"
import { api } from '@/convex/_generated/api';
import { useConvex } from 'convex/react';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Share, Star } from 'lucide-react';
import { ConversationMessage } from '@/app/utils/conversation-manager';
import { FeedbackInfo } from '@/app/(routes)/dashboard/_components/FeedbackDialog';

interface InterviewResults {
    _id: string;
    jobTitle: string | null;
    jobDescription: string | null;
    interviewQuestions: Array<{ question: string; answer: string }>;
    conversation: ConversationMessage[];
    feedback: FeedbackInfo;
    startedAt: number;
    completedAt: number;
    status: string;
}

function InterviewResults() {
    const { interviewId } = useParams();
    const convex = useConvex();
    const router = useRouter();
    const [interviewData, setInterviewData] = useState<InterviewResults | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchInterviewResults();
    }, [interviewId]);

    const fetchInterviewResults = async () => {
        try {
            const result = await convex.query(api.Interview.GetInterviewQuestions, {
                //@ts-ignore
                interviewRecordId: interviewId
            });
            console.log(result);
            //@ts-ignore
            setInterviewData(result);
        } catch (error) {
            console.error('Error fetching interview results:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDuration = (startTime: number, endTime: number) => {
        const durationMs = endTime - startTime;
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const exportResults = () => {
        if (!interviewData) return;

        const results = {
            interview: {
                title: interviewData.jobTitle || 'AI Interview',
                description: interviewData.jobDescription,
                duration: formatDuration(interviewData.startedAt, interviewData.completedAt),
                completedAt: new Date(interviewData.completedAt).toLocaleString()
            },
            conversation: interviewData.conversation,
            feedback: interviewData.feedback
        };

        const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `interview-results-${interviewId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const shareResults = async () => {
        if (!interviewData) return;

        const shareData = {
            title: `Interview Results - ${interviewData.jobTitle || 'AI Interview'}`,
            text: `Completed interview with ${interviewData.conversation.length} exchanges. Duration: ${formatDuration(interviewData.startedAt, interviewData.completedAt)}`,
            url: window.location.href
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (error) {
                console.log('Error sharing:', error);
            }
        } else {
            // Fallback: copy to clipboard
            await navigator.clipboard.writeText(window.location.href);
            alert('Interview link copied to clipboard!');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading interview results...</p>
                </div>
            </div>
        );
    }

    if (!interviewData) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Interview Not Found</h1>
                    <p className="text-gray-600 mb-6">The interview you're looking for doesn't exist or has been removed.</p>
                    <Button onClick={() => router.push('/dashboard')}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Dashboard
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg p-6 mb-8 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                Interview Results
                            </h1>
                            <h2 className="text-xl text-gray-700">
                                {interviewData.jobTitle || 'AI Interview'}
                            </h2>
                        </div>
                        <div className="flex space-x-2">
                            <Button onClick={exportResults} variant="outline">
                                <Download className="w-4 h-4 mr-2" />
                                Export
                            </Button>
                            <Button onClick={shareResults} variant="outline">
                                <Share className="w-4 h-4 mr-2" />
                                Share
                            </Button>
                            <Button onClick={() => router.push('/dashboard')}>
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Dashboard
                            </Button>
                        </div>
                    </div>

                    {/* Interview Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="font-semibold text-gray-700 mb-1">Duration</h3>
                            <p className="text-2xl font-bold text-blue-600">
                                {formatDuration(interviewData.startedAt, interviewData.completedAt)}
                            </p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="font-semibold text-gray-700 mb-1">Questions</h3>
                            <p className="text-2xl font-bold text-green-600">
                                {interviewData.interviewQuestions.length}
                            </p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="font-semibold text-gray-700 mb-1">Completed</h3>
                            <p className="text-sm text-gray-600">
                                {new Date(interviewData.completedAt).toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {interviewData.jobDescription && (
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <h3 className="font-semibold text-blue-900 mb-2">Job Description</h3>
                            <p className="text-blue-800">{interviewData.jobDescription}</p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Conversation History */}
                    <div className="bg-white rounded-lg p-6 shadow-sm">
                        <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                            <Star className="w-5 h-5 mr-2 text-yellow-500" />
                            Conversation History
                        </h3>
                        <div className="space-y-4 max-h-96 overflow-y-auto">
                            {interviewData.conversation.map((message, index) => (
                                <div 
                                    key={index} 
                                    className={`p-4 rounded-lg ${
                                        message.from === 'bot' 
                                            ? 'bg-blue-50 border-l-4 border-blue-400' 
                                            : 'bg-green-50 border-l-4 border-green-400'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-medium text-sm text-gray-600">
                                            {message.from === 'bot' ? 'Interviewer' : 'You'}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {new Date(message.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <p className="text-gray-800 leading-relaxed">{message.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Feedback */}
                    <div className="bg-white rounded-lg p-6 shadow-sm">
                        <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                            <Star className="w-5 h-5 mr-2 text-purple-500" />
                            Interview Feedback
                        </h3>
                        {interviewData.feedback ? (
                            <div className="space-y-4">
                                {typeof interviewData.feedback === 'string' ? (
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        <pre className="whitespace-pre-wrap text-gray-800 text-sm">
                                            {interviewData.feedback}
                                        </pre>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {Object.entries(interviewData.feedback).map(([key, value]) => (
                                            <div key={key} className="bg-gray-50 p-3 rounded-lg">
                                                <h4 className="font-semibold text-gray-700 capitalize mb-1">
                                                    {key.replace(/([A-Z])/g, ' $1').trim()}
                                                </h4>
                                                <p className="text-gray-600 text-sm">
                                                    {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <p>No feedback available yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Questions Asked */}
                <div className="bg-white rounded-lg p-6 mt-8 shadow-sm">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Questions Asked</h3>
                    <div className="space-y-3">
                        {interviewData.interviewQuestions.map((question, index) => (
                            <div key={index} className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-medium text-gray-800 mb-2">
                                    Question {index + 1}
                                </h4>
                                <p className="text-gray-700">{question.question}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default InterviewResults;





