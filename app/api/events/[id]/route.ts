// app/api/events/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Get a specific event by ID
export async function GET(request, { params }) {
  const { id } = params;
  
  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        eventTrainers: {
          include: {
            trainer: true
          }
        },
        registrations: {
          include: {
            user: true
          }
        },
        pools: {
          include: {
            trainer: true,
            attendees: {
              include: {
                user: true
              }
            }
          }
        }
      }
    });
    
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }
    
    // Format the event data for the API response
    const now = new Date();
    
    // Extract trainers
    const trainers = event.eventTrainers.map(et => ({
      id: et.trainer.id,
      name: et.trainer.name,
      email: et.trainer.email,
      mobileNumber: et.trainer.mobileNumber
    }));
    
    // Format registrations
    const registrations = event.registrations.map(reg => ({
      id: reg.id,
      userId: reg.user.id,
      userName: reg.user.name,
      email: reg.user.email,
      mobileNumber: reg.user.mobileNumber,
      registrationDate: reg.createdAt
    }));
    
    // Format pools
    const pools = event.pools.map(pool => ({
      id: pool.id,
      name: pool.name || `Pool ${pool.id.slice(-4)}`,
      capacity: pool.capacity,
      isActive: pool.isActive,
      meetLink: pool.meetLink,
      trainer: pool.trainer ? {
        id: pool.trainer.id,
        name: pool.trainer.name
      } : null,
      attendees: pool.attendees.map(attendee => ({
        id: attendee.id,
        userId: attendee.user.id,
        userName: attendee.user.name,
        email: attendee.user.email,
        mobileNumber: attendee.user.mobileNumber,
        notified: attendee.notified
      }))
    }));
    
    // Clean up the event object
    const { eventTrainers, registrations: regs, ...eventData } = event;
    
    const formattedEvent = {
      ...eventData,
      trainers,
      registrations,
      pools,
      registeredUsers: registrations.length,
      isPast: new Date(event.eventDate) < now,
      isDeadlinePassed: event.registrationDeadline ? new Date(event.registrationDeadline) < now : false
    };
    
    return NextResponse.json(formattedEvent);
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

// Update an event
export async function PUT(request, { params }) {
  const { id } = params;
  
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.title || !data.eventDate || !data.eventTime) {
      return NextResponse.json(
        { error: 'Title, event date, and event time are required' },
        { status: 400 }
      );
    }
    
    // First check if the event exists
    const existingEvent = await prisma.event.findUnique({
      where: { id },
      include: {
        eventTrainers: true
      }
    });
    
    if (!existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }
    
    // Update the event with a transaction to ensure all related records are updated correctly
    const result = await prisma.$transaction(async (prisma) => {
      // Update the event
      const updatedEvent = await prisma.event.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
          eventDate: new Date(data.eventDate),
          eventTime: data.eventTime,
          location: data.location,
          maxCapacity: parseInt(data.maxCapacity) || 100,
          registrationDeadline: data.registrationDeadline ? new Date(data.registrationDeadline) : null
        }
      });
      
      // If trainers are provided, update the trainer relationships
      if (data.trainers) {
        // Delete existing trainer relationships
        await prisma.eventTrainer.deleteMany({
          where: {
            eventId: id
          }
        });
        
        // Create new trainer relationships
        if (data.trainers.length > 0) {
          const trainerConnections = data.trainers.map(trainerId => ({
            trainerId,
            eventId: id
          }));
          
          await prisma.eventTrainer.createMany({
            data: trainerConnections
          });
        }
      }
      
      return updatedEvent;
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    );
  }
}

// Delete an event
export async function DELETE(request, { params }) {
  const { id } = params;
  
  try {
    // Check if the event exists and has any registrations or pools
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        registrations: true,
        pools: true
      }
    });
    
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }
    
    // If the event has registrations or pools, don't allow deletion
    if (event.registrations.length > 0 || event.pools.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete an event with registrations or pools' },
        { status: 400 }
      );
    }
    
    // Delete the event with a transaction to ensure all related records are deleted
    await prisma.$transaction(async (prisma) => {
      // Delete event-trainer relationships
      await prisma.eventTrainer.deleteMany({
        where: {
          eventId: id
        }
      });
      
      // Delete the event
      await prisma.event.delete({
        where: { id }
      });
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}