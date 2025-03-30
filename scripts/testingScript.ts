import dotenv from 'dotenv'
// const axios = require('axios')
import axios from 'axios'

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

// Load environment variables
dotenv.config()

// Mock data
const mockUser = {
  id: '1',
  name: 'Test User',
  email: 'kapilbamotriya12345@gmail.com',
  mobileNumber: '9876543210',
}

const mockEvent = {
  id: '1',
  title: 'Test Fitness Event',
  description: 'A test fitness event for invoice generation',
  eventDate: '2024-02-01',
  eventTime: '10:00 AM',
  price: '1000',
}

const mockRazorpayPaymentId = 'pay_test123456'
const mockOrderCreationId = 'order_test123456'
const mockAmount = 100000 // Amount in paise (Rs. 1000)

async function testInvoiceGeneration() {
  try {
    console.log('Starting invoice generation test...')

    const invoice = await createInvoice(
      mockUser,
      mockEvent,
      mockRazorpayPaymentId,
      mockOrderCreationId,
      mockAmount,
    )

    console.log('Invoice generated successfully!')
    console.log('Invoice Details:', {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      shortUrl: invoice.short_url,
      status: invoice.status,
    })
    sendInvoiceToWhatsApp(invoice.short_url, '8305387299')

    console.log(invoice)
  } catch (error) {
    console.error('Error in test:', error)
  }
}

// Run the test
testInvoiceGeneration()

const WHATSAPP_TOKEN =
  process.env.WHATSAPP_TOKEN ||
  'EAAQpLM8tVZCQBO1ZAlZAmYY22oBsCczm5ZBbZAS8bn4A6GlF4ZBoKUse1VtYxkyZAT97MJpVSPzTSTJZAQYAx3SgzXRCQ8VszSZBtZBK4ZAUtGT1OxLNRxFXMcXaKid3zsXKhLCD3PA9o6OTAkcQZBeRgs0HjER7yNFg8OpJUF66yFZByIXJHYrXDx0ZArlG1GrWKrL4hCsAZDZD'
const WHATSAPP_PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID || '623332544193238'

// Add this function to send document via WhatsApp
async function sendInvoiceToWhatsApp(pdfUrl: string, recipientPhone: string) {
    try {
        const response = await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
            headers: {
                Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json',
            },
            data: {
                messaging_product: 'whatsapp',
                to: recipientPhone,
                type: 'text',
                text: {
                    body: `Here's your invoice: ${pdfUrl}`
                }
            },
        })

        console.log('Invoice sent successfully via WhatsApp:', response.data)
        return response.data
    } catch (error) {
        console.error('Error sending invoice via WhatsApp:', error)
        throw error
    }
}
