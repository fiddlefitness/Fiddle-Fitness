import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { startOfDay, endOfDay } from 'date-fns'
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const WHATSAPP_API_URL = `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`

export async function GET() {
  try {


const now = new Date()

const todayStart = startOfDay(now)
const todayEnd = endOfDay(now)


    // Fetch all upcoming registrations with event & trainer info
    const registrations = await prisma.eventRegistration.findMany({
   
      include: {
        user: true,
        event: {
          include: {
            eventTrainers: {
              include: { trainer: true },
            },
          },
        },
        payment: true,
      },
    })



    let dayBeforeCount = 0
    let hourBeforeCount = 0

    for (const reg of registrations) {
        
      const { user, event, payment } = reg
      const trainers = event.eventTrainers.map(et => et.trainer)

      if (!payment || payment.status.toLowerCase() !== 'paid') {
        continue // only successful payments
      }

      const eventStart = new Date(event.eventDate)
      const diffMinutes = Math.round((eventStart.getTime() - now.getTime()) / 60000)

      const phoneUser = user.mobileNumber?.slice(-10)
      const formattedTime = eventStart.toLocaleString()

        console.log("diffMinutes",diffMinutes);

      // 1 day before (1440 minutes)
      if (diffMinutes === 1440) {
      
        if (phoneUser) {
           await sendTextMessage(phoneUser, `
           To ensure a smooth experience for ${event.title}:
1- Check your internet connection ( 30 Mbps or more ) and Zoom app logged in with the email given during registration. 
2- Device: Smart TV or Laptop preferred (mobile as last option).
3- Audio: Connect to external speakers/headphones for better sound.
4- Have your workout space and water ready.
5- Wear comfortable workout attire.
            `);
          dayBeforeCount++
        }

        // Send to trainers
        for (const trainer of trainers) {
          const phoneTrainer = trainer.mobileNumber?.slice(-10)
          if (phoneTrainer) {
        

             await sendTextMessage(phoneTrainer, `
            Hi ${trainer.name}, A friendly reminder - 
1- Test Your Tech: Check audio, video, and internet connection beforehand.
2- Music Ready: Ensure your Zumba playlist is prepared and shareable (if needed).
3- Clear Space: Have enough room to move freely on camera.
4- Good Lighting: Position yourself where you're well-lit.
5- Engage Participants: Be energetic, clear with cues, and encourage interaction.
6- Water Handy: Keep water accessible to stay hydrated.
7 Start On Time: Log in a few minutes early.
8 - Technical Backup: Have a plan B if technical issues arise.
9- Fun Attitude: Bring your energy and enthusiasm!
            `);


          }
        }
      }

      // 60 minutes before
      if (diffMinutes === 60) {
      
        if (phoneUser) {
           await sendTextMessage(phoneUser, `
         Check the following , before reaching out for help - 
1- Check Internet: Is your Wi-Fi or data connection stable?
2- Verify Link: Are you using the correct Zoom meeting link?
3- Zoom App: Is the Zoom app installed and up-to-date?
4- Email Match: Are you logged into the Zoom app with the email you used for registration (if required)?
5- Password: If prompted, is your Zoom account password correct?
6- Restart: Try closing and reopening the Zoom app.
7- Device Restart: If still stuck, try restarting your device.

Still need help ? Click " Get Help"
            `);
          hourBeforeCount++
        }

        for (const trainer of trainers) {
          const phoneTrainer = trainer.mobileNumber?.slice(-10)
          if (phoneTrainer) {
    
             await sendTextMessage(phoneTrainer, `
         Check the following , before reaching out for help - 
1- Check Internet: Is your Wi-Fi or data connection stable?
2- Verify Link: Are you using the correct Zoom meeting link?
3- Zoom App: Is the Zoom app installed and up-to-date?
4- Email Match: Are you logged into the Zoom app with the email you used for registration (if required)?
5- Password: If prompted, is your Zoom account password correct?
6- Restart: Try closing and reopening the Zoom app.
7- Device Restart: If still stuck, try restarting your device.

Still need help ? Click " Get Help"
            `);
          }
        }
      }
    }

    return NextResponse.json({
      message: 'Reminders sent',
      dayBeforeCount,
      hourBeforeCount,
    })
  } catch (err) {
    console.error('Reminder error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}




async function sendTextMessage(phoneNumber: string, message: string): Promise<void> {
  try {
    const response = await axios({
      method: 'POST',
      url: WHATSAPP_API_URL,
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: {
          body: message,
        },
      },
    })
  } catch (error) {
    console.error('Error sending text message:', error)
    throw error
  }
}
