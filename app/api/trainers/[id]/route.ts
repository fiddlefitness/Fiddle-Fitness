// app/api/trainers/[id]/route.js
import { withApiKey } from '@/lib/authMiddleware';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';


// Get a specific trainer by ID
async function getTrainer(request, { params }) {
  const { id } = params;
  
  try {
    const trainer = await prisma.trainer.findUnique({
      where: { id },
      include: {
        events: {
          include: {
            event: true
          }
        },
        pools: {
          include: {
            event: true
          }
        }
      }
    });
    
    if (!trainer) {
      return NextResponse.json(
        { error: 'Trainer not found' },
        { status: 404 }
      );
    }
    
    // Process events data to make it more useful for the frontend
    const now = new Date();
    
    const upcomingEvents = trainer.events
      .filter(eventTrainer => new Date(eventTrainer.event.eventDate) > now)
      .map(eventTrainer => eventTrainer.event);
      
    const pastEvents = trainer.events
      .filter(eventTrainer => new Date(eventTrainer.event.eventDate) <= now)
      .map(eventTrainer => eventTrainer.event);
    
    const activePools = trainer.pools
      .filter(pool => pool.isActive)
      .map(pool => ({
        ...pool,
        eventTitle: pool.event.title,
        eventDate: pool.event.eventDate
      }));
    
    const { events, pools, ...trainerData } = trainer;
    
    return NextResponse.json({
      ...trainerData,
      upcomingEvents,
      pastEvents,
      activePools
    });
  } catch (error) {
    console.error('Error fetching trainer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trainer' },
      { status: 500 }
    );
  }
}

// Update a trainer
async function updateTrainer(request, { params }) {
  const { id } = params;
  
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.name || !data.mobileNumber) {
      return NextResponse.json(
        { error: 'Name and mobile number are required' },
        { status: 400 }
      );
    }
    
    // Check if trainer with same mobile number already exists (except current trainer)
    if (data.mobileNumber) {
      const existingTrainer = await prisma.trainer.findFirst({
        where: {
          mobileNumber: data.mobileNumber,
          NOT: {
            id: id
          }
        }
      });
      
      if (existingTrainer) {
        return NextResponse.json(
          { error: 'A trainer with this mobile number already exists' },
          { status: 409 }
        );
      }
    }
    
    // Update trainer
    const updatedTrainer = await prisma.trainer.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        mobileNumber: data.mobileNumber
      }
    });
    
    return NextResponse.json(updatedTrainer);
  } catch (error) {
    console.error('Error updating trainer:', error);
    return NextResponse.json(
      { error: 'Failed to update trainer' },
      { status: 500 }
    );
  }
}

// Delete a trainer
async function deleteTrainer(request, { params }) {
  const { id } = params;
  
  try {
    // Check if trainer exists
    const trainer = await prisma.trainer.findUnique({
      where: { id },
      include: {
        events: true,
        pools: true
      }
    });
    
    if (!trainer) {
      return NextResponse.json(
        { error: 'Trainer not found' },
        { status: 404 }
      );
    }
    
    // Check if trainer is assigned to any events or pools
    if (trainer.events.length > 0 || trainer.pools.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete trainer that is assigned to events or pools' },
        { status: 400 }
      );
    }
    
    // Delete trainer
    await prisma.trainer.delete({
      where: { id }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting trainer:', error);
    return NextResponse.json(
      { error: 'Failed to delete trainer' },
      { status: 500 }
    );
  }
}

export const GET = withApiKey(getTrainer)
export const PUT = withApiKey(updateTrainer)
export const DELETE = withApiKey(deleteTrainer)
