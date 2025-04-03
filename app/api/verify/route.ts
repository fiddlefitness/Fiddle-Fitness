// app/api/verify/route.js
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { extractLast10Digits } from '@/lib/formatMobileNumber'
import axios from 'axios'

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const WHATSAPP_API_URL = `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`

const generateSignature = (razorpayOrderId, razorpayPaymentId) => {
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keySecret) {
    throw new Error(
      'Razorpay key secret is not defined in environment variables.',
    )
  }
  const sig = crypto
    .createHmac('sha256', keySecret)
    .update(razorpayOrderId + '|' + razorpayPaymentId)
    .digest('hex')
  return sig
}

export async function POST(request) {
  try {
    const {
      orderCreationId,
      razorpayPaymentId,
      razorpaySignature,
      eventId,
      mobileNumber,
      amount,
    } = await request.json()

    // Validate required fields
    if (
      !orderCreationId ||
      !razorpayPaymentId ||
      !razorpaySignature ||
      !eventId ||
      !mobileNumber
    ) {
      return NextResponse.json(
        { message: 'Missing required parameters', isOk: false },
        { status: 400 },
      )
    }

    // Verify payment signature
    const expectedSignature = generateSignature(
      orderCreationId,
      razorpayPaymentId,
    )
    if (expectedSignature !== razorpaySignature) {
      return NextResponse.json(
        { message: 'Payment verification failed', isOk: false },
        { status: 400 },
      )
    }

    // Format mobile number
    const formattedMobileNumber = extractLast10Digits(mobileNumber)

    // Find user and event
    const user = await prisma.user.findUnique({
      where: {
        mobileNumber: formattedMobileNumber,
      },
    })

    if (!user) {
      return NextResponse.json(
        { message: 'User not found', isOk: false },
        { status: 404 },
      )
    }

    const event = await prisma.event.findUnique({
      where: {
        id: eventId,
      },
      include: {
        registrations: true,
      },
    })

    if (!event) {
      return NextResponse.json(
        { message: 'Event not found', isOk: false },
        { status: 404 },
      )
    }

    // Verify payment amount matches event price
    if (amount !== parseFloat(event.price) * 100) {
      return NextResponse.json(
        { message: 'Payment amount does not match event price', isOk: false },
        { status: 400 },
      )
    }

    // Check if registration is still open
    const now = new Date()
    if (
      event.registrationDeadline &&
      new Date(event.registrationDeadline) < now
    ) {
      return NextResponse.json(
        { message: 'Registration for this event has closed', isOk: false },
        { status: 400 },
      )
    }

    // Check if event is already at capacity
    if (event.maxCapacity && event.registrations.length >= event.maxCapacity) {
      return NextResponse.json(
        { message: 'This event has reached maximum capacity', isOk: false },
        { status: 400 },
      )
    }

    // Check if user is already registered for this event
    const existingRegistration = await prisma.eventRegistration.findFirst({
      where: {
        userId: user.id,
        eventId: event.id,
      },
    })

    if (existingRegistration) {
      return NextResponse.json(
        { message: 'You are already registered for this event', isOk: false },
        { status: 400 },
      )
    }

    // here genrate an invoice id with the corresnponding data of the user and the event, include the razorpay payment and order it in the invoice
    const invoice = await createInvoice(
      user,
      event,
      razorpayPaymentId,
      orderCreationId,
      amount,
    )
    const invoiceLink = invoice.short_url // Get the Razorpay invoice link

    // Store payment information
    const payment = await prisma.payment.create({
      data: {
        amount: amount / 100, // Store in rupees, not paise
        paymentId: razorpayPaymentId,
        orderId: orderCreationId,
        status: 'completed',
        userId: user.id,
        invoiceUrl: invoiceLink, // Store the invoice link
      },
    })

    // Link payment to registration
    // await prisma.eventRegistration.update({
    //   where: { id: registration.id },
    //   data: { paymentId: payment.id }
    // });

    // Send confirmation message with emoji and event date
    const eventDate = event.eventDate
      ? new Date(event.eventDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'TBD'

    // Since we don't have the Payment model yet, directly register the user without saving payment details
    const registration = await prisma.eventRegistration.create({
      data: {
        userId: user.id,
        eventId: event.id,
        paymentId: payment.id, // Assuming you have a paymentId field in your EventRegistration model
        // No paymentId since the model doesn't have that field yet
      },
      include: {
        event: true,
        user: true,
      },
    })

    await sendTextMessage(
      user.mobileNumber,
      `🎉🎉 Woohoo! Payment confirmed! \n🎉 Congratulations! 🎉\n\nYou have successfully registered for *${event.title}*\n\n📅 Event Date: ${eventDate}\n\n📅 Event Time: ${event.eventTime}\n\n🧾 Invoice: ${invoiceLink}\n\nWe're excited to see you there! 🙌`,
    )
    await sendTextMessage(
      user.mobileNumber,
      `Next steps: We'll share your event details shortly`,
    )

    return NextResponse.json(
      {
        message: 'Payment verified successfully and registration completed',
        isOk: true,
        registration: {
          id: registration.id,
          event: {
            id: registration.event.id,
            title: registration.event.title,
          },
          user: {
            id: registration.user.id,
            name: registration.user.name,
          },
          registrationDate: registration.createdAt,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Error verifying payment:', error)
    return NextResponse.json(
      { message: 'Payment verification failed: ' + error.message, isOk: false },
      { status: 500 },
    )
  }
}

async function sendTextMessage(phoneNumber: string, message: string) {
  try {
    const response = await axios({
      method: 'POST',
      url: WHATSAPP_API_URL,
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: {
          body: message,
        },
      },
    })
  } catch (error) {
    console.error('Error sending text message:', error)
    throw error
  }
}


const createInvoice = async (
  user,
  event,
  razorpayPaymentId,
  orderCreationId,
  amount,
) => {
  try {
    const response = await axios.post(
      'https://api.razorpay.com/v1/invoices',
      {  
        type: 'invoice',
        description: `Invoice for ${event.title}`,
        partial_payment: false,
        customer: {
          name: user.name,
          contact: user.mobileNumber,
          email: user.email,
        },
        line_items: [
          {
            name: event.title,
            description: event.description || '',
            amount: amount,
            currency: 'INR',
            quantity: 1,
          },
        ],
        sms_notify: 1,
        email_notify: 1,
        currency: 'INR',
        notes: {
          payment_id: razorpayPaymentId,
          order_id: orderCreationId,
        },
      },
      {
        auth: {
          username: 'rzp_test_wLUxl3EJssPfjY',
          password: 'VV5r6ioppZpfjefmUSpR74MT',
        },
      },
    )

    return response.data
  } catch (error) {
    console.error('Error creating invoice:', error)
    throw new Error('Failed to generate invoice')
  }
}
