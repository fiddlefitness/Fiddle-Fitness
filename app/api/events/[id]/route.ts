// app/api/events/[id]/route.js
import { withApiKey } from '@/lib/authMiddleware';
import { prisma } from '@/lib/prisma';
import { sendMeetLinkTrainerTemplate } from '@/lib/whatsapp';
import { addParticipantsToZoomMeeting } from '@/lib/zoom';
import { NextResponse } from 'next/server';

interface RequestParams {
  id: string;
}

// Get a specific event by ID
async function getEvent(request: Request, { params }: { params: RequestParams }) {
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
        },
        reviews: true // Include reviews data
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

    // Calculate reviews statistics
    let averageRating = 0;
    let totalReviews = 0;
    
    if (event.reviews && event.reviews.length > 0) {
      const completedReviews = event.reviews.filter(review => 
        review.status === 'completed' && review.rating != null
      );
      
      totalReviews = completedReviews.length;
      
      if (totalReviews > 0) {
        const totalRating = completedReviews.reduce((sum, review) => sum + (review.rating || 0), 0);
        averageRating = totalRating / totalReviews;
      }
    }
    
    // Clean up the event object
    const { eventTrainers, registrations: regs, reviews, ...eventData } = event;
    
    const formattedEvent = {
      ...eventData,
      trainers,
      registrations,
      pools,
      registeredUsers: registrations.length,
      isPast: new Date(event.eventDate).getTime() < now.getTime(),
      isDeadlinePassed: event.registrationDeadline ? new Date(event.registrationDeadline).setHours(23, 59, 59, 999) < now.getTime() : false,
      averageRating,
      totalReviews
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
async function fixEvent(request: Request, { params }: { params: RequestParams }) {
  const { id } = params;
  
  try {
    const data = await request.json();
    console.log("Received event data:", data);
    
    // Validate required fields - updated to check for either eventTime or time components
    if (!data.title || !data.eventDate || 
        (!data.eventTime && !(data.startTime && data.endTime))) {
      return NextResponse.json(
        { error: 'Title, event date, and event time are required' },
        { status: 400 }
      );
    }
    
    // First check if the event exists
    const existingEvent = await prisma.event.findUnique({
      where: { id },
      include: {
        eventTrainers: {
          include: {
            trainer: true
          }
        },
        pools: {
          include: {
            attendees: true
          }
        }
      }
    });
    
    if (!existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }
    
    // Check if pools are already assigned for this event
    const poolsAssigned = existingEvent.poolsAssigned && existingEvent.pools.length > 0;
    
    // Get existing trainer IDs
    const existingTrainerIds = existingEvent.eventTrainers.map(et => et.trainerId);
    
    // Get new trainer IDs from request that don't exist in the event yet
    const newTrainerIds = data.trainers ? 
      data.trainers.filter((trainerId: string) => !existingTrainerIds.includes(trainerId)) : 
      [];
    
    // Update the event with a transaction to ensure all related records are updated correctly
    const result = await prisma.$transaction(async (prisma) => {
      // Update the event
      let eventTime = '';
      
      // Format the event time properly
      if (data.eventTime) {
        // If eventTime is directly provided, use it
        eventTime = data.eventTime;
      } else if (data.startTime && data.endTime) {
        // Otherwise construct it from the components
        const startTime = data.startTime.includes(':') ? data.startTime : `${data.startTime}:00`;
        const endTime = data.endTime.includes(':') ? data.endTime : `${data.endTime}:00`;
        eventTime = `${startTime} ${data.startPeriod || 'AM'} - ${endTime} ${data.endPeriod || 'PM'}`;
      } else {
        // Fallback to existing time if no new time provided
        eventTime = existingEvent.eventTime;
      }
      
      const updatedEvent = await prisma.event.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
          eventDate: new Date(data.eventDate),
          eventTime: eventTime,
          location: data.location,
          maxCapacity: parseInt(data.maxCapacity) || 100,
          poolCapacity: parseInt(data.poolCapacity) || 50,
          price: parseFloat(data.price) || 0,
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
          const trainerConnections = data.trainers.map((trainerId: string) => ({
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
    
    // If pools are assigned and there are new trainers, add them to the zoom meeting
    if (poolsAssigned && newTrainerIds.length > 0) {
      try {
        // Find the main pool with meeting link
        const mainPool = existingEvent.pools.find(pool => pool.meetLink);
        
        if (mainPool && mainPool.meetLink) {
          // Get the meeting ID from the pool
          const meetingUrl = mainPool.meetLink;
          const meetingId = meetingUrl.includes('/j/') ? 
            meetingUrl.split('/j/')[1].split('?')[0] : null;
          
          if (meetingId) {
            // Get new trainer details
            const newTrainers = await prisma.trainer.findMany({
              where: {
                id: {
                  in: newTrainerIds
                }
              }
            });
            
            if (newTrainers.length > 0) {
              // Create a map of trainer emails to names
              const trainerNames: Record<string, string> = {};
              newTrainers.forEach(trainer => {
                if (trainer.email) {
                  trainerNames[trainer.email] = trainer.name;
                }
              });
              
              // Filter out trainers with no email
              const trainerEmails = newTrainers
                .map(trainer => trainer.email)
                .filter((email): email is string => email !== null && email.includes('@'));
              
              if (trainerEmails.length > 0) {
                // Add new trainers to the Zoom meeting
                const registrantUrls = await addParticipantsToZoomMeeting(
                  meetingId,
                  trainerEmails,
                  trainerNames
                );
                
                // Format date for WhatsApp template
                const eventDate = new Date(existingEvent.eventDate).toLocaleDateString('en-US', {
                  day: '2-digit',
                  month: 'long'
                });
                
                // Send meeting links to the new trainers
                for (const trainer of newTrainers) {
                  if (trainer.email && registrantUrls[trainer.email]) {
                    // Send WhatsApp notification with meeting link
                    await sendMeetLinkTrainerTemplate(
                      trainer.mobileNumber,
                      trainer.name,
                      existingEvent.title,
                      eventDate,
                      existingEvent.eventTime,
                      registrantUrls[trainer.email]
                    );
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error adding trainers to zoom meeting:', error);
        // Don't fail the request if adding trainers to the meeting fails
      }
    }
    
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
async function deleteEvent(request: Request, { params }: { params: RequestParams }) {
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

export const GET = withApiKey(getEvent)
export const PUT = withApiKey(fixEvent)
export const DELETE = withApiKey(deleteEvent)