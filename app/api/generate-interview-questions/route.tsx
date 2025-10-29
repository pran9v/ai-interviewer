import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { aj } from "@/utils/arcjet";
import { auth, currentUser } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
    try {
        const user = await currentUser();
    const body = await req.json();
    const jobTitle = (body.jobTitle as string | undefined) ?? (body?.title as string | undefined);
    const jobDescription = (body.jobDescription as string | undefined) ?? (body?.description as string | undefined) ?? null;

        console.log('generate-interview-questions called by', user?.primaryEmailAddress?.emailAddress, 'body:', body);

        if (!jobTitle || !jobTitle.trim()) {
            console.warn('generate-interview-questions: missing jobTitle');
            return NextResponse.json({ error: 'Missing jobTitle' }, { status: 400 });
        }

        const { has } = await auth();
        const decision = await aj.protect(req, { userId: user?.primaryEmailAddress?.emailAddress ?? '', requested: 5 }); // Deduct 5 tokens from the bucket
        console.log("Arcjet decision", decision);
        const isSubscribedUser = has({ plan: 'pro' })
        //@ts-ignore
        if (decision?.reason?.remaining == 0 && !isSubscribedUser) {
            return NextResponse.json({
                status: 429,
                result: 'No free credit remaining, Try again after 24 Hours'
            })
        }

        // Call n8n Webhook with jobTitle only
        try {
            const payload: any = { jobTitle };
            if (jobDescription) payload.jobDescription = jobDescription;

            const result = await axios.post('https://n8n.srv629238.hstgr.cloud/webhook/generate-interview-question', payload, { timeout: 20000 });

            console.log('n8n webhook response:', result.status, result.data);

            const questions = result.data?.message?.content?.questions || result.data?.message?.content?.interview_questions || result.data?.questions;

            if (!questions) {
                console.warn('Webhook did not return questions, payload:', result.data);
                return NextResponse.json({ error: 'No questions returned from generation service', details: result.data }, { status: 502 });
            }

            return NextResponse.json({ questions, status: 200 });
        } catch (err: any) {
            console.error('Error calling generation webhook:', err?.response?.status, err?.response?.data || err.message);
            const status = err?.response?.status || 502;
            const details = err?.response?.data || { message: err?.message };
            return NextResponse.json({ error: 'Generation service failed', details }, { status });
        }

    } catch (error: any) {
        console.error('Generate questions error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}