// app/api/scheduler/assign-pools/route.js
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Get the current execution timestamp for logging
    const executionTime = new Date();
    console.log(`[${executionTime.toISOString()}] Starting pool assignment scheduler job`);
    
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
      return NextResponse.json({
        message: 'No events found for tomorrow that need pool assignment',
        processed: 0,
        timestamp: executionTime.toISOString()
      });
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
        // Create an AbortController to cancel the fetch request if it takes too long
        const controller = new AbortController();
        // Set a timeout that will cancel the request after 30 seconds to prevent hanging
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
    
    console.log(`[${completionTime.toISOString()}] Pool assignment job completed in ${executionDuration}s. Success: ${successCount}, Failed: ${failureCount}, Skipped: ${skippedCount}, Total: ${eventsForTomorrow.length}`);
    
    return NextResponse.json({
      message: `Processed ${eventsForTomorrow.length} events for tomorrow`,
      summary: {
        total: eventsForTomorrow.length,
        success: successCount,
        failed: failureCount,
        skipped: skippedCount,
        executionTimeSeconds: executionDuration
      },
      timestamp: completionTime.toISOString(),
      results
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${new Date().toISOString()}] Fatal error in pool assignment scheduler:`, error);
    return NextResponse.json(
      { 
        error: 'Failed to process pool assignments: ' + errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Uncomment to enable API key middleware protection
// export const GET = withApiKey(GET);