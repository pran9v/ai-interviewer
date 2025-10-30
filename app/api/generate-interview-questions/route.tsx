import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    const body = await req.json();
    const { programType, courseTitle, courseDescription } = body;

    console.log('Generate questions request:', { programType, courseTitle, courseDescription, user: user?.primaryEmailAddress?.emailAddress });

    if (!courseTitle?.trim() || !programType?.trim()) {
      console.warn('generate-interview-questions: missing required fields');
      return NextResponse.json({ error: 'Missing course title or program type' }, { status: 400 });
    }

    const { has } = await auth();
    const isSubscribedUser = has({ plan: 'pro' });

    const systemPrompt = `You are an expert university admissions officer tasked with generating interview questions. Generate 8-12 relevant questions that will help assess a candidate's fit, motivation, and preparation for their chosen program.

The questions should:
1. Assess academic background and preparation
2. Evaluate research interests and goals
3. Understand motivation for the specific program
4. Gauge practical experience and skills
5. Test critical thinking and problem-solving
6. Explore cultural fit and adaptability

Format your response EXACTLY as a JSON array of objects with 'question' and 'answer' fields. The 'answer' field should contain guidelines for evaluating responses.`;

    const userPrompt = `Generate interview questions for a ${programType} program in ${courseTitle}.${
      courseDescription ? ` The program focuses on: ${courseDescription}` : ''
    }

Remember to cover academic preparation, research interests, motivation, practical experience, critical thinking, and cultural fit.

Return ONLY the JSON array of questions and evaluation guidelines.`;

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured', details: 'Please add GEMINI_API_KEY to environment variables' }, { status: 500 });
    }

    // Use Gemini 1.5 models via v1 generateContent
    const endpoints = [
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${geminiKey}`,
      // Fallback to -latest aliases if specific versions are unavailable
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${geminiKey}`,
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro-latest:generateContent?key=${geminiKey}`
    ];

    let responseText: string | null = null;
    let lastError: any = null;

    for (const url of endpoints) {
      try {
        console.log('Calling Gemini endpoint:', url);
        // Build request body for Gemini 1.x API
        const body = {
          systemInstruction: {
            role: 'system',
            parts: [{ text: systemPrompt }]
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: userPrompt }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
          }
        } as any;

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (!res.ok) {
          const errText = await res.text();
          lastError = new Error(`Gemini ${res.status}: ${errText}`);
          console.warn('Gemini endpoint failed:', res.status, errText);
          continue;
        }

        const json = await res.json();
        if (!res.ok) {
          // Stop trying other endpoints on 4xx config issues; try next model only
          lastError = new Error(`Gemini ${res.status}: ${JSON.stringify(json)}`);
          console.warn('Gemini endpoint failed:', res.status, json?.error?.message || json);
          continue;
        }
        // Extract text across Gemini 1.x and legacy shapes
        const textCandidates: string[] = [];

        // Gemini 1.x: candidates[0].content.parts[].text
        if (Array.isArray(json?.candidates) && json.candidates[0]) {
          const cand = json.candidates[0];
          const parts = cand?.content?.parts;
          if (Array.isArray(parts)) {
            for (const part of parts) {
              if (typeof part?.text === 'string') textCandidates.push(part.text);
            }
          }
        }

        // Choose first non-empty string
        const extracted = textCandidates.find(t => typeof t === 'string' && t.trim().length > 0);
        if (extracted) {
          responseText = extracted;
          break;
        }

        // As a last resort, stringify the whole response and try to find an array
        const asString = JSON.stringify(json);
        const match = asString.match(/\[\s*\{[\s\S]*\}\s*\]/m);
        if (match) {
          responseText = match[0];
          break;
        }
      } catch (gErr: any) {
        lastError = gErr;
        console.warn('Gemini call error:', gErr?.message || gErr);
        continue;
      }
    }

    if (!responseText) {
      console.error('Gemini generation failed:', lastError?.message || 'Unknown error');

      // Optionally fall back to OpenAI only if explicitly enabled
      const allowOpenAiFallback = process.env.ENABLE_OPENAI_FALLBACK === 'true';
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (allowOpenAiFallback && openaiApiKey) {
        try {
          const openai = new OpenAI({ apiKey: openaiApiKey });

          // Exponential backoff retries for rate limits
          const maxAttempts = 3;
          let attempt = 0;
          let openAiText: string | null = null;
          let lastOpenAiError: any = null;

          // Try supported models in order
          const openAiModels = ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo-0125'];
          for (const model of openAiModels) {
            attempt = 0;
            while (attempt < maxAttempts && !openAiText) {
              try {
                const completion = await openai.chat.completions.create({
                  model,
                  messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                  ],
                  temperature: 0.7,
                  max_tokens: 2000
                });

                openAiText = completion.choices?.[0]?.message?.content || null;
                if (openAiText) {
                  responseText = openAiText;
                  break;
                }
              } catch (oe: any) {
                lastOpenAiError = oe;
                const status = oe?.status || oe?.response?.status;
                const message: string = oe?.message || oe?.response?.data?.error?.message || '';
                const isRateLimited = status === 429 || /rate limit/i.test(message) || /You exceeded your current quota/i.test(message);
                const isNotFound = status === 404 || /does not exist/i.test(message) || /not found/i.test(message);
                if (isRateLimited && attempt < maxAttempts - 1) {
                  const delayMs = 500 * Math.pow(2, attempt); // 500ms, 1000ms, 2000ms
                  await new Promise(r => setTimeout(r, delayMs));
                  attempt += 1;
                  continue;
                }
                // If model is not available, try next model
                if (isNotFound) {
                  break;
                }
                // Non-retryable or last attempt: stop trying this model
                break;
              }
            }
            if (openAiText) break; // got text from this model
          }

          if (!responseText) {
            const message = lastOpenAiError?.message || 'Unknown OpenAI error';
            const status = lastOpenAiError?.status || lastOpenAiError?.response?.status;
            const isRateLimited = status === 429 || /You exceeded your current quota/i.test(message);
            return NextResponse.json({
              error: 'Failed to generate questions',
              details: message,
              provider: 'openai'
            }, { status: isRateLimited ? 429 : 502 });
          }
        } catch (fallbackErr: any) {
          return NextResponse.json({ 
            error: 'Failed to generate questions', 
            details: fallbackErr?.message || 'Unknown error',
            provider: 'openai'
          }, { status: 502 });
        }
      } else {
        return NextResponse.json({ 
          error: 'Failed to generate questions', 
          details: lastError?.message || 'Unknown error',
          provider: 'gemini'
        }, { status: 502 });
      }
    }

    try {
      // First try strict JSON
      let parsed: any;
      try {
        parsed = JSON.parse(responseText.trim());
      } catch (pe) {
        // If direct parse fails, try to extract the first JSON array in the text
        const arrayMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/m);
        if (arrayMatch) {
          parsed = JSON.parse(arrayMatch[0]);
        } else {
          throw pe;
        }
      }

      const questions = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(questions)) throw new Error('Response does not contain a questions array');

      const validatedQuestions = questions.filter((q: any) => q && typeof q.question === 'string' && typeof q.answer === 'string');
      if (validatedQuestions.length === 0) throw new Error('No properly formatted questions in response');

      console.log('Successfully generated questions:', validatedQuestions.length);
      return NextResponse.json({ questions: validatedQuestions, status: 200 });
    } catch (e: any) {
      console.error('Failed to parse response:', e?.message || e, '\nResponseText:', responseText);
      return NextResponse.json({ 
        error: 'Failed to parse generated questions', 
        details: e?.message || e, 
        responseText: responseText ? responseText.slice(0, 2000) : undefined,
        provider: 'gemini'
      }, { status: 502 });
    }
  } catch (error: any) {
    console.error('Error generating questions:', error?.message || error);
    return NextResponse.json({ error: 'Failed to generate questions', details: error?.message || 'Unknown error' }, { status: 500 });
  }
}