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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured', details: 'Please add OPENAI_API_KEY to environment variables' }, { status: 500 });
    }

    const userPrompt = `Generate interview questions for a ${programType} program in ${courseTitle}.${
      courseDescription ? ` The program focuses on: ${courseDescription}` : ''
    }

Remember to cover academic preparation, research interests, motivation, practical experience, critical thinking, and cultural fit.

Return ONLY the JSON array of questions and evaluation guidelines.`;

    // Try a list of models in order until one works
    const modelCandidates = ['gpt-4', 'gpt-4o', 'gpt-3.5-turbo'];
    let responseText: string | null = null;
    let lastModelError: any = null;

    for (const model of modelCandidates) {
      try {
        console.log('Attempting generation with model:', model);
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

        // got response — break out of model loop
        break;
      } catch (mErr: any) {
        lastModelError = mErr;
        console.warn('Model', model, 'failed:', mErr?.message || mErr);
        // If model not found or access denied, try next candidate
        continue;
      }
    }

    if (!responseText) {
      const msg = lastModelError?.message || 'No models succeeded';
      console.error('All model attempts failed:', msg);
      throw new Error(msg);
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
      console.error('Failed to parse OpenAI response:', e?.message || e, '\nResponseText:', responseText);
      return NextResponse.json({ error: 'Failed to parse generated questions', details: e?.message || e, responseText: responseText.slice(0, 2000) }, { status: 502 });
    }
  } catch (error: any) {
    console.error('Error generating questions:', error?.message || error);
    return NextResponse.json({ error: 'Failed to generate questions', details: error?.message || 'Unknown error' }, { status: 500 });
  }
}