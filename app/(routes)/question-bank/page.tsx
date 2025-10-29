"use client"
import React, { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Question = {
    question: string;
    answer: string;
};

export default function QuestionBank() {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editedQuestion, setEditedQuestion] = useState<Question | null>(null);

    // Convex query to get saved questions
    const savedQuestions = useQuery(api.Interview.GetSavedQuestions);
    const saveQuestion = useMutation(api.Interview.SaveQuestionToBank);
    const updateQuestion = useMutation(api.Interview.UpdateQuestionInBank);
    const deleteQuestion = useMutation(api.Interview.DeleteQuestionFromBank);

    useEffect(() => {
        if (savedQuestions) {
            setQuestions(savedQuestions);
        }
    }, [savedQuestions]);

    const handleEdit = (index: number) => {
        setEditingIndex(index);
        setEditedQuestion(questions[index]);
    };

    const handleSave = async (index: number) => {
        if (!editedQuestion) return;

        try {
            await updateQuestion({
                questionId: savedQuestions[index]._id,
                question: editedQuestion.question,
                answer: editedQuestion.answer
            });
            
            toast.success('Question updated successfully');
            setEditingIndex(null);
            setEditedQuestion(null);
        } catch (error) {
            toast.error('Failed to update question');
            console.error('Error updating question:', error);
        }
    };

    const handleDelete = async (index: number) => {
        try {
            await deleteQuestion({
                questionId: savedQuestions[index]._id
            });
            toast.success('Question deleted successfully');
        } catch (error) {
            toast.error('Failed to delete question');
            console.error('Error deleting question:', error);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">Question Bank</h1>
            <div className="space-y-6">
                {questions.map((q, index) => (
                    <div key={index} className="bg-white p-6 rounded-lg shadow-md">
                        {editingIndex === index ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Question
                                    </label>
                                    <textarea
                                        className="w-full p-2 border rounded-md"
                                        value={editedQuestion?.question || ''}
                                        onChange={(e) => setEditedQuestion(prev => ({ 
                                            ...prev!,
                                            question: e.target.value
                                        }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Answer Guidelines
                                    </label>
                                    <textarea
                                        className="w-full p-2 border rounded-md"
                                        value={editedQuestion?.answer || ''}
                                        onChange={(e) => setEditedQuestion(prev => ({
                                            ...prev!,
                                            answer: e.target.value
                                        }))}
                                    />
                                </div>
                                <div className="flex space-x-4">
                                    <Button onClick={() => handleSave(index)}>
                                        Save Changes
                                    </Button>
                                    <Button 
                                        variant="ghost"
                                        onClick={() => {
                                            setEditingIndex(null);
                                            setEditedQuestion(null);
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <h3 className="text-lg font-semibold mb-2">{q.question}</h3>
                                <p className="text-gray-600 mb-4">{q.answer}</p>
                                <div className="flex space-x-4">
                                    <Button 
                                        variant="outline"
                                        onClick={() => handleEdit(index)}
                                    >
                                        Edit
                                    </Button>
                                    <Button 
                                        variant="destructive"
                                        onClick={() => handleDelete(index)}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}