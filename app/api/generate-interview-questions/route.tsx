import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { aj } from "@/utils/arcjet";
import { auth, currentUser } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
    try {
        const user = await currentUser();
        const body = await req.json();
        const programType = body.programType as string;
        const courseTitle = body.courseTitle as string;
        const courseDescription = body.courseDescription as string | undefined;

        console.log('generate-interview-questions called by', user?.primaryEmailAddress?.emailAddress, 'body:', body);

        if (!courseTitle?.trim() || !programType?.trim()) {
            console.warn('generate-interview-questions: missing required fields');
            return NextResponse.json({ error: 'Missing course title or program type' }, { status: 400 });
        }

        console.log('Starting question generation for:', {
            programType,
            courseTitle,
            courseDescription,
            user: user?.primaryEmailAddress?.emailAddress
        });

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

        // Prepare payload for n8n webhook
        const prompt = `You are a part of graduation admissions committee at a leading university in the US. The university is looking for prospective international students to join your courses. You are tasked to have a f2f interview with each of the students and then come up with your recommendations.

Please generate a set of interview questions for a ${programType} program in ${courseTitle}${courseDescription ? `. The program focuses on: ${courseDescription}` : ''}.

The questions should:
1. Assess academic background and preparation
2. Evaluate research interests and goals
3. Understand motivation for the specific program
4. Gauge practical experience and skills
5. Test critical thinking and problem-solving
6. Explore cultural fit and adaptability

Format your response as a JSON array of question objects with 'question' and 'answer' fields. The 'answer' field should contain guidelines for evaluating responses.`;

        // Format payload to match what n8n expects
        const payload = {
            message: {
                role: "user",
                content: prompt
            },
            model: "gpt-4",  // Request GPT-4 from n8n for better results
            temperature: 0.7,
            format: "json"  // Request JSON format explicitly
        };
        console.log('Sending payload to n8n:', payload);

        const webhookUrl = 'https://n8n.srv629238.hstgr.cloud/webhook/generate-interview-question';
        let lastError: any = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const result = await axios.post(webhookUrl, payload, { timeout: 30000 }); // Increase timeout
                console.log('n8n webhook response:', result.status, result.data);
                
                if (!result.data) {
                    throw new Error('Empty response from n8n webhook');
                }

                console.log('Raw n8n response:', JSON.stringify(result.data, null, 2));
                
                // Try to parse the response content if it's a string
                let parsedContent;
                if (typeof result.data?.message?.content === 'string') {
                    try {
                        parsedContent = JSON.parse(result.data.message.content);
                    } catch (e) {
                        console.warn('Failed to parse string content:', e);
                    }
                }
                
                // Try multiple paths where questions might be in the response
                const questions = result.data?.message?.content?.questions || // Object path
                                result.data?.message?.content?.interview_questions || // Alternative path
                                result.data?.questions || // Direct path
                                parsedContent?.questions || // Parsed content
                                (Array.isArray(parsedContent) ? parsedContent : null); // Direct array
                
                if (!questions || !Array.isArray(questions)) {
                    console.warn('Webhook response contained no valid questions array. Response:', JSON.stringify(result.data, null, 2));
                    throw new Error('No valid questions array in response');
                }
                
                // Validate question format
                const validatedQuestions = questions.filter(q => 
                    typeof q === 'object' && q !== null && 
                    typeof q.question === 'string' && 
                    typeof q.answer === 'string'
                );
                
                if (validatedQuestions.length === 0) {
                    throw new Error('No properly formatted questions in response');
                }

                return NextResponse.json({ questions, status: 200 });
            } catch (err: any) {
                lastError = err;
                console.error(`Attempt ${attempt + 1} - Error calling generation webhook:`, err?.response?.status, err?.response?.data || err?.message || err);
                // small backoff before retrying
                if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
            }
        }

        // After retries, try the OpenAI fallback
        if (lastError) {
            console.log('n8n webhook failed after retries, falling back to OpenAI generation');
            
            try {
                console.log('Calling OpenAI fallback with:', { programType, courseTitle, courseDescription });
                // Call our fallback route
                const fallbackResponse = await fetch(new URL('/api/generate-questions-fallback', req.url), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        programType,
                        courseTitle,
                        courseDescription 
                    })
                });

                if (!fallbackResponse.ok) {
                    throw new Error(`Fallback failed: ${fallbackResponse.statusText}`);
                }

                const result = await fallbackResponse.json();
                if (!result.questions) {
                    throw new Error('No questions in fallback response');
                }

                return NextResponse.json(result);
            } catch (fallbackError: any) {
                // If both primary and fallback fail, return a detailed error
                console.error('Both n8n and fallback generation failed:', fallbackError);
                return NextResponse.json({ 
                    error: 'Question generation failed',
                    details: {
                        primary: { message: lastError.message, webhookUrl },
                        fallback: fallbackError.message
                    }
                }, { status: 502 });
            }
        }

    } catch (error: any) {
        console.error('Generate questions error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}