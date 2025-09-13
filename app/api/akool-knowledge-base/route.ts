import axios from "axios";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const { questions } = await req.json();
    // const result = await axios.get('https://openapi.akool.com/api/open/v4/knowledge/list', {
    //     headers: {
    //         Authorization: `Bearer ${process.env.AKOOL_API_TOKEN}`
    //     }
    // });
    // console.log(result.data)
    // const isExist = result.data.data.find((item: any) => item.name == 'Interview Agent Prod');


    // if (!isExist) {
    //Create New KB
    const resp = await axios.post('https://openapi.akool.com/api/open/v4/knowledge/create',
        {
            name: 'Interview Agent Prod' + Date.now(),
            prologue: 'Tell me about Yourself',
            prompt: `
            You are a friendly and professional job interviewer.
            Ask the user one interview question at a time.
            Wait for their spoken response before asking the next.
            Start with: "Tell me about yourself."
            Then proceed with the following questions in order:
            ${questions.map((q: any) => q.question).join("\n")}
            After the user responds, ask the next question in the list. Do not repeat previous questions.
            `
        },

        {
            headers: {
                Authorization: `Bearer ${process.env.AKOOL_API_TOKEN}`
            }
        },
    );

    console.log(resp.data);
    return NextResponse.json(resp.data);
    // }

    // return NextResponse.json(result.data);
}