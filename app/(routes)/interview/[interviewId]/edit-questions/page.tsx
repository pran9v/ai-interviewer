"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useConvex } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel'
import { useUser } from '@clerk/nextjs';
import { toast } from 'sonner';

interface InterviewQuestion {
  question: string;
  answer?: string;
}

function EditQuestionsPage() {
  const { interviewId } = useParams();
  const id = Array.isArray(interviewId) ? interviewId[0] : interviewId;
  const convex = useConvex();
  const router = useRouter();
  const { user } = useUser();

  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [originalQuestions, setOriginalQuestions] = useState<InterviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

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

        if (!result) {
          setError('Interview not found');
          return;
        }

        const normalizedQuestions = (result.interviewQuestions || []).map((q: any) => {
          if (typeof q === 'string') {
            return { question: q };
          } else if (typeof q === 'object' && q.question) {
            return { question: q.question, answer: q.answer };
          }
          return { question: '' };
        });

    setQuestions(normalizedQuestions);
    setOriginalQuestions(normalizedQuestions);
    // Ownership removed: allow editing by any logged-in user. No owner check performed here.
      } catch (e) {
        console.error('Error loading interview:', e);
        setError('Could not load interview data. Please try again.');
      }
      setLoading(false);
    })();
  }, [id, user]);

  // Track changes
  useEffect(() => {
    const hasChanges = JSON.stringify(questions) !== JSON.stringify(originalQuestions);
    setHasChanges(hasChanges);
  }, [questions, originalQuestions]);

  const handleQuestionChange = (idx: number, val: string) => {
    setQuestions(qs => qs.map((q, i) => 
      i === idx ? { ...q, question: val } : q
    ));
  };

  const handleAdd = () => {
    setQuestions(qs => [...qs, { question: '', answer: '' }]);
  };

  const handleDelete = (idx: number) => {
    setQuestions(qs => qs.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    // Validate questions
    const emptyQuestions = questions.some(q => !q.question.trim());
    if (emptyQuestions) {
      setError('Please fill in all questions before saving.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await convex.mutation(api.Interview.UpdateInterviewQuestions, {
        recordId: id as Id<'InterviewSessionTable'>,
        questions: questions.map(q => ({
          question: q.question.trim(),
          answer: q.answer?.trim() || ''
        }))
      });
      setOriginalQuestions(questions);
      toast.success('Questions saved successfully');
    } catch (e: any) {
      console.error('Error saving questions:', e);
      // Try to extract useful info from the error
      const message = e?.message || (typeof e === 'string' ? e : JSON.stringify(e));
      const details = e?.response?.data ?? e?.details ?? null;
      const display = details ? `${message} - ${JSON.stringify(details)}` : message;

      // Detect common Convex deployment error and provide actionable guidance
      if (message && message.includes("Could not find public function")) {
        const guidance = `Convex backend function missing. This usually means the Convex functions haven't been deployed or the generated API is out of date. Run \`npx convex deploy\` (for production) or \`npx convex dev\` (for local development) in your convex/ directory and redeploy. See https://docs.convex.dev for details.`;
        setError(`Could not save questions. ${display}. ${guidance}`);
        try { toast.error('Convex function missing — check server logs. See console for full message.'); } catch (_) {}
      } else {
        setError(`Could not save questions. ${display}`);
        try { toast.error(`Save failed: ${message}`); } catch (_) {}
      }
    }
    setSaving(false);
  };

  if (loading) return <div className="p-10 text-center"><div className="animate-pulse w-8 h-8 bg-gray-200 rounded-full mx-auto mb-4" /><div>Loading...</div></div>;

  return (
    <div className="max-w-4xl mx-auto my-10 p-8 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Edit Interview Questions</h2>
        <div className="text-sm text-gray-500">
          {questions.length} {questions.length === 1 ? 'question' : 'questions'}
        </div>
      </div>

      {/* Instructions */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Instructions</h3>
        <ul className="list-disc list-inside text-blue-800 space-y-1">
          <li>Review and edit the generated interview questions</li>
          <li>Add new questions or remove existing ones</li>
          <li>All questions must be filled before saving</li>
          <li>Changes are not saved until you click "Save Changes"</li>
        </ul>
      </div>

      {/* Questions List */}
      <div className="space-y-4 mb-8">
        {questions.map((q, idx) => (
          <div 
            className="p-4 bg-gray-50 rounded-lg border border-gray-200 transition-all hover:shadow-md" 
            key={idx}
          >
            <div className="flex items-start gap-4">
              <span className="text-gray-500 mt-2">#{idx + 1}</span>
              <div className="flex-1 space-y-2">
                <Input
                  className="w-full font-medium"
                  value={q.question}
                  onChange={e => handleQuestionChange(idx, e.target.value)}
                  placeholder="Enter interview question"
                />
              </div>
              <Button 
                variant="destructive" 
                onClick={() => handleDelete(idx)}
                className="hover:bg-red-600"
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t pt-6">
        <div className="flex gap-4">
          <Button
            onClick={handleAdd}
            variant="outline"
            className="flex items-center gap-2"
          >
            <span>Add Question</span>
          </Button>
        </div>
        <div className="flex gap-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? "Saving..." : hasChanges ? "Save Changes" : "No Changes"}
          </Button>
          {/* Proceed to Start Interview; require saving first to ensure edits are persisted */}
          <Button
            onClick={() => router.push(`/interview/${id}/start`)}
            disabled={hasChanges || saving}
            variant="outline"
          >
            {hasChanges ? 'Save before starting' : 'Proceed to Start Interview'}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Warning for unsaved changes */}
      {hasChanges && !saving && (
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-700">
            You have unsaved changes. Make sure to click "Save Changes" before leaving.
          </p>
        </div>
      )}
    </div>
  );
}
export default EditQuestionsPage;
