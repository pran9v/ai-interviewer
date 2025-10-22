"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useConvex } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel'

function EditQuestionsPage() {
  const { interviewId } = useParams();
  const id = Array.isArray(interviewId) ? interviewId[0] : interviewId;
  const convex = useConvex();
  const router = useRouter();

  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isInterviewer, setIsInterviewer] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    // Fetch the interview data (and do a simple role check)
    (async () => {
      setLoading(true);
      setError('');
      try {
        const result = await convex.query(api.Interview.GetInterviewQuestions, {
          interviewRecordId: id as Id<'InterviewSessionTable'>
        });
        setQuestions(
          ((result?.interviewQuestions || []) as Array<{ question: string } | string>).map(
            (q) => (typeof q === 'string' ? q : q.question)
          )
        );
        // Basic interviewer check: current user === interviewData.userId (add your own method)
        const currentUser = await convex.session.getCurrentUser?.();
        setIsInterviewer(currentUser && result?.userId && currentUser._id === result.userId);
      } catch (e) {
        setError('Could not load interview data.');
      }
      setLoading(false);
    })();
  }, [id]);

  const handleQuestionChange = (idx: number, val: string) => {
    setQuestions(qs => qs.map((q, i) => i === idx ? val : q));
  };
  const handleAdd = () => setQuestions(qs => [...qs, ""]);
  const handleDelete = (idx: number) => setQuestions(qs => qs.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await convex.mutation(api.Interview.UpdateInterviewQuestions, {
        recordId: id as Id<'InterviewSessionTable'>,
        questions: questions.filter(q => q).map(q => ({ question: q }))
      });
    } catch (e) {
      setError('Could not save questions.');
    }
    setSaving(false);
  };

  if (loading) return <div className="p-10 text-center"><div className="animate-pulse w-8 h-8 bg-gray-200 rounded-full mx-auto mb-4" /><div>Loading...</div></div>;
  if (!isInterviewer) return <div className="p-8 text-center">Access denied: you are not the interviewer for this session.</div>;

  return (
    <div className="max-w-3xl mx-auto my-10 p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-6">Edit Interview Questions</h2>
      {questions.map((q, idx) => (
        <div className="flex items-center gap-2 my-2" key={idx}>
          <Input
            className="flex-1"
            value={q}
            onChange={e => handleQuestionChange(idx, e.target.value)}
          />
          <Button variant="destructive" onClick={() => handleDelete(idx)}>Delete</Button>
        </div>
      ))}
      <div className="flex gap-4 mt-6">
        <Button onClick={handleAdd} variant="outline">Add Question</Button>
        <Button onClick={handleSave} loading={saving} disabled={saving}>Save All</Button>
        <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
      </div>
      {error && <div className="mt-4 text-red-600">{error}</div>}
    </div>
  );
}
export default EditQuestionsPage;
