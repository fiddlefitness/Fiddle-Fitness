// app/api/users/register-event/route.js
import { NextResponse } from 'next/server';
import {prisma} from '@/lib/prisma';

export async function POST(request) {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.mobileNumber || !data.eventId) {
      return NextResponse.json(
        { error: 'Mobile number and event ID are required' },
        { status: 400 }
      );
    }
    
    // Find user by mobile number
    const user = await prisma.user.findUnique({
      where: {
        mobileNumber: data.mobileNumber
      }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Please create an account first.' },
        { status: 404 }
      );
    }
    
    // Find event
    const event = await prisma.event.findUnique({
      where: {
        id: data.eventId
      },
      include: {
        registrations: true
      }
    });
    
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }
    
    // Check if registration is still open
    const now = new Date();
    if (event.registrationDeadline && new Date(event.registrationDeadline) < now) {
      return NextResponse.json(
        { error: 'Registration for this event has closed' },
        { status: 400 }
      );
    }
    
    // Check if event is already at capacity
    if (event.registrations.length >= event.maxCapacity) {
      return NextResponse.json(
        { error: 'This event has reached maximum capacity' },
        { status: 400 }
      );
    }
    
    // Check if user is already registered for this event
    const existingRegistration = await prisma.eventRegistration.findFirst({
      where: {
        userId: user.id,
        eventId: event.id
      }
    });
    
    if (existingRegistration) {
      return NextResponse.json(
        { error: 'You are already registered for this event' },
        { status: 400 }
      );
    }
    
    // Register user for the event
    const registration = await prisma.eventRegistration.create({
      data: {
        userId: user.id,
        eventId: event.id
      },
      include: {
        event: true,
        user: true
      }
    });
    
    // Return success response with registration details
    return NextResponse.json({
      success: true,
      message: 'Successfully registered for the event',
      registration: {
        id: registration.id,
        event: {
          id: registration.event.id,
          title: registration.event.title,
          eventDate: registration.event.eventDate,
          eventTime: registration.event.eventTime,
          location: registration.event.location || 'TBA'
        },
        registrationDate: registration.createdAt
      }
    });
  } catch (error) {
    console.error('Error registering for event:', error);
    return NextResponse.json(
      { error: 'Failed to register for event' },
      { status: 500 }
    );
  }
}