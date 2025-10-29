import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt = `You are an expert university admissions officer tasked with generating interview questions. For each program and course, generate 8-12 relevant questions that will help assess a candidate's fit, motivation, and preparation.

The questions should:
1. Assess academic background and preparation
2. Evaluate research interests and goals
3. Understand motivation for the specific program
4. Gauge practical experience and skills
5. Test critical thinking and problem-solving
6. Explore cultural fit and adaptability

Format the response as a JSON array of objects with 'question' and 'answer' fields. The 'answer' field should contain guidelines for evaluating responses.

Example format:
[
    {
        "question": "What motivated you to choose this specific program?",
        "answer": "Look for: Clear alignment between career goals and program, specific aspects of the curriculum that appeal to them, understanding of the program's strengths"
    }
]`;

export async function POST(req: NextRequest) {
    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ 
            error: 'OpenAI API key not configured', 
            details: 'Please add OPENAI_API_KEY to environment variables'
        }, { status: 500 });
    }

    try {
        const { programType, courseTitle, courseDescription } = await req.json();

        if (!programType || !courseTitle) {
            return NextResponse.json({ 
                error: 'Missing required fields',
                details: 'Program type and course title are required'
            }, { status: 400 });
        }

        const prompt = `Generate interview questions for a ${programType} program in ${courseTitle}.${
            courseDescription ? ` The program focuses on: ${courseDescription}` : ''
        }

Remember to cover academic preparation, research interests, motivation, practical experience, critical thinking, and cultural fit.

Return ONLY the JSON array of questions and evaluation guidelines.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4',  // Fallback to gpt-3.5-turbo if gpt-4 not available
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000,
        });

        const responseText = completion.choices[0]?.message?.content || '';
        
        try {
            // Try to parse the response as JSON
            const questions = JSON.parse(responseText.trim());
            return NextResponse.json({ questions, source: 'openai-fallback' });
        } catch (e) {
            // If parsing fails, try to extract array portion
            const match = responseText.match(/\[\s*{\s*"question"/);
            if (match) {
                const startIdx = match.index;
                const endIdx = responseText.lastIndexOf(']') + 1;
                const jsonStr = responseText.slice(startIdx, endIdx);
                try {
                    const questions = JSON.parse(jsonStr);
                    return NextResponse.json({ questions, source: 'openai-fallback' });
                } catch (e) {
                    throw new Error('Could not parse questions from response');
                }
            }
            throw new Error('Response was not in the expected format');
        }
    } catch (error: any) {
        console.error('Error generating questions:', error);
        return NextResponse.json({ 
            error: 'Failed to generate questions',
            details: error?.message || 'Unknown error'
        }, { status: 500 });
    }
}