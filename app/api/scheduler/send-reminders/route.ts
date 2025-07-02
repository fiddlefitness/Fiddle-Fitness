import { prisma } from '@/lib/prisma';
import { sendTrainerReminder2Template, sendUserReminder2Template } from '@/lib/whatsapp';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Parse the URL to get query parameters
    const url = new URL(request.url);
    const runType = url.searchParams.get('runType') || 'unknown';

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    
    // Find events happening today with assigned pools
    const todayEvents = await prisma.event.findMany({
      where: {
        eventDate: {
          gte: today,
          lte: todayEnd
        },
        poolsAssigned: true,
        // Check reminder2Sent status based on run type
        reminder2Sent: false
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
            attendees: true
          }
        }
      }
    });
    
    if (todayEvents.length === 0) {
      return NextResponse.json({
        message: 'No events found for today that need reminder 2',
        processed: 0,
        runType
      });
    }
    
    // Process each event
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (const event of todayEvents) {
      try {
        // Parse event time to see if we should send reminder now
        const shouldSendReminder = shouldSendReminderNow(event.eventTime, runType);
        
        if (!shouldSendReminder) {
          results.push({
            eventId: event.id,
            title: event.title,
            status: 'skipped',
            reason: `Not the right time to send reminder based on run type: ${runType}`
          });
          continue;
        }
        
        // Process reminders for this event
        const eventResult = await processEventReminders(event);
        
        // Mark event as having had reminder2 sent
        await prisma.event.update({
          where: { id: event.id },
          data: { reminder2Sent: true }
        });
        
        results.push({
          eventId: event.id,
          title: event.title,
          status: 'success',
          details: eventResult
        });
        
        successCount++;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing reminders for event ${event.id}:`, error);
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
    console.log(`Reminder 2 job completed (${runType}). Success: ${successCount}, Failed: ${failureCount}, Total: ${todayEvents.length}`);
    
    return NextResponse.json({
      message: `Processed ${todayEvents.length} events for today's reminders`,
      runType,
      summary: {
        total: todayEvents.length,
        success: successCount,
        failed: failureCount
      },
      results
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in reminder scheduler:', error);
    return NextResponse.json(
      { error: 'Failed to process reminders: ' + errorMessage },
      { status: 500 }
    );
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
    
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    
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
 */
async function processEventReminders(event: any) {
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
        await sendUserReminder2Template(
          registration.user.mobileNumber,
          event.title,
          meetLink
        );
        
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
        await sendTrainerReminder2Template(
          trainer.mobileNumber,
          trainer.name,
          event.title,
          event.eventTime,
          poolWithLinks.meetLink
        );
        
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

// Uncomment to add API key protection
// export const GET = withApiKey(GET); 