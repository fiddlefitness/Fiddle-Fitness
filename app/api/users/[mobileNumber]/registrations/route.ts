// app/api/users/[mobileNumber]/registrations/route.js
import { NextResponse } from 'next/server';
import {prisma} from '@/lib/prisma';
import { withApiKey } from '@/lib/authMiddleware';

async function getUserRegistrations(request, { params }) {  
  try {
    const { mobileNumber } = params;
    
    if (!mobileNumber) {
      return NextResponse.json(
        { error: 'Mobile number is required' },
        { status: 400 }
      );
    }
    
    // Find user by mobile number
    const user = await prisma.user.findUnique({
      where: {
        mobileNumber
      }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Get all registrations for the user
    const registrations = await prisma.eventRegistration.findMany({
      where: {
        userId: user.id
      },
      include: {
        event: {
          include: {
            eventTrainers: {
              include: {
                trainer: {
                  select: {
                    name: true
                  }
                }
              }
            },
            pools: {
              where: {
                attendees: {
                  some: {
                    userId: user.id
                  }
                }
              },
              include: {
                trainer: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Format the registrations data
    const now = new Date();
    
    const formattedRegistrations = registrations.map(reg => {
      const event = reg.event;
      const isPast = new Date(event.eventDate) < now;
      
      // Get trainers
      const trainers = event.eventTrainers.map(et => et.trainer.name);
      
      // Get pool information if user is assigned to a pool
      let poolInfo = null;
      if (event.pools && event.pools.length > 0) {
        const pool = event.pools[0]; // User can only be in one pool per event
        poolInfo = {
          name: pool.name,
          meetLink: pool.meetLink,
          trainer: pool.trainer ? pool.trainer.name : null
        };
      }
      
      return {
        id: reg.id,
        eventId: event.id,
        eventTitle: event.title,
        eventDescription: event.description,
        eventDate: event.eventDate,
        formattedDate: new Date(event.eventDate).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        }),
        eventTime: event.eventTime,

        price: event.price || 0,
        registrationDate: reg.createdAt,
        isPast,
        status: isPast ? 'Completed' : 'Upcoming',
        trainers,
        poolAssigned: !!poolInfo,
        pool: poolInfo
      };
    });
    
    // Split registrations into upcoming and past events
    const upcomingRegistrations = formattedRegistrations.filter(reg => !reg.isPast);
    const pastRegistrations = formattedRegistrations.filter(reg => reg.isPast);
    
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        mobileNumber: user.mobileNumber,
        email: user.email
      },
      registrations: {
        upcoming: upcomingRegistrations,
        past: pastRegistrations
      },
      totalRegistrations: registrations.length
    });
  } catch (error) {
    console.error('Error fetching user registrations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user registrations' },
      { status: 500 }
    );
  }
}

export const GET = withApiKey(getUserRegistrations);