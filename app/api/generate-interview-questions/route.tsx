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
        // Arcjet can throw during protect (misconfigured key or network issues). Don't let the whole route crash.
        let decision: any = null;
        try {
            decision = await aj.protect(req, { userId: user?.primaryEmailAddress?.emailAddress ?? '', requested: 5 }); // Deduct 5 tokens from the bucket
            console.log("Arcjet decision", decision);
        } catch (e: any) {
            // Log and continue. We treat failure to consult Arcjet as a non-fatal condition so the generation still runs.
            console.error('Arcjet protect failed:', e?.message || e);
            decision = null;
        }

        const isSubscribedUser = has({ plan: 'pro' })
        //@ts-ignore
        if (decision?.reason?.remaining == 0 && !isSubscribedUser) {
            return NextResponse.json({
                status: 429,
                result: 'No free credit remaining, Try again after 24 Hours'
            })
        }

        // Call n8n Webhook with jobTitle only
        // Call the external generation webhook with a small retry loop for transient network issues.
        const payload: any = { jobTitle };
        if (jobDescription) payload.jobDescription = jobDescription;

        const webhookUrl = 'https://n8n.srv629238.hstgr.cloud/webhook/generate-interview-question';
        let lastError: any = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const result = await axios.post(webhookUrl, payload, { timeout: 20000 });
                console.log('n8n webhook response:', result.status, result.data);

                const questions = result.data?.message?.content?.questions || result.data?.message?.content?.interview_questions || result.data?.questions;
                if (!questions) {
                    console.warn('Webhook did not return questions, payload:', result.data);
                    return NextResponse.json({ error: 'No questions returned from generation service', details: result.data }, { status: 502 });
                }

                return NextResponse.json({ questions, status: 200 });
            } catch (err: any) {
                lastError = err;
                console.error(`Attempt ${attempt + 1} - Error calling generation webhook:`, err?.response?.status, err?.response?.data || err?.message || err);
                // small backoff before retrying
                if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
            }
        }

        // After retries, return a clear diagnostic payload.
        if (lastError) {
            // If axios couldn't reach the host, err.response will be undefined.
            if (lastError.isAxiosError && !lastError.response) {
                console.error('Generation webhook appears unreachable:', lastError.message);
                return NextResponse.json({ error: 'Generation service unreachable', details: { message: lastError.message, webhookUrl } }, { status: 502 });
            }

            const status = lastError?.response?.status || 502;
            const details = lastError?.response?.data || { message: lastError?.message };
            return NextResponse.json({ error: 'Generation service failed', details }, { status });
        }

    } catch (error: any) {
        console.error('Generate questions error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}