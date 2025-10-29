import { NextRequest, NextResponse } from "next/server";
import OpenAI from 'openai';
import { auth, currentUser } from "@clerk/nextjs/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const systemPrompt = `You are an expert university admissions officer tasked with generating interview questions. Generate 8-12 relevant questions that will help assess a candidate's fit, motivation, and preparation for their chosen program.

The questions should:
1. Assess academic background and preparation
2. Evaluate research interests and goals
3. Understand motivation for the specific program
4. Gauge practical experience and skills
5. Test critical thinking and problem-solving
6. Explore cultural fit and adaptability

Format your response EXACTLY as a JSON array of objects with 'question' and 'answer' fields. The 'answer' field should contain guidelines for evaluating responses.`;

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

    const provider = (process.env.GENERATIVE_PROVIDER || 'gemini').toLowerCase();

    // Build the user prompt
    const userPrompt = `Generate interview questions for a ${programType} program in ${courseTitle}.${
      courseDescription ? ` The program focuses on: ${courseDescription}` : ''
    }

Remember to cover academic preparation, research interests, motivation, practical experience, critical thinking, and cultural fit.

Return ONLY the JSON array of questions and evaluation guidelines.`;

    let responseText: string | null = null;
    let lastProviderError: any = null;

    // If Gemini is the provider (default), call Google Generative API using GEMINI_API_KEY
    if (provider === 'gemini') {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        return NextResponse.json({ error: 'GEMINI_API_KEY not configured', details: 'Please add GEMINI_API_KEY to environment variables' }, { status: 500 });
      }

      // Try chat-bison first, then text-bison
      const endpoints = [
        `https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:generateMessage?key=${geminiKey}`,
        `https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=${geminiKey}`
      ];

      for (const url of endpoints) {
        try {
          console.log('Calling Gemini endpoint:', url);
          const body = url.includes(':generateMessage') ? {
            messages: [
              { author: 'system', content: systemPrompt },
              { author: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            maxOutputTokens: 1024
          } : {
            prompt: userPrompt,
            temperature: 0.7,
            maxOutputTokens: 1024
          };

          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });

          if (!res.ok) {
            const errText = await res.text();
            lastProviderError = new Error(`Gemini ${res.status}: ${errText}`);
            console.warn('Gemini endpoint failed:', res.status, errText);
            continue;
          }

          const json = await res.json();
          // Extract text from multiple possible shapes
          const textCandidates: string[] = [];
          if (Array.isArray(json?.candidates) && json.candidates[0]) {
            const cand = json.candidates[0];
            if (typeof cand.output === 'string') textCandidates.push(cand.output);
            if (typeof cand.text === 'string') textCandidates.push(cand.text);
            if (Array.isArray(cand?.content)) {
              for (const part of cand.content) {
                if (typeof part?.text === 'string') textCandidates.push(part.text);
                if (typeof part?.text === 'object' && part?.text?.toString) textCandidates.push(part.text.toString());
              }
            }
          }
          // Older/newer chat responses
          if (json?.message?.content) {
            const content = json.message.content;
            if (Array.isArray(content)) {
              for (const c of content) if (c?.text) textCandidates.push(c.text);
            } else if (typeof content === 'string') textCandidates.push(content);
          }
          if (json?.candidates?.[0]?.content?.[0]?.text) textCandidates.push(json.candidates[0].content[0].text);
          if (json?.output?.[0]?.content?.[0]?.text) textCandidates.push(json.output[0].content[0].text);

          // Fallback: if body contains a simple 'candidates[0].output' or 'candidates[0].content'
          const extracted = textCandidates.find(t => typeof t === 'string' && t.trim().length > 0);
          if (extracted) {
            responseText = extracted;
            break;
          }

          // As a last resort, stringify the whole response and try to find an array
          const asString = JSON.stringify(json);
          const match = asString.match(/\[\s*\{\s*"question"/);
          if (match) {
            // extract array substring
            const start = asString.indexOf('[');
            const end = asString.lastIndexOf(']') + 1;
            responseText = asString.slice(start, end);
            break;
          }
        } catch (gErr: any) {
          lastProviderError = gErr;
          console.warn('Gemini call error:', gErr?.message || gErr);
          continue;
        }
      }

      if (!responseText && lastProviderError) {
        console.error('Gemini attempts failed:', lastProviderError?.message || lastProviderError);
        // fall through to trying OpenAI if configured
      }
    }

    // If responseText still empty and provider isn't strictly gemini-only, try OpenAI as a fallback
    if (!responseText && provider !== 'openai') {
      // If provider was explicitly set to gemini, still allow OpenAI fallback only if OPENAI_API_KEY exists
      if (!process.env.OPENAI_API_KEY) {
        // If we don't have any provider available, return an error
        if (!responseText) {
          return NextResponse.json({ error: 'No generation provider available', details: 'Gemini failed and OPENAI_API_KEY not set' }, { status: 502 });
        }
      }
    }

    // If provider == 'openai' or we're falling back to OpenAI, call OpenAI
    if (!responseText && (provider === 'openai' || process.env.OPENAI_API_KEY)) {
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: 'OpenAI API key not configured', details: 'Please add OPENAI_API_KEY to environment variables' }, { status: 500 });
      }

      // Try a list of models in order until one works
      const modelCandidates = [process.env.OPENAI_MODEL || 'gpt-4', 'gpt-4o', 'gpt-3.5-turbo'];
      let lastModelError: any = null;

      for (const model of modelCandidates) {
        try {
          console.log('Attempting generation with OpenAI model:', model);
          const completion = await openai.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 2000
          });

          responseText = completion.choices?.[0]?.message?.content || null;
          if (!responseText) {
            lastModelError = new Error('Empty response from OpenAI');
            continue; // try next model
          }

          break;
        } catch (mErr: any) {
          lastModelError = mErr;
          console.warn('OpenAI model', model, 'failed:', mErr?.message || mErr);
          continue;
        }
      }

      if (!responseText && lastModelError) {
        console.error('All OpenAI model attempts failed:', lastModelError?.message || lastModelError);
        throw lastModelError;
      }
    }

    if (!responseText) {
      throw new Error('No response generated by provider');
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
      return NextResponse.json({ error: 'Failed to parse generated questions', details: e?.message || e, responseText: responseText ? responseText.slice(0, 2000) : undefined }, { status: 502 });
    }
  } catch (error: any) {
    console.error('Error generating questions:', error?.message || error);
    return NextResponse.json({ error: 'Failed to generate questions', details: error?.message || 'Unknown error' }, { status: 500 });
  }
}