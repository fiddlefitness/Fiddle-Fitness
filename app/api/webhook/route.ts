import { createHmac } from "crypto";
import { NextRequest, NextResponse } from 'next/server';

interface WebhookNotification {
    [key: string]: any;
}

interface WebhookResponse {
    message: string;
}

export async function POST(req: NextRequest): Promise<NextResponse<WebhookResponse>> {
    console.log('request recieved')
    try {
        const notification: WebhookNotification = await req.json();
        const receivedSignature = req.headers.get("x-aisensy-signature");
        const sharedSecret = process.env.WEBHOOK_SHARED_SECRET;
        
        if (!sharedSecret) {
            return NextResponse.json({ message: "Shared secret is missing" }, { status: 500 });
        }

        if (!receivedSignature) {
            return NextResponse.json({ message: "Missing signature header" }, { status: 400 });
        }

        const createHash = (text: string, secret: string): string => {
            return createHmac("sha256", secret).update(text).digest("hex");
        };  

        const generatedSignature = createHash(JSON.stringify(notification), sharedSecret);
        
        if (receivedSignature === generatedSignature) {
            console.log("Signature Matched", notification);
            return NextResponse.json({ message: "Signature Matched" }, { status: 200 });
        } else {
            console.error("Signature didn't Match");
            return NextResponse.json({ message: "Signature didn't Match" }, { status: 401 });
        }
    } catch (err) {
        console.error("Error processing webhook:", err);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}
