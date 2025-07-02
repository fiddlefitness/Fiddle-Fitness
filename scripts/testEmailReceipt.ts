import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

// Function to send email receipt via Razorpay
async function sendEmailReceipt(paymentId: string, email: string): Promise<void> {
  try {
    console.log('Attempting to send email receipt...');
    console.log('Using payment ID:', paymentId);
    console.log('Sending to email:', email);

    // First, fetch the payment details to verify it exists
    const paymentResponse = await axios.get(
      `https://api.razorpay.com/v1/payments/${paymentId}`,
      {
        auth: {
          username: RAZORPAY_KEY_ID || '',
          password: RAZORPAY_KEY_SECRET || '',
        }
      }
    );

    console.log('Payment details:', paymentResponse.data);

    // Create a receipt for the payment
    const receiptResponse = await axios.post(
      'https://api.razorpay.com/v1/receipts',
      {
        payment_id: paymentId,
        type: 'receipt',
        email_to: [email],
        sms_to: [paymentResponse.data.contact],
        notes: {
          order_id: paymentResponse.data.order_id
        }
      },
      {
        auth: {
          username: RAZORPAY_KEY_ID || '',
          password: RAZORPAY_KEY_SECRET || '',
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Receipt created successfully:', receiptResponse.data);

    // Now send the email notification
    const emailResponse = await axios.post(
      `https://api.razorpay.com/v1/receipts/${receiptResponse.data.id}/notify`,
      {
        type: 'email',
        email: email
      },
      {
        auth: {
          username: RAZORPAY_KEY_ID || '',
          password: RAZORPAY_KEY_SECRET || '',
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Email notification sent successfully:', emailResponse.data);
  } catch (error: any) {
    console.error('Error sending email receipt:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Example usage
const paymentId = 'pay_QErBw8m8ZIm35v'; // Replace with your actual payment ID
const email = 'kapilworkspace23@gmail.com'; // Replace with the recipient's email

// Run the test
console.log('Starting email receipt test...');
sendEmailReceipt(paymentId, email)
  .then(() => console.log('Test completed'))
  .catch(error => console.error('Test failed:', error)); 