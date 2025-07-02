import { withApiKey } from '@/lib/authMiddleware';
import { prisma } from '@/lib/prisma';
import {
    sendTrainerReminder2Template,
    sendUserReminder2Template
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
    
    // Calculate tomorrow's date (at midnight)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    // End of tomorrow
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);
    
    // Find all events happening tomorrow that don't have pools assigned yet
    const eventsForTomorrow = await prisma.event.findMany({
      where: {
        eventDate: {
          gte: tomorrow,
          lte: tomorrowEnd
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
        // Check reminder2Sent status
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
      return {
        message: 'No events found for today that need reminder 2',
        processed: 0,
        runType
      };
    }
    
    // Process each event
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;
    
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
          skippedCount++;
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
      } catch (eventError: unknown) {
        const errorMessage = eventError instanceof Error ? eventError.message : 'Unknown error';
        console.error(`[${new Date().toISOString()}] Error processing event ${event.id}:`, eventError);
        results.push({
          eventId: event.id,
          title: event.title,
          status: 'failed',
          error: errorMessage
        });
        failureCount++;
      }
    }
    
    // Log a summary
    console.log(`[${new Date().toISOString()}] Send reminders task completed. Success: ${successCount}, Failed: ${failureCount}, Skipped: ${skippedCount}, Total: ${todayEvents.length}`);
    
    return {
      message: `Processed ${todayEvents.length} events for today's reminders`,
      runType,
      summary: {
        total: todayEvents.length,
        success: successCount,
        failed: failureCount,
        skipped: skippedCount
      },
      results
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${new Date().toISOString()}] Error in send reminders task:`, error);
    return { 
      error: 'Failed to process reminders: ' + errorMessage
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

// Export the handler with API key middleware protection
// export const GET = withApiKey(handleRequest); 