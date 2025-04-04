import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const body = await req.json();
    const event = body.event;

    if (event === "meeting.ended") {
        const meetingId = body.payload.object.id;
        console.log(`✅ Meeting ${meetingId} ended at ${new Date().toISOString()}`);

        // TODO: Send WhatsApp message here
    }

    return NextResponse.json({ message: "Webhook received" }, { status: 200 });
}