import { withApiKey } from '@/lib/authMiddleware';
import { prisma } from '@/lib/prisma';
import {
    sendTrainerReminder2Template,
    sendUserReminder2Template,
    sendHelpTroubleshootingMessage,
    sendTextMessage
} from '@/lib/whatsapp';
import { NextResponse } from 'next/server';


await sendTextMessage(9994183275,`
          Get Ready for Your Session – Quick Check!
Here's how to ensure you're all set to go:
•	Strong Wi-Fi: Aim for 30 Mbps+ for smooth streaming.
•	Zoom Login: Use your registered email to access the session.
•	Screen Choice: Smart TV or laptop works best (mobile if needed).
•	Crisp Audio: Plug in your speakers or headphones for clear sound.
•	Clear Space: Make room to move freely and keep water nearby.
•	Comfy Gear: Dress to move, stretch, and sweat with ease! 

Let's make this session awesome!
`);
