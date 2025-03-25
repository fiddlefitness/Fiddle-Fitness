// app/api/events/category/route.js
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withApiKey } from '@/lib/authMiddleware';
import { EVENT_CATEGORIES } from '@/lib/constants/categoryIds';


async function getEventsByCategory(request) {
  try {
    // Parse the request body to get the category
    const { category } = await request.json();

    
    
    // Validate that category is provided
    if (!category) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      );
    }
    
    // Get current date for upcoming events filtering
    const now = new Date();
    
    // Query upcoming events for the specified category
    const events = await prisma.event.findMany({
      where: {
        category: category,
        eventDate: {
          gt: now
        },
        // Only include events with registration open
        OR: [
          { registrationDeadline: null },
          { registrationDeadline: { gt: now } }
        ]
      },
      select: {
        id: true,
        title: true,
        description: true,
        eventDate: true,
        eventTime: true,
        location: true,
        price: true,
        registrationDeadline: true,
        // Include trainer information
        eventTrainers: {
          include: {
            trainer: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        eventDate: 'asc'
      }
    });
    
    // Format events for the response
    const formattedEvents = events.map(event => {
      const trainerNames = event.eventTrainers.map(et => et.trainer.name);
      
      // Remove eventTrainers from the response
      const { eventTrainers, ...eventData } = event;
      
      return {
        ...eventData,
        trainers: trainerNames,
        price: event.price || 0,
        formattedDate: event.eventDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })
      };
    });

    const mediaLink = EVENT_CATEGORIES.find(cat => {return cat.value === category})?.mediaLink

    console.log(mediaLink)
    
    return NextResponse.json({
      category,
      mediaLink,
      events: formattedEvents,
      count: formattedEvents.length
    });
    
  } catch (error) {
    console.error('Error fetching events by category:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

// Export the POST handler with API key middleware
export const POST = withApiKey(getEventsByCategory);