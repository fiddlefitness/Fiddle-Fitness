// /app/api/test-send/route.ts (for app router)
import { NextRequest, NextResponse } from 'next/server';
import { sendTextMessage,sendUserReminderTemplate } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    const mobile = '9994183275'; // full international format (India = 91)
    const message = `
      Get Ready for Your Session – Quick Check!
Here's how to ensure you're all set to go:
• Strong Wi-Fi: Aim for 30 Mbps+ for smooth streaming.
• Zoom Login: Use your registered email to access the session.
• Screen Choice: Smart TV or laptop works best (mobile if needed).
• Crisp Audio: Plug in your speakers or headphones for clear sound.
• Clear Space: Make room to move freely and keep water nearby.
• Comfy Gear: Dress to move, stretch, and sweat with ease!

Let's make this session awesome!
    `;

    const result = await sendUserReminderTemplate(mobile);
    console.log('✅ Message sent:', result);

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error('❌ Error sending message:', err);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
