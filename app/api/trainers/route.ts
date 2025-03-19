// app/api/trainers/route.js
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';


export async function GET() {
  try {
    const trainers = await prisma.trainer.findMany({
      include: {
        events: {
          include: {
            event: true
          }
        },
        pools: true
      }
    });

    // Calculate upcoming and past events for each trainer
    const trainersWithEventCounts = trainers.map(trainer => {
      const now = new Date();
      
      // Count upcoming events (events where date is in the future)
      const upcomingEvents = trainer.events.filter(
        eventTrainer => new Date(eventTrainer.event.eventDate) > now
      ).length;
      
      // Count past events (events where date is in the past)
      const pastEvents = trainer.events.filter(
        eventTrainer => new Date(eventTrainer.event.eventDate) <= now
      ).length;
      
      // Remove the events relationship from the response to avoid sending too much data
      const { events, pools, ...trainerData } = trainer;
      
      return {
        ...trainerData,
        upcomingEvents,
        pastEvents
      };
    });

    return NextResponse.json(trainersWithEventCounts);
  } catch (error) {
    console.error('Error fetching trainers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trainers' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.name || !data.mobileNumber) {
      return NextResponse.json(
        { error: 'Name and mobile number are required' },
        { status: 400 }
      );
    }
    
    // Check if trainer with same mobile number already exists
    const existingTrainer = await prisma.trainer.findUnique({
      where: {
        mobileNumber: data.mobileNumber
      }
    });
    
    if (existingTrainer) {
      return NextResponse.json(
        { error: 'A trainer with this mobile number already exists' },
        { status: 409 }
      );
    }
    
    // Create new trainer
    const newTrainer = await prisma.trainer.create({
      data: {
        name: data.name,
        email: data.email,
        mobileNumber: data.mobileNumber
      }
    });
    
    return NextResponse.json(newTrainer, { status: 201 });
  } catch (error) {
    console.error('Error creating trainer:', error);
    return NextResponse.json(
      { error: 'Failed to create trainer' },
      { status: 500 }
    );
  }
}