// app/api/events/[id]/assign-pools/route.js
import { sendTextMessage } from '@/app/api/webhook/route';
import { prisma } from '@/lib/prisma';
import { createZoomMeeting } from '@/lib/zoom';
import { NextResponse } from 'next/server';

interface RequestParams {
  id: string;
}

async function assignPools(request: Request, { params }: { params: RequestParams }) {
  const { id } = params

  try {
    // Fetch the event with registered users and trainers
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        registrations: {
          include: {
            user: true,
          },
        },
        eventTrainers: {
          include: {
            trainer: true,
          },
        },
        pools: true,
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Check if registration deadline has passed
    const now = new Date()
    const registrationDeadlinePassed =
      event.registrationDeadline && new Date(event.registrationDeadline) < now

    if (!registrationDeadlinePassed) {
      return NextResponse.json(
        {
          error:
            'Registration deadline has not passed yet. Pools cannot be assigned until registration closes.',
        },
        { status: 400 },
      )
    }

    // Check if we already have pools assigned
    if (event.poolsAssigned && event.pools.length > 0) {
      return NextResponse.json(
        { error: 'Pools are already assigned for this event' },
        { status: 400 },
      )
    }

    // Get all registered users and trainers
    const registeredUsers = event.registrations
    const trainers = event.eventTrainers.map(et => et.trainer)

    if (registeredUsers.length === 0) {
      return NextResponse.json(
        { error: 'No users registered for this event' },
        { status: 400 },
      )
    }

    // Start a transaction to handle pool creation and assignments
    const result = await prisma.$transaction(async tx => {
      // Parse event time (expecting format like "10:00 - 14:00")
      let startHour = 10
      let startMinute = 0
      let endHour = 11
      let endMinute = 0

      try {
        if (event.eventTime && event.eventTime.includes('-')) {
          const [startTimePart, endTimePart] = event.eventTime
            .split('-')
            .map(t => t.trim())

          // Parse start time with AM/PM
          const startTimeMatch = startTimePart.match(
            /(\d+):?(\d*)\s*([APap][Mm])?/,
          )
          if (startTimeMatch) {
            startHour = parseInt(startTimeMatch[1])
            startMinute = startTimeMatch[2] ? parseInt(startTimeMatch[2]) : 0

            // Handle PM for start time
            const startPeriod = startTimeMatch[3]?.toUpperCase() || 'AM'
            if (startPeriod === 'PM' && startHour < 12) {
              startHour += 12
            } else if (startPeriod === 'AM' && startHour === 12) {
              startHour = 0 // 12 AM is 0 in 24-hour format
            }
          }

          // Parse end time with AM/PM
          const endTimeMatch = endTimePart.match(
            /(\d+):?(\d*)\s*([APap][Mm])?/,
          )
          if (endTimeMatch) {
            endHour = parseInt(endTimeMatch[1])
            endMinute = endTimeMatch[2] ? parseInt(endTimeMatch[2]) : 0

            // Handle PM for end time
            const endPeriod = endTimeMatch[3]?.toUpperCase() || 'PM'
            if (endPeriod === 'PM' && endHour < 12) {
              endHour += 12
            } else if (endPeriod === 'AM' && endHour === 12) {
              endHour = 0 // 12 AM is 0 in 24-hour format
            }
          }
        }
      } catch (error) {
        console.error('Error parsing event time:', error)
        // Use default values if parsing fails
      }

      // Set start and end time for Zoom meeting
      const meetingStartTime = new Date(event.eventDate)
      meetingStartTime.setHours(startHour, startMinute, 0)

      // Calculate duration in minutes
      const duration = (endHour - startHour) * 60 + (endMinute - startMinute)

      // Get all participant emails (users and trainers)
      const userEmails = registeredUsers
        .map(reg => reg.user.email)
        .filter(email => email && email.includes('@')) // Filter out invalid or missing emails

      const trainerEmails = trainers
        .map(trainer => trainer.email)
        .filter(email => email && email.includes('@'))

      // Combine all participant emails
      const allParticipantEmails = [...userEmails, ...trainerEmails]

      if (allParticipantEmails.length === 0) {
        return NextResponse.json(
          { error: 'No participants found for this event' },
          { status: 400 },
        )
      }

      // Create Zoom meeting with all participants
      let meetingData = null
      if (allParticipantEmails && allParticipantEmails.length > 0) {
        try {
          meetingData = await createZoomMeeting(
            event.title,
            meetingStartTime.toISOString(),
            duration,
            allParticipantEmails.filter((email): email is string => email !== null),
            userEmails[0] // Use first user's email as host for now
          )

          if (!meetingData || !meetingData.meetingUrl) {
            throw new Error('Failed to create Zoom meeting')
          }
        } catch (error) {
          console.error('Error creating Zoom meeting:', error)
          throw new Error('Failed to create Zoom meeting')
        }
      }

      // Create a single pool with all participants
      const pool = await tx.pool.create({
        data: {
          name: 'Main Pool',
          capacity: event.poolCapacity || 100,
          meetLink: meetingData?.meetingUrl || null,
          isActive: true,
          eventId: event.id,
          trainerId: trainers[0]?.id || null, // Assign first trainer if available
        },
      })

      // Add all users to the pool
      if (registeredUsers.length > 0) {
        await tx.poolAttendee.createMany({
          data: registeredUsers.map(reg => ({
            poolId: pool.id,
            userId: reg.userId,
            notified: false,
            meetLink: meetingData?.registrantUrls[reg.user.email] || null,
          })),
        })
      }

      // Update event to mark pools as assigned
      await tx.event.update({
        where: { id: event.id },
        data: { poolsAssigned: true },
      })

      return {
        pool,
        meetingData,
      }
    })

    // Send notifications to all participants
    try {
      if (!('pool' in result)) {
        throw new Error('Failed to assign pools')
      }
      const pool = result.pool
      const meetingData = result.meetingData

      // Send notifications to users
      for (const registration of event.registrations) {
        const userMeetLink = meetingData?.registrantUrls[registration.user.email]
        if (userMeetLink) {
          await sendTextMessage(
            registration.user.mobileNumber,
            `You have been assigned to ${pool.name} for ${event.title}. Your unique meeting link is: ${userMeetLink}`,
          )
        }
      }

      // Send notifications to trainers
      for (const trainer of trainers) {
        const trainerMeetLink = trainer.email ? meetingData?.registrantUrls?.[trainer.email] : null
        if (trainerMeetLink) {
          await sendTextMessage(
            trainer.mobileNumber,
            `You have been assigned to ${pool.name} for ${event.title}. Your unique meeting link is: ${trainerMeetLink}`,
          )
        }
      }
    } catch (error) {
      console.error('Error sending notifications:', error)
      // Don't fail the request if notifications fail
    }

    return NextResponse.json({
      message: 'Pools assigned successfully',
      pool: result.pool,
    })
  } catch (error) {
    console.error('Error assigning pools:', error)
    return NextResponse.json(
      { error: 'Failed to assign pools' },
      { status: 500 },
    )
  }
}

export { assignPools as POST };

