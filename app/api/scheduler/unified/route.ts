import { withApiKey } from '@/lib/authMiddleware';
import { prisma } from '@/lib/prisma';
import {
    sendTrainerReminder2Template,
    sendUserReminder2Template,
    sendHelpTroubleshootingMessage,
    sendTextMessage
} from '@/lib/whatsapp';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Parse the URL to get query parameters
    const url = new URL(request.url);
    const runType = url.searchParams.get('runType') || 'morning';
    
    // Get the current execution timestamp for logging
    const executionTime = new Date();
    console.log(`[${executionTime.toISOString()}] Starting unified scheduler (${runType})`);
    
    // Run both tasks
    const assignPoolsResult = await handleAssignPools();
    const sendRemindersResult = await handleSendReminders(runType);
    
    // Log a summary
    const completionTime = new Date();
    const executionDuration = (completionTime.getTime() - executionTime.getTime()) / 1000;
    
    console.log(`[${completionTime.toISOString()}] Unified scheduler completed in ${executionDuration}s.`);
    
    return NextResponse.json({
      message: `Unified scheduler (${runType}) completed successfully`,
      timestamp: completionTime.toISOString(),
      executionTimeSeconds: executionDuration,
      assignPools: assignPoolsResult,
      sendReminders: sendRemindersResult
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${new Date().toISOString()}] Fatal error in unified scheduler:`, error);
    return NextResponse.json(
      { 
        error: 'Failed to process unified scheduler: ' + errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Handle assign pools logic for events happening tomorrow
 */
async function handleAssignPools() {
  try {
    const executionTime = new Date();
    console.log(`[${executionTime.toISOString()}] Starting pool assignment task`);
    
    const today = new Date();

    

// Calculate 48 hours ahead (start of day)
const twoDaysLater = new Date(today);
twoDaysLater.setDate(twoDaysLater.getDate() + 2);
twoDaysLater.setHours(0, 0, 0, 0);

// End of that day
const twoDaysLaterEnd = new Date(twoDaysLater);
twoDaysLaterEnd.setHours(23, 59, 59, 999);
    
    // Find all events happening tomorrow that don't have pools assigned yet

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    // End of tomorrow
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);
const seventyTwoHoursLater = new Date(today.getTime() + 72 * 60 * 60 * 1000);
const now = new Date();
    const eventsForTomorrow = await prisma.event.findMany({
      where: {
     registrationDeadline: {
  lt: now, // deadline is before now
},
        poolsAssigned: false
      },
      select: {
        id: true,
        title: true,
        eventDate: true,
        eventTime: true,
        registrationDeadline: true
      }
    });


  
    console.log(`[${executionTime.toISOString()}] Found ${eventsForTomorrow.length} events for tomorrow that may need pool assignment`);
  
    if (eventsForTomorrow.length === 0) {
      return {
        message: 'No events found for tomorrow that need pool assignment',
        processed: 0
      };
    }
    
    // Process each event
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;
    
    for (const event of eventsForTomorrow) {
      try {
        // Check if registration deadline has passed or there's no deadline
        const now = new Date();
        const hasDeadline = event.registrationDeadline !== null;
        const registrationOpen = hasDeadline && event.registrationDeadline ? new Date(event.registrationDeadline) > now : false;
        
        // Skip events where registration is still open
        if (registrationOpen) {
          console.log(`[${executionTime.toISOString()}] Skipping event ${event.id} - registration still open until ${event.registrationDeadline}`);
          results.push({
            eventId: event.id,
            title: event.title,
            status: 'skipped',
            reason: 'Registration deadline has not passed yet'
          });
          skippedCount++;
          continue;
        }
        
        console.log(`[${executionTime.toISOString()}] Processing pool assignment for event ${event.id} - ${event.title}`);
        
        // Call the pool assignment API for this event with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        try {
          // Call the pool assignment API for this event
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/events/${event.id}/assign-pools`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || ''
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          const result = await response.json();
          
          if (response.ok) {
            console.log(`[${executionTime.toISOString()}] Successfully assigned pools for event ${event.id}`);
            results.push({
              eventId: event.id,
              title: event.title,
              status: 'success',
              pools: result.pools ? result.pools.length : 0
            });
            successCount++;
          } else {
            console.error(`[${executionTime.toISOString()}] Failed to assign pools for event ${event.id}:`, result.error);
            results.push({
              eventId: event.id,
              title: event.title,
              status: 'failed',
              error: result.error || 'Unknown error'
            });
            failureCount++;
          }
        } catch (fetchError: unknown) {
          clearTimeout(timeoutId);
          
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            console.error(`[${executionTime.toISOString()}] Request timeout for event ${event.id}`);
            results.push({
              eventId: event.id,
              title: event.title,
              status: 'failed',
              error: 'Request timed out after 30 seconds'
            });
          } else {
            const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
            console.error(`[${executionTime.toISOString()}] Fetch error for event ${event.id}:`, fetchError);
            results.push({
              eventId: event.id,
              title: event.title,
              status: 'failed',
              error: errorMessage
            });
          }
          failureCount++;
        }
      } catch (eventError: unknown) {
        const errorMessage = eventError instanceof Error ? eventError.message : 'Unknown error';
        console.error(`[${executionTime.toISOString()}] Error processing event ${event.id}:`, eventError);
        results.push({
          eventId: event.id,
          title: event.title,
          status: 'failed',
          error: errorMessage
        });
        failureCount++;
      }
    }
    
    // Log a summary for monitoring
    const completionTime = new Date();
    const executionDuration = (completionTime.getTime() - executionTime.getTime()) / 1000;
    
    console.log(`[${completionTime.toISOString()}] Pool assignment task completed in ${executionDuration}s. Success: ${successCount}, Failed: ${failureCount}, Skipped: ${skippedCount}, Total: ${eventsForTomorrow.length}`);
    
    return {
      message: `Processed ${eventsForTomorrow.length} events for tomorrow`,
      summary: {
        total: eventsForTomorrow.length,
        success: successCount,
        failed: failureCount,
        skipped: skippedCount,
        executionTimeSeconds: executionDuration
      },
      results
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${new Date().toISOString()}] Error in pool assignment task:`, error);
    return { 
      error: 'Failed to process pool assignments: ' + errorMessage
    };
  }
}

/**
 * Handle send reminders logic for events happening today
 */
async function handleSendReminders(runType: string) {
  try {
    console.log(`[${new Date().toISOString()}] Starting send reminders task (${runType})`);

    const now = new Date();

      const today = new Date();
today.setHours(0, 0, 0, 0);

const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);

    // Fetch all upcoming or just-passed events that still need reminders
    const eventsToRemind = await prisma.event.findMany({
        
      where: {
        
        poolsAssigned: true,
        OR: [
          { reminder60Sent: false },
          { reminder24Sent: false },
          { reminder48Sent: false },
          { ratingSent: false }
        ]
      },
      include: {
        registrations: {
          include: {
            user: true,
          },
        },
        eventTrainers: {
          include: {
            trainer: true,
          },
        },
        pools: {
          include: {
            attendees: true,
          },
        },
      },
    });

    if (eventsToRemind.length === 0) {
      return {
        message: 'No events found that need reminders',
        processed: 0,
        runType,
      };
    }

    const results = [];
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    for (const event of eventsToRemind) {
      try {
        const shouldSend = shouldSendReminderNow(event.eventTime, runType);
     //   if (!shouldSend) {
     //     skippedCount++;
      //    results.push({
       //     eventId: event.id,
       //     title: event.title,
        //    status: 'skipped',
        //    reason: `Not the right time to send reminder based on run type: ${runType}`,
        //  });
       //   continue;
      //  }

        const eventDateTime = new Date(event.eventDate);
        const startTimeStr = event.eventTime?.split('-')[0]?.trim();
        const [startHourRaw, startMinRaw] = startTimeStr?.split(':') ?? ['0', '0'];
        let eventHour = parseInt(startHourRaw);
        let eventMinute = parseInt(startMinRaw) || 0;

        if (startTimeStr?.includes('PM') && eventHour < 12) eventHour += 12;
        if (startTimeStr?.includes('AM') && eventHour === 12) eventHour = 0;

        eventDateTime.setHours(eventHour, eventMinute, 0, 0);
        const diffMinutes = Math.floor((eventDateTime.getTime() - now.getTime()) / 60000);

        let eventResult = null;

        if (!event.reminder48Sent) {
          eventResult = await processEventReminders(event, '48hr');
          await prisma.event.update({ where: { id: event.id }, data: { reminder48Sent: true } });
        } else if (!event.reminder24Sent) {
          eventResult = await processEventReminders(event, '24hr');
          await prisma.event.update({ where: { id: event.id }, data: { reminder24Sent: true } });
        } else if (!event.reminder60Sent) {
          eventResult = await processEventReminders(event, '60min');
          await prisma.event.update({ where: { id: event.id }, data: { reminder60Sent: true } });
        }

        // Handle post-event (rating)
        const endTimeStr = event.eventTime?.split('-')[1]?.trim();
            if (endTimeStr) {
          const [endHourRaw, endMinRaw] = endTimeStr.split(':') ?? ['0', '0'];
          let endHour = parseInt(endHourRaw);
          let endMinute = parseInt(endMinRaw) || 0;

       

          if (endTimeStr.includes('PM') && endHour < 12) endHour += 12;
          if (endTimeStr.includes('AM') && endHour === 12) endHour = 0;

          const eventEnd = new Date(event.eventDate);
          
      eventEnd.setHours(endHour, endMinute, 0, 0); // Make sure endHour & endMinute are set

const diffInMs = now.getTime() - eventEnd.getTime();
const diffInMinutes = diffInMs / (1000 * 60);
   
if (diffInMinutes >= 60 && !event.ratingSent) {
            eventResult = await processEventReminders(event, 'post-event');
            await prisma.event.update({
              where: { id: event.id },
              data: { ratingSent: true },
            });
          }
        }

        if (eventResult) {
          successCount++;
          results.push({
            eventId: event.id,
            title: event.title,
            status: 'success',
            details: eventResult,
          });
        } else {
          skippedCount++;
          results.push({
            eventId: event.id,
            title: event.title,
            status: 'skipped',
            reason: 'No matching reminder condition met',
          });
        }
      } catch (eventError: unknown) {
        const errorMessage = eventError instanceof Error ? eventError.message : 'Unknown error';
        console.error(`[${new Date().toISOString()}] Error processing event ${event.id}:`, eventError);
        failureCount++;
        results.push({
          eventId: event.id,
          title: event.title,
          status: 'failed',
          error: errorMessage,
        });
      }
    }

    return {
      message: `Processed ${eventsToRemind.length} events for reminders`,
      runType,
      summary: {
        total: eventsToRemind.length,
        success: successCount,
        failed: failureCount,
        skipped: skippedCount,
      },
      results,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${new Date().toISOString()}] Error in send reminders task:`, error);
    return {
      error: 'Failed to process reminders: ' + errorMessage,
    };
  }
}

/**
 * Determines if a reminder should be sent based on the event time and run type
 */
function shouldSendReminderNow(eventTime: string | null, runType: string): boolean {
  if (!eventTime) return true; // If no time, default to sending
  
  try {
    // Parse the event time (format: "10:00 AM - 12:00 PM")
    const startTimePart = eventTime.split('-')[0].trim();
    const timeMatch = startTimePart.match(/(\d+):?(\d*)\s*([APap][Mm])?/);
    
    if (!timeMatch) return true; // If parsing fails, default to sending
    
    let eventHour = parseInt(timeMatch[1]);
    const eventMinute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    
    // Convert to 24-hour format
    const period = timeMatch[3]?.toUpperCase() || 'AM';
    if (period === 'PM' && eventHour < 12) {
      eventHour += 12;
    } else if (period === 'AM' && eventHour === 12) {
      eventHour = 0;
    }
    
    // For morning run (before 12 PM), send reminders for events happening in the morning
    if (runType === 'morning' && eventHour < 12) return true;
    
    // For evening run (after 12 PM), send reminders for events happening in the afternoon/evening
    if (runType === 'evening' && eventHour >= 12) return true;
    
    return false;
  } catch (error) {
    console.error('Error parsing event time:', error);
    return true; // Default to sending if parsing fails
  }
}

/**
 * Process sending reminders for a specific event
 * async function sendReminder(event: any, type: '60min' | '24hr' | '48hr') {
 */
async function processEventReminders(event: any, type: '60min' | '24hr' | '48hr' | 'post-event') {
  const userResults = [];
  const trainerResults = [];
  
  // Format date for templates
  const eventDate = new Date(event.eventDate).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'long'
  });
  
  // Find meet links from pools
  const poolWithLinks = event.pools.find((pool: any) => pool.meetLink);
  
  if (!poolWithLinks) {
    throw new Error('No meet link found for this event');
  }
  
  // Send reminders to users
  for (const registration of event.registrations) {
    try {
      // Find this user's personal meet link
      const poolAttendee = event.pools
        .flatMap((pool: any) => pool.attendees)
        .find((pa: any) => pa.userId === registration.userId);
      
      const meetLink = poolAttendee?.meetLink || poolWithLinks.meetLink;
      
     if (meetLink && registration.user.mobileNumber) {
            if (type === '60min') {
          await sendHelpTroubleshootingMessage(registration.user.mobileNumber);
        } else if (type === '24hr') {
        await sendTextMessage(registration.user.mobileNumber,`
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
        } else if (type === '48hr') {
          await sendUserReminder2Template(
           registration.user.mobileNumber,
            event.title,
            meetLink
          );
        }else if (type === 'post-event') {
   await sendTextMessage(registration.user.mobileNumber, `
        Please rate your satisfaction with the event on a scale of 1 (Very Unsatisfied) to 5 (Very Satisfied). Your feedback is important to us.
            `);
               await sendTextMessage(registration.user.mobileNumber, `
       Hello again, ${registration.user.name}, ready for another great session?
            `);
       await sendTextMessage(registration.user.mobileNumber, `
        Your well-being is important,  please consider any health conditions before engaging in physical activity.
            `);

        }
    
        
        userResults.push({
          userId: registration.userId,
          status: 'success'
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error sending user reminder for ${registration.userId}:`, error);
      userResults.push({
        userId: registration.userId,
        status: 'failed',
        error: errorMessage
      });
    }
  }
  
  // Send reminders to trainers
  for (const eventTrainer of event.eventTrainers) {
    try {
      const trainer = eventTrainer.trainer;
      
      // For trainers, we'll use the pool's main link
        if (poolWithLinks.meetLink && trainer.mobileNumber) {
           if (type === '60min') {
       await sendTextMessage(trainer.mobileNumber,`
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
        } else if (type === '24hr') {
                   await sendTextMessage(trainer.mobileNumber,`
            Hi ${trainer.name}, quick reminder before your session 
1.	Test your tech – Audio, video, and Wi-Fi.
2.	Playlist ready? – Keep it set and shareable.
3.	Clear your space – Room to move freely.
4.	Light it up – Make sure you’re well-lit.
5.	Stay engaging – Use clear cues and keep it fun.
6.	Keep water nearby – Stay hydrated.
7.	Be early – Log in a few mins before.
8.	Have a backup plan – Just in case tech glitches.
9.	Bring the vibe! – Energy and smiles all the way!
            `);
        } else if (type === '48hr') {
           await sendTrainerReminder2Template(
          trainer.mobileNumber,
          trainer.name,
          event.title,
          event.eventTime,
          poolWithLinks.meetLink
        );
        
        }


    
        trainerResults.push({
          trainerId: trainer.id,
          status: 'success'
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error sending trainer reminder for ${eventTrainer.trainerId}:`, error);
      trainerResults.push({
        trainerId: eventTrainer.trainerId,
        status: 'failed',
        error: errorMessage
      });
    }
  }
  
  return {
    userReminders: userResults,
    trainerReminders: trainerResults
  };
}

// Export the handler with API key middleware protection
// export const GET = withApiKey(handleRequest); 
