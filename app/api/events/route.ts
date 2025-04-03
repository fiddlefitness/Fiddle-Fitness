// app/api/events/route.js
import { NextResponse } from 'next/server';
import {prisma} from '@/lib/prisma';
import { withApiKey } from '@/lib/authMiddleware';

async function getEvents(request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    
    const now = new Date();
    
    // Base query
    let whereClause = {};
    
    // Filter events based on the filter parameter
    if (filter === 'upcoming') {
      whereClause.eventDate = {
        gt: now
      };
    }
    
    const events = await prisma.event.findMany({
      where: whereClause,
      include: {
        eventTrainers: {
          include: {
            trainer: true
          }
        },
        registrations: true,
        pools: {
          include: {
            trainer: true,
            attendees: true
          }
        }
      },
      orderBy: {
        eventDate: 'asc'
      }
    });
    
    // Format the events for the API response
    const formattedEvents = events.map(event => {
      // Extract trainers
      const trainers = event.eventTrainers.map(et => ({
        id: et.trainer.id,
        name: et.trainer.name
      }));
      
      // Calculate registrations count
      const registeredUsers = event.registrations.length;
      
      // Pool information
      const pools = event.pools.map(pool => ({
        id: pool.id,
        name: pool.name || `Pool ${pool.id.slice(-4)}`, // Use last 4 chars of ID if no name
        capacity: pool.capacity,
        isActive: pool.isActive,
        meetLink: pool.meetLink,
        trainer: pool.trainer ? {
          id: pool.trainer.id,
          name: pool.trainer.name
        } : null,
        attendees: pool.attendees.length
      }));
      
      // Clean up the event object to return only what's needed
      const { eventTrainers, registrations, ...eventData } = event;
      
      return {
        ...eventData,
        trainers,
        registeredUsers,
        pools,
        isPast: new Date(event.eventDate) < now,
        isDeadlinePassed: event.registrationDeadline ? new Date(event.registrationDeadline) < now : false
      };
    });
    
    return NextResponse.json(formattedEvents);
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}
// app/api/events/route.js (updated POST section)
async function postEvent(request) {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.title || !data.eventDate || !data.eventTime || !data.category || !data.trainers || data.trainers.length === 0) {
      return NextResponse.json(
        { error: 'Title, event date, event time, category, and at least one trainer are required' },
        { status: 400 }
      );
    }
    
    // Create the event with a transaction to ensure all related records are created
    const result = await prisma.$transaction(async (prisma) => {
      // Create the event
      const event = await prisma.event.create({
        data: {
          title: data.title.trim(),
          description: data.description,
          category: data.category, // Added category field
          eventDate: new Date(data.eventDate),
          eventTime: data.eventTime,

          maxCapacity: parseInt(data.maxCapacity) || 100,
          poolCapacity: parseInt(data.poolCapacity) || 50, // Added pool capacity
          price: parseFloat(data.price) || 0,
          registrationDeadline: data.registrationDeadline ? new Date(data.registrationDeadline) : null,
          poolsAssigned: false,
          notificationSent: false
        }
      });
      
      // Create event-trainer relationships
      if (data.trainers && data.trainers.length > 0) {
        const trainerConnections = data.trainers.map(trainerId => ({
          trainerId,
          eventId: event.id
        }));
        
        await prisma.eventTrainer.createMany({
          data: trainerConnections
        });
      }
      
      return event;
    });
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}


export const GET = withApiKey(getEvents);
export const POST = withApiKey(postEvent);