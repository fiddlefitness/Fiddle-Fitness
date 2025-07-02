import dotenv from 'dotenv'
// const axios = require('axios')
import axios from 'axios'

import Razorpay from 'razorpay'
const razorpay = new Razorpay({
  key_id: 'rzp_test_wLUxl3EJssPfjY',
  key_secret: 'VV5r6ioppZpfjefmUSpR74MT'
});


// Load environment variables
dotenv.config()

// Razorpay credentials - should be moved to env variables in production
const RAZORPAY_KEY_ID = 'rzp_test_wLUxl3EJssPfjY'
const RAZORPAY_KEY_SECRET = 'VV5r6ioppZpfjefmUSpR74MT'

// WhatsApp credentials
const WHATSAPP_TOKEN =
  process.env.WHATSAPP_TOKEN ||
  'EAAQpLM8tVZCQBO1ZAlZAmYY22oBsCczm5ZBbZAS8bn4A6GlF4ZBoKUse1VtYxkyZAT97MJpVSPzTSTJZAQYAx3SgzXRCQ8VszSZBtZBK4ZAUtGT1OxLNRxFXMcXaKid3zsXKhLCD3PA9o6OTAkcQZBeRgs0HjER7yNFg8OpJUF66yFZByIXJHYrXDx0ZArlG1GrWKrL4hCsAZDZD'
const WHATSAPP_PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID || '623332544193238'

// Function to fetch payment details
async function fetchPaymentDetails(paymentId) {
  try {
    console.log(`Fetching details for payment: ${paymentId}...`)
    const response = await axios.get(
      `https://api.razorpay.com/v1/payments/${paymentId}`,
      {
        auth: {
          username: RAZORPAY_KEY_ID,
          password: RAZORPAY_KEY_SECRET,
        },
      }
    )
    return response.data
  } catch (error) {
    console.error('Error fetching payment details:', error.response?.data || error.message)
    throw new Error('Failed to fetch payment details')
  }
}

// Function to check if an invoice exists for this payment
async function findInvoiceForPayment(paymentId) {
  try {
    console.log(`Looking for existing invoices for payment: ${paymentId}...`)
    const response = await axios.get(
      `https://api.razorpay.com/v1/invoices`,
      {
        params: {
          payment_id: paymentId,
        },
        auth: {
          username: RAZORPAY_KEY_ID,
          password: RAZORPAY_KEY_SECRET,
        },
      }
    )
    
    if (response.data.items && response.data.items.length > 0) {
      return response.data.items[0]
    }
    return null
  } catch (error) {
    console.error('Error finding invoice:', error.response?.data || error.message)
    return null
  }
}

// Function to create an invoice for an existing payment
async function createInvoiceForPayment(payment, orderId) {
  try {
    console.log('Creating new invoice for completed payment...')
    
    // Extract customer info from payment if available
    const customerName = payment.notes?.customer_name || 'Customer'
    const customerEmail = payment.notes?.customer_email || 'customer@example.com'
    const customerPhone = payment.contact || '9876543210'
    
    const response = await axios.post(
      'https://api.razorpay.com/v1/invoices',
      {
        type: 'invoice',
        description: `Receipt for payment ${payment.id}`,
        partial_payment: false,
        customer: {
          name: customerName,
          contact: customerPhone,
          email: customerEmail,
        },
        line_items: [
          {
            name: 'Payment Receipt',
            description: `Receipt for payment ID: ${payment.id}`,
            amount: payment.amount,
            currency: 'INR',
            quantity: 1,
          },
        ],
        sms_notify: 1,
        email_notify: 1,
        currency: 'INR',
        notes: {
          payment_id: payment.id,
          order_id: orderId,
        },
      },
      {
        auth: {
          username: RAZORPAY_KEY_ID,
          password: RAZORPAY_KEY_SECRET,
        },
      }
    )

    return response.data
  } catch (error) {
    console.error('Error creating invoice:', error.response?.data || error.message)
    throw new Error('Failed to generate invoice')
  }
}

// Function to send invoice via WhatsApp
async function sendInvoiceToWhatsApp(pdfUrl, recipientPhone) {
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
    console.error('Error sending invoice via WhatsApp:', error.response?.data || error.message)
    throw error
  }
}

// Function to generate receipt for a completed payment
async function generatePaymentReceipt(paymentId, orderId) {
  try {
    console.log('Generating receipt for completed payment...')
    
    // First, fetch payment details
    const payment = await fetchPaymentDetails(paymentId)
    
    // Generate a receipt using the Receipt API
    const response = await axios.post(
      'https://api.razorpay.com/v1/receipts',
      {
        payment_id: paymentId,
        email_to: [payment.email || "kapilbamotriya12345@gmail.com"],
        sms_to: [payment.contact || "8305387299"],
        type: "receipt",
        notes: {
          order_id: orderId
        }
      },
      {
        auth: {
          username: RAZORPAY_KEY_ID,
          password: RAZORPAY_KEY_SECRET,
        },
      }
    )

    return response.data
  } catch (error) {
    console.error('Error generating payment receipt:', error.response?.data || error.message)
    throw new Error('Failed to generate payment receipt')
  }
}

// Alternative: Function to get payment receipt URL
async function getPaymentReceiptUrl(paymentId) {
  try {
    console.log('Getting receipt URL for payment...')
    
    // Get the receipt URL directly from Razorpay
    const response = await axios.get(
      `https://api.razorpay.com/v1/payments/${paymentId}/receipt`,
      {
        auth: {
          username: RAZORPAY_KEY_ID,
          password: RAZORPAY_KEY_SECRET,
        },
        responseType: 'blob'  // This will handle the PDF response
      }
    )
    
    // If successful, create a URL to the receipt
    const receiptUrl = `https://api.razorpay.com/v1/payments/${paymentId}/receipt`
    return { url: receiptUrl }
    
  } catch (error) {
    console.error('Error getting payment receipt URL:', error.response?.data || error.message)
    throw new Error('Failed to get payment receipt URL')
  }
}

// Update the main function
async function testPaymentReceipt() {
    try {
      const paymentId = 'pay_QCxVEwLo5ZeUUx'
      const orderId = 'order_QCxV5cfpEYZgU5'
      const recipientPhone = '8305387299'
    
    console.log(`Working with payment ID: ${paymentId}`)
    
    // Method 1: Try to get the receipt URL
    try {
      const receipt = await getPaymentReceiptUrl(paymentId)
      console.log('Receipt URL:', receipt.url)
      
      // Send receipt link via WhatsApp
      await sendInvoiceToWhatsApp(receipt.url, recipientPhone)
      console.log(`Receipt link sent to ${recipientPhone}`)
      return
    } catch (error) {
      console.log('Could not get direct receipt URL, trying alternative method...')
    }
    
    // Method 2: Generate a receipt
    try {
      const receipt = await generatePaymentReceipt(paymentId, orderId)
      console.log('Generated receipt:', receipt)
      
      if (receipt.short_url || receipt.url) {
        const receiptUrl = receipt.short_url || receipt.url
        await sendInvoiceToWhatsApp(receiptUrl, recipientPhone)
        console.log(`Receipt link sent to ${recipientPhone}`)
      } else {
        console.log('No receipt URL available to send')
      }
    } catch (receiptError) {
      console.log('Failed to generate receipt, falling back to payment details...')
      
      // Method 3: Fallback - send payment details
      const payment = await fetchPaymentDetails(paymentId)
      const message = `Payment Receipt\n\nPayment ID: ${payment.id}\nAmount: ₹${payment.amount/100}\nStatus: ${payment.status}\nDate: ${new Date(payment.created_at * 1000).toLocaleString()}`
      
      await sendInvoiceToWhatsApp(message, recipientPhone)
      console.log(`Payment details sent to ${recipientPhone}`)
    }
    
  } catch (error) {
    console.error('Error in test:', error)
  }
}



async function generateReceiptForPayment(paymentId, amount, currency) {
  try {
    const receiptData = {
      receipt_number: `RCPT-${Date.now()}`,
      payment_id: paymentId,
      description: `Receipt for payment ${paymentId}`,
      notes: {
        payment_id: paymentId,
        amount: amount/100, // Convert from paisa to rupees
        currency: currency
      }
    };
    
    const receipt = await razorpay.receipts.create(receiptData);
    console.log('Receipt created:', receipt);
    
    return receipt;
  } catch (error) {
    console.error('Receipt generation failed:', error);
    throw error;
  }
}




const paymentId = 'pay_QCxVEwLo5ZeUUx'
const orderId = 'order_QCxV5cfpEYZgU5'
const recipientPhone = '8305387299'

generateReceiptForPayment(paymentId, 100, 'INR')

// Run the new test function
// testPaymentReceipt()
