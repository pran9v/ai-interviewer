import React, { useContext, useState } from 'react'
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import axios from 'axios'
import { Loader2Icon } from 'lucide-react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { UserDetailContext } from '@/context/UserDetailContext'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
function CreateInterviewDialog() {

    const [formData, setFormData] = useState<any>({ jobTitle: '' });
    const [loading, setLoading] = useState(false);
    const { userDetail, setUserDetail } = useContext(UserDetailContext);
    const saveInterviewQuestion = useMutation(api.Interview.SaveInterviewQuestion)
    const router = useRouter();
    const onHandleInputChange = (field: string, value: string) => {
        setFormData((prev: any) => ({
            ...prev,
            [field]: value
        }))
    }

    const onSubmit = async () => {
        if (!formData.jobTitle || !formData.jobTitle.trim()) {
            toast.error('Please enter a job title');
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post('/api/generate-interview-questions', { jobTitle: formData.jobTitle });
            console.log('API Response:', res.data);

            if (res?.data?.status === 429) {
                toast.warning(res.data.result);
                return;
            }

            if (!res.data?.questions) {
                toast.error('No questions generated. Please try again.');
                return;
            }

            if (!userDetail?._id) {
                toast.error('User session not found');
                return;
            }

            // Save to Database
            const interviewId = await saveInterviewQuestion({
                questions: res.data.questions,
                resumeUrl: undefined,
                uid: userDetail._id as any,
                jobTitle: formData.jobTitle,
                jobDescription: undefined
            });

                        // Normalize returned id (Convex can return different shapes).
                        // Common return shapes: string id, object with _id field, or the full record.
                        let newId: string | undefined;
                        try {
                            if (!interviewId) throw new Error('No interview id returned');
                            if (typeof interviewId === 'string') {
                                newId = interviewId;
                            } else if (typeof interviewId === 'object') {
                                // inserted record may be returned or { _id: 'abc' }
                                // handle nested structures conservatively
                                // try common properties
                                // @ts-ignore
                                newId = interviewId._id || interviewId.id || interviewId.value || undefined;
                                // If the result was the full inserted document, Convex may return the id as a string inside
                                if (!newId) {
                                    // try JSON stringification fallback
                                    newId = (interviewId as any).toString?.();
                                }
                            }

                            if (!newId) {
                                console.error('Could not determine interview id from mutation result:', interviewId);
                                toast.error('Failed to create interview (invalid id). Please try again.');
                                return;
                            }

                            // After creating the interview, send the user to the edit-questions screen
                            // so an admin/interviewer can review generated questions before starting.
                            console.log('Interview created, navigating to edit-questions for id:', newId);
                            router.push(`/interview/${newId}/edit-questions`);
                        } catch (err) {
                            console.error('Error handling interview id:', err);
                            toast.error('Failed to create interview. Please try again.');
                        }

        } catch (error) {
            console.error('Error in interview creation:', error);
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 429) {
                    toast.error('Rate limit exceeded. Please try again later.');
                } else {
                    toast.error(error.response?.data?.message || 'Failed to generate interview questions');
                }
            } else {
                toast.error('Could not save questions. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    }


    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button type="button">+ Create Interview</Button>
            </DialogTrigger>
            <DialogContent className='min-w-3xl'>
                <DialogHeader>
                    <DialogTitle>Please submit following details.</DialogTitle>
                    <DialogDescription>
                        <div className="w-full mt-4">
                            <label className="block mb-2 text-sm font-medium text-gray-700">Job Title</label>
                            <Input
                                placeholder="Enter job title (e.g. Software Engineer)"
                                value={formData.jobTitle}
                                onChange={(e) => onHandleInputChange('jobTitle', e.target.value)}
                            />
                        </div>
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className='flex gap-6'>
                    <DialogClose asChild>
                        <Button variant={'ghost'}>
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button onClick={onSubmit} disabled={loading}>
                        {loading && <Loader2Icon className='animate-spin' />} Submit</Button>
                </DialogFooter>
            </DialogContent>

        </Dialog>
    )
}

export default CreateInterviewDialog