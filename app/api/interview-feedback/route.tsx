import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const { messages } = await req.json();

    const result = await axios.post('https://n8n.srv629238.hstgr.cloud/webhook/c1ce60e5-33af-463f-94f4-9067c5ef6925', {
        messages: JSON.stringify(messages)
    });

    console.log(result);
    return NextResponse.json(result.data?.message?.content);
}