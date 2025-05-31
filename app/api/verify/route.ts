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
      amountPaid, // This is the final amount paid via Razorpay (in paise)
      coinsUsed,  // This is the value of coins used (e.g., 10 for ₹10)
    } = await request.json()

    // Validate required fields and types
    if (
      !orderCreationId ||
      !razorpayPaymentId ||
      !razorpaySignature ||
      !eventId ||
      !mobileNumber ||
      (typeof mobileNumber !== 'string' && typeof mobileNumber !== 'number') ||
      typeof amountPaid !== 'number' || // amountPaid is in paise
      typeof coinsUsed !== 'number'   // coinsUsed is in currency value (e.g., 10 for ₹10)
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

    // Verify payment amount
    // The amountPaid (from Razorpay) should be event.price - coinsUsed
    const eventPriceInPaise = parseFloat(event.price) * 100;
    const coinsUsedInPaise = coinsUsed * 100;
    
    // Recalculate expected final amount based on event price and coins used from request
    // Ensure coinsUsed does not exceed event price or user's balance (primary check on frontend and order API, re-verify here)
    const actualCoinsToDeduct = Math.min(coinsUsed, user.fiddleFitnessCoins, parseFloat(event.price));
    const expectedFinalAmountInPaise = eventPriceInPaise - (actualCoinsToDeduct * 100);

    if (amountPaid !== Math.max(0, expectedFinalAmountInPaise)) {
       console.error(`Amount mismatch: amountPaid from request ${amountPaid}, expectedFinalAmountInPaise ${expectedFinalAmountInPaise}, eventPriceInPaise ${eventPriceInPaise}, coinsUsed from request ${coinsUsed}, actualCoinsToDeduct ${actualCoinsToDeduct}`);
      return NextResponse.json(
        { message: 'Payment amount verification failed. Discrepancy in final amount.', isOk: false },
        { status: 400 },
      )
    }
    
    // Also verify against Razorpay's reported amount
    if (paymentDetails.amount !== amountPaid) {
        console.error(`Razorpay amount mismatch: paymentDetails.amount ${paymentDetails.amount}, amountPaid from request ${amountPaid}`);
        return NextResponse.json(
            { message: 'Payment amount does not match Razorpay record.', isOk: false },
            { status: 400 }
        );
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
        amount: amountPaid / 100, // Store actual paid amount in rupees
        coinsUsed: actualCoinsToDeduct, // Store coins used (currency value)
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

    // Deduct Fiddle Fitness Coins if used
    if (actualCoinsToDeduct > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          fiddleFitnessCoins: {
            decrement: actualCoinsToDeduct,
          },
        },
      });
      console.log(`Deducted ${actualCoinsToDeduct} coins from user ${user.id}. New balance: ${user.fiddleFitnessCoins - actualCoinsToDeduct}`);
    }

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
    }).format(amountPaid / 100)

    // Send confirmation message via WhatsApp
    let confirmationMessage = `Here's confirming the receipt of your payment for *${event.title}*.`;
    if (actualCoinsToDeduct > 0) {
        confirmationMessage += ` You used ${actualCoinsToDeduct} Fiddle Fitness Coins for a discount of ₹${actualCoinsToDeduct.toFixed(2)}.`;
    }
    confirmationMessage += ` Your official payment receipt will be sent to your email address.`;
    
    await sendTextMessage(
      user.mobileNumber,
      confirmationMessage
    )

    // After successful payment verification and before sending WhatsApp messages
    if (user.email) {
      await sendEmailReceipt(razorpayPaymentId, user.email);
    }

    // Follow-up message
    await sendTextMessage(
      user.mobileNumber,
      `Next steps: Event details will be shared 24 hours prior to the scheduled time. For assistance after receiving the link, reply to this WhatsApp number and click "Get Help." Please carefully review the instructions provided.`
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
    
    // Send failure message to user
    try {
      // Skip sending message since user data is not available in this scope
      console.error('Unable to send failure message - user data not available')
    } catch (msgError) {
      console.error('Error sending payment failure message:', msgError)
    }

    return NextResponse.json(
      { message: 'Internal server error', isOk: false },
      { status: 500 },
    )
  }
}