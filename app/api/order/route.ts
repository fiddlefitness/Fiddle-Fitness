// app/api/order/route.ts
import { withApiKey } from '@/lib/authMiddleware';
import { extractLast10Digits } from '@/lib/formatMobileNumber';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

async function postOrder(request) {
  try {
    // Add debugging to check available prisma models
    console.log('Available Prisma models:', Object.keys(prisma));
    
    const { originalAmount, finalAmount, coinsUsed, eventId, mobileNumber } = await request.json();
    
    // Validate required fields
    if (typeof originalAmount !== 'number' || typeof finalAmount !== 'number' || typeof coinsUsed !== 'number' || !eventId || !mobileNumber) {
      return NextResponse.json(
        { error: 'originalAmount, finalAmount, coinsUsed, eventId, and mobileNumber are required and must be numbers where applicable.' },
        { status: 400 }
      );
    }
    
    // Verify event exists and fetch its price
    const formattedMobileNumber = extractLast10Digits(mobileNumber);
    
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });
    
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }
    
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { mobileNumber: formattedMobileNumber }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Verify the originalAmount matches the event price (converted to paise)
    const expectedOriginalAmount = parseFloat(event.price) * 100;
    if (originalAmount !== expectedOriginalAmount) {
      return NextResponse.json(
        { error: 'Original amount does not match event price' },
        { status: 400 }
      );
    }

    // Verify coinsUsed is not more than available or event price
    const actualCoinsUsed = Math.min(coinsUsed, user.fiddleFitnessCoins, parseFloat(event.price));
    const calculatedFinalAmount = expectedOriginalAmount - (actualCoinsUsed * 100);

    if (finalAmount !== Math.max(0, calculatedFinalAmount)) {
        return NextResponse.json(
            { error: 'Final amount calculation mismatch or invalid coins usage.' },
            { status: 400 }
        );
    }
    
    if (user.fiddleFitnessCoins < actualCoinsUsed && actualCoinsUsed > 0) {
        return NextResponse.json(
            { error: 'Insufficient Fiddle Fitness Coins.' },
            { status: 400 }
        );
    }
    
    // Check if user is already registered
    const existingRegistration = await prisma.eventRegistration.findFirst({
      where: {
        userId: user.id,
        eventId: event.id
      }
    });
    
    if (existingRegistration) {
      return NextResponse.json(
        { error: 'User is already registered for this event' },
        { status: 400 }
      );
    }

    // Initialize Razorpay
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // Create an order
    const order = await razorpay.orders.create({
      amount: finalAmount, // Use finalAmount (in paise) for Razorpay
      currency: 'INR',
      receipt: `rcpt_${user.mobileNumber}_${Date.now()}`,

      notes: {
        eventId: eventId,
        userId: user.id,
        coinsUsed: actualCoinsUsed.toString(), // Store coins used as string note
        originalAmount: (originalAmount / 100).toString()
      }
    });

    console.log('Razorpay order created:', order.id, 'for amount:', finalAmount);
    
    // Try-catch block specifically for the PaymentOrder creation
    try {
      console.log('Attempting to create payment order in database');
      // Check if PaymentOrder model exists on prisma
      if (!prisma.paymentOrder) {
        console.error('prisma.paymentOrder does not exist');
        // Find all available models
        console.log('Available models:', Object.keys(prisma));
        throw new Error('PaymentOrder model not found in Prisma client');
      }
      
      const savedOrder = await prisma.paymentOrder.create({
        data: {
          orderId: order.id,
          amount: finalAmount / 100, // Store final amount in rupees
          currency: 'INR',
          status: 'created',
          userId: user.id,
          eventId: event.id
        }
      });
      
      console.log('Payment order saved in database:', savedOrder.id);
    } catch (dbError) {
      // Log the error but continue - we don't want to fail the API call
      // if only the database recording fails
      console.error('Error saving order to database:', dbError);
      console.log('Continuing with order creation anyway');
    }

    return NextResponse.json({
      orderId: order.id,
      currency: order.currency,
      amount: order.amount, // This is finalAmount
    });
    
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order: ' + error.message },
      { status: 500 }
    );
  }
}

export const POST = withApiKey(postOrder)