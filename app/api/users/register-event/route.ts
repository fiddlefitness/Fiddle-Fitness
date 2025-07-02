// app/api/users/register-event/route.js
import { extractLast10Digits } from '@/lib/formatMobileNumber';
import { prisma } from '@/lib/prisma';
import { sendReferralSuccessMessageTemplate } from '@/lib/whatsapp';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    const mobileNumber = extractLast10Digits(data.mobileNumber);
    
    // Validate required fields
    if (!mobileNumber || !data.eventId) {
      return NextResponse.json(
        { error: 'Mobile number and event ID are required' },
        { status: 400 }
      );
    }
    
    // Find user by mobile number and get count of their registrations
    const user = await prisma.user.findUnique({
      where: {
        mobileNumber: mobileNumber
      },
      include: {
        _count: {
          select: { registeredEvents: true },
        },
      },
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
    if (event.maxCapacity && event.registrations.length >= event.maxCapacity) {
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
    
    // Only allow direct registration for free events or with proper verification
    if (event.price && event.price > 0 && !data.freeEvent) {
      // For paid events, direct registration is not allowed without payment verification
      // This endpoint should only be used for free events or called from the payment verification API
      return NextResponse.json(
        { error: 'Payment verification required for this event' },
        { status: 403 }
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

    // Check for referral bonus
    const referralBonus = 50;
    // user._count.registeredEvents will be 0 before this new registration is created
    // so if it's 0 and user was referred, this is their first event.
    if (user._count.registeredEvents === 0 && user.referredById) {
      const updatedReferrer = await prisma.user.update({
        where: { id: user.referredById },
        data: {
          fiddleFitnessCoins: {
            increment: referralBonus,
          },
        },
        select: { id: true, mobileNumber: true } // Select required fields from the updated record
      });

      // Notify the referrer using the data from updatedReferrer
      // No need for an additional findUnique call here
      if (updatedReferrer) { // Check if update was successful and returned a record
        try {
          if (updatedReferrer.mobileNumber) {
            await sendReferralSuccessMessageTemplate(updatedReferrer.mobileNumber);
            console.log(`Referral success message sent to ${updatedReferrer.mobileNumber}`);
          } else {
            console.warn(`Referrer (ID: ${updatedReferrer.id}) was updated but has no mobile number, cannot send WhatsApp notification.`);
          }
        } catch (whatsappError) {
          console.error('Failed to send referral success WhatsApp message:', whatsappError);
          // Do not block the registration process if WhatsApp message fails
        }
      }
    }
    
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
        },
        registrationDate: registration.createdAt
      }
    });
  } catch (error) {
    console.error('Error registering for event:', error);
    return NextResponse.json(
      { error: 'Failed to register for event: ' + (error as Error).message },
      { status: 500 }
    );
  }
}