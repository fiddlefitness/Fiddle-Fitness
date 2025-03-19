// app/api/events/[id]/assign-pools/route.js
import { NextResponse } from 'next/server';
import {prisma} from '@/lib/prisma';

export async function POST(request, { params }) {
  const { id } = params;
  
  try {
    const poolsConfig = await request.json();
    
    // Validate the input data
    if (!Array.isArray(poolsConfig) || poolsConfig.length === 0) {
      return NextResponse.json(
        { error: 'Invalid pools configuration' },
        { status: 400 }
      );
    }
    
    // Check if the event exists
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        registrations: true,
        pools: {
          include: {
            attendees: true
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
    
    // If pools are already assigned, only allow updates to existing pools
    if (event.poolsAssigned && event.pools.length > 0) {
      // Validate that all pool IDs are existing pools
      const existingPoolIds = event.pools.map(pool => pool.id);
      const newPoolIds = poolsConfig.map(pool => pool.id);
      
      const invalidPoolIds = newPoolIds.filter(pid => !existingPoolIds.includes(pid) && !pid.startsWith('new-'));
      
      if (invalidPoolIds.length > 0) {
        return NextResponse.json(
          { error: `Invalid pool IDs: ${invalidPoolIds.join(', ')}` },
          { status: 400 }
        );
      }
    }
    
    // Process the pools assignment with a transaction
    await prisma.$transaction(async (prisma) => {
      // First, handle any existing pools that need to be updated
      const existingPoolIds = event.pools.map(pool => pool.id);
      
      for (const poolConfig of poolsConfig) {
        if (existingPoolIds.includes(poolConfig.id)) {
          // Update existing pool
          await prisma.pool.update({
            where: { id: poolConfig.id },
            data: {
              name: poolConfig.name,
              capacity: parseInt(poolConfig.capacity) || 100,
              meetLink: poolConfig.meetLink,
              trainerId: poolConfig.trainerId,
              isActive: true
            }
          });
          
          // If attendees are specified, update the pool attendees
          if (poolConfig.attendees && poolConfig.attendees.length > 0) {
            // Delete existing attendees
            await prisma.poolAttendee.deleteMany({
              where: { poolId: poolConfig.id }
            });
            
            // Create new attendee connections
            const attendeeConnections = poolConfig.attendees.map(attendee => ({
              poolId: poolConfig.id,
              userId: attendee.userId || attendee.id
            }));
            
            if (attendeeConnections.length > 0) {
              await prisma.poolAttendee.createMany({
                data: attendeeConnections
              });
            }
          }
        } else if (poolConfig.id.startsWith('new-')) {
          // Create new pool
          const newPool = await prisma.pool.create({
            data: {
              name: poolConfig.name,
              capacity: parseInt(poolConfig.capacity) || 100,
              meetLink: poolConfig.meetLink,
              trainerId: poolConfig.trainerId,
              eventId: id,
              isActive: true
            }
          });
          
          // If attendees are specified, create the pool attendees
          if (poolConfig.attendees && poolConfig.attendees.length > 0) {
            const attendeeConnections = poolConfig.attendees.map(attendee => ({
              poolId: newPool.id,
              userId: attendee.userId || attendee.id
            }));
            
            if (attendeeConnections.length > 0) {
              await prisma.poolAttendee.createMany({
                data: attendeeConnections
              });
            }
          }
        }
      }
      
      // Mark the event as having pools assigned
      await prisma.event.update({
        where: { id },
        data: {
          poolsAssigned: true
        }
      });
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error assigning pools:', error);
    return NextResponse.json(
      { error: 'Failed to assign pools' },
      { status: 500 }
    );
  }
}