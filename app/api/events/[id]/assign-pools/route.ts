// app/api/events/[id]/assign-pools/route.js
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createGoogleMeet } from '@/lib/googleCalender'
import {
  sendAiSensyRequest,
  sendEventNotification,
} from '@/app/components/FiddleFitness'
import { withApiKey } from '@/lib/authMiddleware'
import { sendTextMessage } from '@/app/api/webhook/route'

function onNoMeetCreated() {
  console.log('No meet created, skipping pool assignment')
  throw new Error('No Google Meet link was created')
}

async function assignPools(request, { params }) {
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

    // Check if we have enough trainers
    const registeredUsers = event.registrations
    const trainers = event.eventTrainers.map(et => et.trainer)

    if (trainers.length === 0) {
      return NextResponse.json(
        { error: 'No trainers assigned to this event' },
        { status: 400 },
      )
    }

    // Calculate how many pools we need based on pool capacity
    const poolCapacity = event.poolCapacity || 100
    const totalRegisteredUsers = registeredUsers.length

    // If no users registered, return an error
    if (totalRegisteredUsers === 0) {
      return NextResponse.json(
        { error: 'No users registered for this event' },
        { status: 400 },
      )
    }

    // Calculate required pools (min 1, or based on capacity)
    const requiredPools = Math.max(
      1,
      Math.ceil(totalRegisteredUsers / poolCapacity),
    )

    // Check if we have enough trainers for the required pools
    if (requiredPools > trainers.length) {
      return NextResponse.json(
        {
          error: `Not enough trainers. Need ${requiredPools} pools but only have ${trainers.length} trainers`,
        },
        { status: 400 },
      )
    }

    // Start a transaction to handle pool creation and assignments
    const result = await prisma.$transaction(async tx => {
      // Randomize the order of registered users to ensure fair distribution
      const shuffledUsers = [...registeredUsers].sort(() => 0.5 - Math.random())

      // Split users into groups based on required pools
      const usersPerPool = Math.ceil(totalRegisteredUsers / requiredPools)
      const userGroups = []

      for (let i = 0; i < requiredPools; i++) {
        userGroups.push(
          shuffledUsers.slice(i * usersPerPool, (i + 1) * usersPerPool),
        )
      }

      // Create pools and assign users
      const createdPools = []
      for (let i = 0; i < requiredPools; i++) {
        const poolTrainer = trainers[i]
        const poolUsers = userGroups[i]
        const poolName = `Pool ${String.fromCharCode(65 + i)}` // Pool A, Pool B, etc.

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

        // Set start and end time for Google Meet
        const meetStartTime = new Date(event.eventDate)
        meetStartTime.setHours(startHour, startMinute, 0)

        const meetEndTime = new Date(event.eventDate)
        meetEndTime.setHours(endHour, endMinute, 0)

        console.log(meetStartTime, meetEndTime)

        // Get email addresses for Google Meet
        const userEmails = poolUsers
          .map(reg => reg.user.email)
          .filter(email => email && email.includes('@')) // Filter out invalid or missing emails

        const trainerEmail = poolTrainer.email

        // Only include valid emails
        const attendeeEmails = [...userEmails]
        if (trainerEmail && trainerEmail.includes('@')) {
          attendeeEmails.push(trainerEmail)
        }

        // Create Google Meet only if we have valid emails
        let meetLink = null
        let calendarEventId = null

        if (attendeeEmails.length > 0) {
          try {
            const meetData = await createGoogleMeet(
              `${event.title} - ${poolName}`,
              meetStartTime.toISOString(),
              meetEndTime.toISOString(),
              attendeeEmails,
            )

            console.log('meetData', meetData)

            if (!meetData || !meetData.meetLink) {
              onNoMeetCreated()
            }

            if (meetData) {
              meetLink = meetData.meetLink
              calendarEventId = meetData.eventId
            }
          } catch (error) {
            console.error(
              `Error creating Google Meet for pool ${poolName}:`,
              error,
            )
            // Continue even if meet creation fails, just without a meet link
            onNoMeetCreated()
          }
        }

        // Create pool in database
        const pool = await tx.pool.create({
          data: {
            name: poolName,
            capacity: poolCapacity,
            meetLink: meetLink,
            isActive: true,
            eventId: event.id,
            trainerId: poolTrainer.id,
          },
        })

        // Add users to the pool
        if (poolUsers.length > 0) {
          await tx.poolAttendee.createMany({
            data: poolUsers.map(reg => ({
              poolId: pool.id,
              userId: reg.userId,
              notified: false,
            })),
          })
        }

        // Send notifications to all users in this pool
        for (const registration of poolUsers) {
          const user = registration.user

          // Skip if user doesn't have a mobile number
          if (!user.mobileNumber) continue

          try {
            // Send notification to user
            sendTextMessage(
              user.mobileNumber,
              `🗓️ Mark your calendars!\n\n*${event.title}* - ${new Date(event.eventDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} 🎯\n\nYour pool details:\n👤 Trainer: ${poolTrainer.name}\n⏰ Time: ${event.eventTime}\n\n🔗 Meeting Link:\n${meetLink}\n\n🎉 Get ready for an amazing session! See you there! 💪`
            )

            // Mark user as notified
            await tx.poolAttendee.updateMany({
              where: {
                poolId: pool.id,
                userId: user.id,
              },
              data: {
                notified: true,
              },
            })
          } catch (error) {
            console.error(
              `Error sending notification to user ${user.id}:`,
              error,
            )
            // Continue even if notification fails for one user
          }
        }

        // Send notification to trainer about their pool assignment
        if (poolTrainer.mobileNumber) {
          await sendTextMessage(
            poolTrainer.mobileNumber,
            `🎯 New Pool Assignment Alert!\n\n*${event.title}*\n📅 Date: ${new Date(event.eventDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}\n⏰ Time: ${event.eventTime}\n👥 Pool: ${poolName}\n👤 Students: ${poolUsers.length}\n\n🔗 Meeting Link:\n${meetLink}\n\nPlease be ready to conduct the session! 💪`
          )
        }

        createdPools.push({
          ...pool,
          userCount: poolUsers.length,
          trainerName: poolTrainer.name,
        })
      }

      // Mark event as having pools assigned
      await tx.event.update({
        where: { id: event.id },
        data: {
          poolsAssigned: true,
          notificationSent: true,
        },
      })

      return createdPools
    })

    // Return success response with created pools
    return NextResponse.json({
      success: true,
      message: `Successfully created ${result.length} pools and assigned users`,
      pools: result,
    })
  } catch (error) {
    console.error('Error assigning pools:', error)
    return NextResponse.json(
      { error: 'Failed to assign pools: ' + error.message },
      { status: 500 },
    )
  }
}

// export  const POST = withApiKey(assignPools);
export const POST = assignPools
