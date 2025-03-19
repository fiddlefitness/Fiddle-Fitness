// app/api/users/route.js
import { NextResponse } from 'next/server';
import {prisma} from '@/lib/prisma';

// Get all users
export async function GET(request) {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// Create a new user
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
    
    // Check if user with same mobile number already exists
    const existingUser = await prisma.user.findUnique({
      where: {
        mobileNumber: data.mobileNumber
      }
    });
    
    let user;

    console.log(data.age)
    
    if (existingUser) {
      // Update existing user if needed
      user = await prisma.user.update({
        where: {
          id: existingUser.id
        },
        data: {
          name: data.name || existingUser.name,
          email: data.email || existingUser.email,
          city: data.city || existingUser.city,
          gender: data.gender || existingUser.gender,
        //   age: data.age ? parseInt(data.age) : existingUser.age
        }
      });
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          city: data.city,
          gender: data.gender,
          mobileNumber: data.mobileNumber,
        //   age: data.age ? parseInt(data.age) : null
        }
      });
    }
    
    // Get upcoming events
    const now = new Date();
    const upcomingEvents = await prisma.event.findMany({
      where: {
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
        // price: true,
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
    const formattedEvents = upcomingEvents.map(event => {
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
    
    // Return the user and upcoming events
    return NextResponse.json({
      user,
      upcomingEvents: formattedEvents
    }, { status: existingUser ? 200 : 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}