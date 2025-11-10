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
import { Textarea } from '@/components/ui/textarea'
import axios from 'axios'
import { Loader2Icon } from 'lucide-react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { UserDetailContext } from '@/context/UserDetailContext'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useUser } from '@clerk/nextjs'

function CreateInterviewDialog() {

    const programTypes = [
        'Undergraduate',
        'Graduate',
        'Post doctorate',
        'Masters',
        'Diploma'
    ];

    const [formData, setFormData] = useState<any>({ 
        programType: programTypes[0], 
        courseTitle: '',
        courseDescription: ''
    });
    const [loading, setLoading] = useState(false);
    const { userDetail, setUserDetail } = useContext(UserDetailContext);
    const { user } = useUser(); // Add Clerk user hook
    const saveInterviewQuestion = useMutation(api.Interview.SaveInterviewQuestion);
    const CreateUser = useMutation(api.users.CreateNewUser); // Add CreateUser mutation
    const router = useRouter();
    
    const onHandleInputChange = (field: string, value: string) => {
        setFormData((prev: any) => ({
            ...prev,
            [field]: value
        }))
    }

    const onSubmit = async () => {
        if (!formData.courseTitle || !formData.courseTitle.trim()) {
            toast.error('Please enter a course title');
            return;
        }

        setLoading(true);
        try {
            // Ensure user exists in database before creating interview
            let userId = userDetail?._id;
            
            if (!userId && user) {
                console.log('User detail not found, creating user in database...');
                try {
                    const result = await CreateUser({
                        email: user.primaryEmailAddress?.emailAddress ?? '',
                        imageUrl: user.imageUrl,
                        name: user.fullName ?? ''
                    });
                    setUserDetail(result);
                    // Handle both return types from CreateNewUser mutation
                    userId = (result as any)._id || (result as any).result;
                    console.log('User created successfully:', userId);
                } catch (error) {
                    console.error('Error creating user:', error);
                    toast.error('Failed to initialize user profile. Please refresh the page.');
                    setLoading(false);
                    return;
                }
            }

            if (!userId) {
                toast.error('User session not found. Please sign in again.');
                setLoading(false);
                return;
            }

            const res = await axios.post('/api/generate-interview-questions', { 
                programType: formData.programType,
                courseTitle: formData.courseTitle,
                courseDescription: formData.courseDescription
            });
            console.log('API Response:', res.data);

            if (res?.data?.status === 429) {
                toast.warning(res.data.result);
                setLoading(false);
                return;
            }

            if (!res.data?.questions) {
                toast.error('No questions generated. Please try again.');
                setLoading(false);
                return;
            }

            // Save to Database
            const interviewId = await saveInterviewQuestion({
                questions: res.data.questions,
                resumeUrl: undefined,
                uid: userId as any,
                jobTitle: `${formData.programType} - ${formData.courseTitle}`, // Store combined for display
                jobDescription: formData.courseDescription || undefined
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
                        <div className="w-full mt-4 space-y-4">
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-700">Program Type</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.programType}
                                    onChange={(e) => onHandleInputChange('programType', e.target.value)}
                                >
                                    {programTypes.map((type) => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-700">Course Title</label>
                                <Input
                                    placeholder="Enter course title (e.g. Computer Science)"
                                    value={formData.courseTitle}
                                    onChange={(e) => onHandleInputChange('courseTitle', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-700">Course Description</label>
                                <Textarea
                                    placeholder="Enter or paste the course description"
                                    value={formData.courseDescription}
                                    onChange={(e) => onHandleInputChange('courseDescription', e.target.value)}
                                    className="h-[160px]"
                                />
                            </div>
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