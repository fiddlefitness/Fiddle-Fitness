// app/api/scheduler/assign-pools/route.js
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withApiKey } from '@/lib/authMiddleware';

// Optional API key verification
const verifyApiKey = (request) => {
  const authHeader = request.headers.get('authorization');
  // const apiKey = process.env.SCHEDULER_API_KEY;
  
  // Skip verification if no API key is configured (not recommended for production)
  if (!apiKey) return true;
  
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== apiKey) {
    return false;
  }
  
  return true;
};


export async function GET (request) {
  try {
    // Verify API key for security (optional but recommended)
    // if (!verifyApiKey(request)) {
    //   return NextResponse.json(
    //     { error: 'Unauthorized access' },
    //     { status: 401 }
    //   );
    // }
    
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

    console.log(eventsForTomorrow)
  
    
    if (eventsForTomorrow.length === 0) {
      return NextResponse.json({
        message: 'No events found for tomorrow that need pool assignment',
        processed: 0
      });
    }
    
    // Process each event
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (const event of eventsForTomorrow) {
      try {
        // Check if registration deadline has passed or there's no deadline
        const now = new Date();
        const registrationOpen = event.registrationDeadline && new Date(event.registrationDeadline) > now;
        
        // Skip events where registration is still open
        if (registrationOpen) {
          results.push({
            eventId: event.id,
            title: event.title,
            status: 'skipped',
            reason: 'Registration deadline has not passed yet'
          });
          continue;
        }
        
        // Call the pool assignment API for this event
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/events/${event.id}/assign-pools`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || ''
          }
        });
        
        const result = await response.json();
        
        if (response.ok) {
          results.push({
            eventId: event.id,
            title: event.title,
            status: 'success',
            pools: result.pools ? result.pools.length : 0
          });
          successCount++;
        } else {
          results.push({
            eventId: event.id,
            title: event.title,
            status: 'failed',
            error: result.error || 'Unknown error'
          });
          failureCount++;
        }
      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error);
        results.push({
          eventId: event.id,
          title: event.title,
          status: 'failed',
          error: error.message || 'Unknown error'
        });
        failureCount++;
      }
    }
    
    // Log a summary for monitoring
    console.log(`Pool assignment job completed. Success: ${successCount}, Failed: ${failureCount}, Total: ${eventsForTomorrow.length}`);
    
    return NextResponse.json({
      message: `Processed ${eventsForTomorrow.length} events for tomorrow`,
      summary: {
        total: eventsForTomorrow.length,
        success: successCount,
        failed: failureCount
      },
      results
    });
  } catch (error) {
    console.error('Error in pool assignment scheduler:', error);
    return NextResponse.json(
      { error: 'Failed to process pool assignments: ' + error.message },
      { status: 500 }
    );
  }
}


// export const GET = withApiKey(getFunction)