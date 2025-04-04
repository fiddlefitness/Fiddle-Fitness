// app/api/verify/route.js
import { extractLast10Digits } from '@/lib/formatMobileNumber'
import { prisma } from '@/lib/prisma'
import axios from 'axios'
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const WHATSAPP_API_URL = `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`

// Types for payment data
interface PaymentData {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  vpa?: string;
  email: string;
  contact: string;
  description?: string;
  fee?: number;
  tax?: number;
  created_at: number;
  notes?: {
    eventId: string;
    userId: string;
  };
  card?: {
    network?: string;
    last4?: string;
  };
  bank?: string;
}

const generateSignature = (razorpayOrderId: string, razorpayPaymentId: string): string => {
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

async function fetchPaymentDetails(paymentId: string): Promise<PaymentData | null> {
  try {
    const response = await axios.get(
      `https://api.razorpay.com/v1/payments/${paymentId}`,
      {
        auth: {
          username: process.env.RAZORPAY_KEY_ID || '',
          password: process.env.RAZORPAY_KEY_SECRET || '',
        },
      }
    )
    return response.data
  } catch (error) {
    console.error('Error fetching payment details:', error)
    return null
  }
}

async function sendTextMessage(phoneNumber: string, message: string): Promise<void> {
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

async function sendPaymentReceiptMessage(paymentData: PaymentData, phoneNumber: string) {
  try {
    // Format the amount with currency symbol
    const formattedAmount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: paymentData.currency || 'INR'
    }).format(paymentData.amount / 100);

    // Format the date
    const paymentDate = new Date(paymentData.created_at * 1000).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Format payment method
    let paymentMethod = paymentData.method;
    if (paymentData.method === 'upi') {
      paymentMethod = `UPI (${paymentData.vpa})`;
    } else if (paymentData.method === 'card' && paymentData.card) {
      paymentMethod = `Card (${paymentData.card.network || 'Card'} ending in ${paymentData.card.last4 || 'XXXX'})`;
    } else if (paymentData.method === 'netbanking') {
      paymentMethod = `Net Banking (${paymentData.bank || 'Bank'})`;
    }

    // Build the receipt message
    const receiptMessage = 
      `📄 *PAYMENT RECEIPT*\n\n` +
      `💰 *Amount:* ${formattedAmount}\n` +
      `📅 *Date:* ${paymentDate}\n` +
      `💳 *Payment Method:* ${paymentMethod}\n` +
      `🆔 *Transaction ID:* ${paymentData.id}\n` +
      `📝 *Description:* ${paymentData.description || 'Event Registration'}\n\n` +
      `*Payment Status:* ✅ ${paymentData.status.toUpperCase()}\n\n` +
      `*Additional Details:*\n` +
      `• Fee: ₹${(paymentData.fee || 0) / 100}\n` +
      `• Tax: ₹${(paymentData.tax || 0) / 100}\n` +
      `• Contact: ${paymentData.contact}\n` +
      `• Email: ${paymentData.email}\n\n` +
      `Thank you for your payment! 🎉`;

    await sendTextMessage(phoneNumber, receiptMessage);
  } catch (error) {
    console.error('Error sending payment receipt:', error);
    throw error;
  }
}

// Function to send email receipt via Razorpay
async function sendEmailReceipt(paymentId: string, email: string): Promise<void> {
  try {
    const response = await axios.post(
      `https://api.razorpay.com/v1/payments/${paymentId}/email`,
      {
        email: email,
        cc: [], // Optional: Add CC emails if needed
        bcc: [] // Optional: Add BCC emails if needed
      },
      {
        auth: {
          username: process.env.RAZORPAY_KEY_ID || '',
          password: process.env.RAZORPAY_KEY_SECRET || '',
        },
      }
    );
    console.log('Email receipt sent successfully:', response.data);
  } catch (error) {
    console.error('Error sending email receipt:', error);
    // Don't throw error as this is not critical
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      orderCreationId,
      razorpayPaymentId,
      razorpaySignature,
      eventId,
      mobileNumber,
      amount,
    } = await request.json()

    // Validate required fields and types
    if (
      !orderCreationId ||
      !razorpayPaymentId ||
      !razorpaySignature ||
      !eventId ||
      !mobileNumber ||
      (typeof mobileNumber !== 'string' && typeof mobileNumber !== 'number')
    ) {
      return NextResponse.json(
        { message: 'Missing or invalid required parameters', isOk: false },
        { status: 400 },
      )
    }

    // Format mobile number - ensure it's a string
    const formattedMobileNumber = extractLast10Digits(
      typeof mobileNumber === 'number' ? mobileNumber.toString() : mobileNumber
    )

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

    // Get payment details from Razorpay
    const paymentDetails = await fetchPaymentDetails(razorpayPaymentId)
    if (!paymentDetails) {
      return NextResponse.json(
        { message: 'Failed to fetch payment details', isOk: false },
        { status: 400 },
      )
    }

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

    // Check if registration deadline has passed (including today)
    const now = new Date()
    now.setHours(0, 0, 0, 0) // Set time to midnight
    if (event.registrationDeadline && new Date(event.registrationDeadline).setHours(0, 0, 0, 0) < now.getTime()) {
      return NextResponse.json(
        { message: 'Registration deadline has passed', isOk: false },
        { status: 400 },
      )
    }

    // Verify payment amount matches event price
    if (amount !== parseFloat(event.price) * 100) {
      return NextResponse.json(
        { message: 'Payment amount does not match event price', isOk: false },
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

    // Format payment method text for message
    let paymentMethodText = ""
    if (paymentDetails) {
      if (paymentDetails.method === "card" && paymentDetails.card) {
        paymentMethodText = `${paymentDetails.card.network} card ending with ${paymentDetails.card.last4}`
      } else if (paymentDetails.method === "upi" && paymentDetails.vpa) {
        paymentMethodText = `UPI (${paymentDetails.vpa})`
      } else if (paymentDetails.method === "netbanking" && paymentDetails.bank) {
        paymentMethodText = `Netbanking (${paymentDetails.bank})`
      } else if (paymentDetails.method) {
        paymentMethodText = paymentDetails.method
      }
    }

    // Get Razorpay's receipt URL
    const receiptUrl = `https://rzp.io/r/${razorpayPaymentId}`

    // Store payment information
    const payment = await prisma.payment.create({
      data: {
        amount: amount / 100, // Store in rupees, not paise
        paymentId: razorpayPaymentId,
        orderId: orderCreationId,
        status: 'completed',
        userId: user.id,
        invoiceUrl: receiptUrl,
        paymentMethod: paymentDetails?.method || null
      },
    })

    // Create event registration
    const registration = await prisma.eventRegistration.create({
      data: {
        userId: user.id,
        eventId: event.id,
        paymentId: payment.id,
      },
      include: {
        event: true,
        user: true,
      },
    })

    // Format event date for message
    const eventDate = event.eventDate
      ? new Date(event.eventDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'TBD'

    // Format amount
    const formattedAmount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount / 100)

    // Send confirmation message via WhatsApp
    await sendTextMessage(
      user.mobileNumber,
      `🎉 *Payment Successful!* 🎉\n\nYou have successfully registered for *${event.title}*\n\n📅 Event Date: ${eventDate}\n⏰ Event Time: ${event.eventTime || 'TBD'}\n\nWe're excited to see you there! 🙌`
    )

    // Send detailed payment receipt
    await sendPaymentReceiptMessage(paymentDetails, user.mobileNumber)

    // After successful payment verification and before sending WhatsApp messages
    if (user.email) {
      await sendEmailReceipt(razorpayPaymentId, user.email);
    }

    // Follow-up message
    await sendTextMessage(
      user.mobileNumber,
      `Next steps: We'll share the event details and location shortly. For any questions, please contact our support team.`
    )

    return NextResponse.json(
      {
        message: 'Payment verified and registration successful',
        isOk: true,
        data: {
          registration,
          payment,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Error in payment verification:', error)
    return NextResponse.json(
      { message: 'Internal server error', isOk: false },
      { status: 500 },
    )
  }
}