import React from 'react'
import { InterviewData } from '../../interview/[interviewId]/start/page'
import { Badge } from "@/components/ui/badge"
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import FeedbackDialog from './FeedbackDialog'
type props = {
    interviewInfo: InterviewData
}
function InterviewCard({ interviewInfo }: props) {
    return (
        <div className='p-4 border rounded-xl'>
            <h2 className='font-semibold text-xl flex justify-between items-center'>{interviewInfo?.resumeUrl ? 'Resume Interview' : interviewInfo.jobTitle}
                <Badge >{interviewInfo?.status}</Badge>
            </h2>
            <p className='line-clamp-2 text-gray-500'>{interviewInfo?.resumeUrl ? 'We generated Interview from the uploaded resume.' : interviewInfo.jobDescription}</p>

            <div className='mt-5 flex justify-between items-center'>
                {interviewInfo?.feedback && <FeedbackDialog feedbackInfo={interviewInfo.feedback} />}
                <Link href={'/interview/' + interviewInfo?._id}>
                    <Button className='' variant={'outline'}>Start Interview <ArrowRight /></Button>
                </Link>
            </div>
        </div>
    )
}

export default InterviewCard