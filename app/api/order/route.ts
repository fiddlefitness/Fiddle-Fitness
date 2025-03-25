// app/api/order/route.js
import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { prisma } from '@/lib/prisma';
import { extractLast10Digits } from '@/lib/formatMobileNumber';
import { withApiKey } from '@/lib/authMiddleware';

async function postOrder(request) {
  try {
    // Add debugging to check available prisma models
    console.log('Available Prisma models:', Object.keys(prisma));
    
    const { amount, eventId, mobileNumber } = await request.json();
    
    // Validate required fields
    if (!amount || !eventId || !mobileNumber) {
      return NextResponse.json(
        { error: 'Amount, eventId, and mobileNumber are required' },
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
    
    // Verify the amount matches the event price (converted to paise)
    const expectedAmount = parseFloat(event.price) * 100;
    if (amount !== expectedAmount) {
      return NextResponse.json(
        { error: 'Payment amount does not match event price' },
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
      amount: amount,
      currency: 'INR',
      receipt: `rcpt_${user.mobileNumber}_${Date.now()}`,

      notes: {
        eventId: eventId,
        userId: user.id
      }
    });

    console.log('Razorpay order created:', order.id);
    
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
          amount: amount / 100, // Store in rupees, not paise
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
      amount: order.amount,
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