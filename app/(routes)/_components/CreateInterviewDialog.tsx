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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ResumeUpload from './ResumeUpload'
import JobDescription from './JobDescription'
import axios from 'axios'
import { Loader2Icon } from 'lucide-react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { UserDetailContext } from '@/context/UserDetailContext'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
function CreateInterviewDialog() {

    const [formData, setFormData] = useState<any>();
    const [file, setFile] = useState<File | null>();
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

        setLoading(true);
        const formData_ = new FormData();
        formData_.append('file', file ?? '');
        formData_?.append('jobTitle', formData?.jobTitle)
        formData_?.append('jobDescription', formData?.jobDescription)

        try {
            const res = await axios.post('api/generate-interview-questions', formData_);
            console.log(res.data);

            if (res?.data?.status == 429) {
                toast.warning(res?.data?.result)
                console.log(res?.data?.result);
                return;
            }

            //Save to Database
            //@ts-ignore
            const interviewId = await saveInterviewQuestion({
                questions: res.data?.questions,
                resumeUrl: res?.data.resumeUrl ?? '',
                uid: userDetail?._id,
                jobTitle: formData?.jobTitle ?? '',
                jobDescription: formData?.jobDescription ?? ''
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

        } catch (e) {
            console.log(e);
        }
        finally {
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
                        <Tabs defaultValue="resume-upload" className="w-full mt-5">
                            <TabsList>
                                <TabsTrigger value="resume-upload">Resume Upload</TabsTrigger>
                                <TabsTrigger value="job-description">Job Description</TabsTrigger>
                            </TabsList>
                            <TabsContent value="resume-upload"><ResumeUpload setFiles={(file: any) => setFile(file)} /></TabsContent>
                            <TabsContent value="job-description"><JobDescription onHandleInputChange={onHandleInputChange} /></TabsContent>
                        </Tabs>
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