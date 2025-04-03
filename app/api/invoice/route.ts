import { extractLast10Digits } from '@/lib/formatMobileNumber'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
})

export async function POST(request: NextRequest) {
  try {
    const { amount, eventId, mobileNumber } = await request.json()

    // Validate required fields
    if (!amount || !eventId || !mobileNumber) {
      return NextResponse.json(
        { message: 'Missing required parameters', isOk: false },
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
    })

    if (!event) {
      return NextResponse.json(
        { message: 'Event not found', isOk: false },
        { status: 404 },
      )
    }

    // Create invoice in Razorpay
    const invoice = await razorpay.invoices.create({
      amount: amount,
      currency: 'INR',
      description: `Registration for ${event.title}`,
      customer: {
        name: user.name,
        email: user.email || undefined,
        contact: user.mobileNumber,
      },
      notes: {
        eventId: eventId,
        userId: user.id,
      },
      terms: 'Registration fee for event',
      customer_details: {
        billing_address: {
          line1: user.address || '',
          city: user.city || '',
          state: user.state || '',
          zipcode: user.pincode || '',
          country: 'in',
        },
      },
    })

    // Store invoice in database
    const dbInvoice = await prisma.invoice.create({
      data: {
        invoiceId: invoice.id,
        amount: amount / 100, // Store in rupees, not paise
        status: 'created',
        userId: user.id,
        eventId: eventId,
        razorpayInvoiceId: invoice.id,
        invoiceUrl: invoice.short_url,
      },
    })

    return NextResponse.json(
      {
        message: 'Invoice created successfully',
        isOk: true,
        invoiceId: invoice.id,
        invoiceUrl: invoice.short_url,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Error creating invoice:', error)
    return NextResponse.json(
      { message: 'Failed to create invoice: ' + error.message, isOk: false },
      { status: 500 },
    )
  }
} 