import React from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

type Props = {
    feedbackInfo: FeedbackInfo
}

export type FeedbackInfo = {
    feedback: string,
    rating: number,
    suggestions: string[]
}

function FeedbackDialog({ feedbackInfo }: Props) {
    return (
        <Dialog>
            <DialogTrigger asChild><Button>Feedback</Button></DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className='font-bold text-2xl'>Interview Feedback</DialogTitle>
                    <DialogDescription>
                        <div>
                            <h2 className='font-bold text-xl text-black'>Feedback:</h2>
                            <p className='text-lg'>{feedbackInfo?.feedback}</p>
                            <div>
                                <h2 className='font-bold text-xl text-black mt-5'>Suggestion:</h2>

                                {feedbackInfo?.suggestions?.map((item, index) => (
                                    <h2 className='p-2 my-1 bg-gray-50  text-lg rounded-lg flex gap-2'> {item}</h2>
                                ))}
                            </div>
                            <h2 className='font-bold text-xl text-primary'>Rating: <span className='text-primary'>{feedbackInfo?.rating}</span> </h2>

                        </div>
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    )
}

export default FeedbackDialog