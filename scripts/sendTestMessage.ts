// This script is for testing your WhatsApp API integration
import axios from 'axios'
import dotenv from 'dotenv'
import { createEventMessage, formatEventDetailsMessage } from '../lib/formatMessages'

dotenv.config()

// Configuration
const RECIPIENT_PHONE = '918305387299' // Add country code (91 for India)
const WHATSAPP_TOKEN =
  process.env.WHATSAPP_TOKEN ||
  'EAAQpLM8tVZCQBO1ZAlZAmYY22oBsCczm5ZBbZAS8bn4A6GlF4ZBoKUse1VtYxkyZAT97MJpVSPzTSTJZAQYAx3SgzXRCQ8VszSZBtZBK4ZAUtGT1OxLNRxFXMcXaKid3zsXKhLCD3PA9o6OTAkcQZBeRgs0HjER7yNFg8OpJUF66yFZByIXJHYrXDx0ZArlG1GrWKrL4hCsAZDZD'
const WHATSAPP_PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID || '623332544193238'

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
  };
  bank?: string;
}

// Function to send a sple text message
async function testVideoMessages() {
  try {
    console.log('Starting video compatibility tests...');
    
    // Array of test videos with different characteristics
    const testVideos = [
      {
        name: "Short MP4 (low res)",
        link: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
        caption: "Test 1: Short 5-second low-res MP4"
      },
      {
        name: "Short MOV",
        link: "https://filesamples.com/samples/video/mov/sample_640x360.mov",
        caption: "Test 2: Short MOV format video"
      },
      {
        name: "Small MP4 clip",
        link: "https://download.samplelib.com/mp4/sample-5s-640x360.mp4", 
        caption: "Test 3: Small MP4 clip (640x360)"
      },
      {
        name: "Marketplace verified video", 
        link: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        caption: "Test 4: Mozilla's sample video (known to work with many platforms)"
      }
    ];
    
    // Try each video
    for (const video of testVideos) {
      console.log(`Testing video: ${video.name}`);
      
      try {
        const videoResponse = await axios({
          method: 'POST',
          url: `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
          },
          data: {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: RECIPIENT_PHONE,
            type: 'video',
            video: {
              link: video.link,
              caption: video.caption,
            },
          },
          timeout: 10000 // 10 second timeout
        });
        
        console.log(`✅ Success for ${video.name}:`);
        console.log(JSON.stringify(videoResponse.data, null, 2));
      } catch (videoError: any) {
        console.error(`❌ Error with ${video.name}:`);
        if (videoError.response) {
          console.error('Status:', videoError.response.status);
          console.error('Error data:', JSON.stringify(videoError.response.data, null, 2));
        } else {
          console.error('Error message:', videoError.message);
        }
      }
      
      // Wait 3 seconds between attempts to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('Video testing completed.');
    
  } catch (error) {
    console.error('Error in video testing function:', error);
  }
}

// Run the test
testVideoMessages();

// Function to send an interactive button message (event details)
async function sendEventDetailsMessage() {
  // Hard-coded event details for testing
  const eventDetails = {
    title: 'Zumba Class with John',
    date: 'Monday, April 1, 2024',
    time: '6:00 PM - 7:00 PM',
    location: 'Online via Zoom',
    trainers: 'John Smith, Jane Doe',
    description:
      'Join our energetic Zumba session! Great for beginners and experienced dancers alike.',
    spotsRemaining: 15,
    maxCapacity: 25,
    isUserRegistered: false,
  }

  // Format the message using our utility function to ensure character limits
  const messageBody = formatEventDetailsMessage(eventDetails);

  // Build registration URL
  const registrationUrl = `https://yourdomain.com/events/123?source=whatsapp&userId=user123`;

  // Create the complete message
  const fullMessage = createEventMessage(eventDetails.title, messageBody, registrationUrl);

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
        recipient_type: 'individual',
        to: RECIPIENT_PHONE,
        type: 'text',
        text: {
          body: fullMessage
        }
      }
    })

    console.log('Event details message sent successfully:')
    console.log(JSON.stringify(response.data, null, 2))
  } catch (error) {
    logDetailedError('Event details message', error)
  }
}

// Function to test sending a list message (categories)
async function sendCategoriesListMessage() {
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
        recipient_type: 'individual',
        to: RECIPIENT_PHONE,
        type: 'interactive',
        interactive: {
          type: 'list',
          header: {
            type: 'text',
            text: 'Event Categories',
          },
          body: {
            text: 'Select a category to explore upcoming events and never miss out on activities that interest you!',
          },
          footer: {
            text: 'Reply with your selection',
          },
          action: {
            button: 'View Categories',
            sections: [
              {
                title: 'Available Categories',
                rows: [
                  {
                    id: 'cat_zumba',
                    title: 'Zumba (Endurance)',
                    description: 'Browse upcoming Zumba events',
                  },
                  {
                    id: 'cat_diet',
                    title: 'Diet Consultation',
                    description: 'Browse upcoming Diet Consultation events',
                  },
                ],
              },
            ],
          },
        },
      },
    })

    console.log('Categories list message sent successfully:')
    console.log(JSON.stringify(response.data, null, 2))
  } catch (error) {
    logDetailedError('Categories list message', error)
  }
}

// Helper function to log detailed error information
function logDetailedError(messageType: string, error: any) {
  console.error(`\n❌ ERROR SENDING ${messageType.toUpperCase()} ❌`)

  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    console.error('Status code:', error.response.status)
    console.error(
      'Response headers:',
      JSON.stringify(error.response.headers, null, 2),
    )
    console.error(
      'Response data:',
      JSON.stringify(error.response.data, null, 2),
    )

    // Check for specific WhatsApp error codes
    if (error.response.data && error.response.data.error) {
      console.error('\nWhatsApp API Error Details:')
      console.error(`Code: ${error.response.data.error.code}`)
      console.error(`Type: ${error.response.data.error.type}`)
      console.error(`Message: ${error.response.data.error.message}`)
      console.error(`FB trace ID: ${error.response.data.error.fbtrace_id}`)
    }
  } else if (error.request) {
    // The request was made but no response was received
    console.error('No response received. Request details:', error.request)
  } else {
    // Something happened in setting up the request that triggered an Error
    console.error('Error during request setup:', error.message)
  }

  // Log the request payload that caused the error
  if (error.config && error.config.data) {
    try {
      const requestData = JSON.parse(error.config.data)
      console.error('\nRequest payload that caused the error:')
      console.error(JSON.stringify(requestData, null, 2))
    } catch (e) {
      console.error('Could not parse request data:', error.config.data)
    }
  }
}

// Function to send a professional payment receipt message
async function sendPaymentReceiptMessage(paymentData: PaymentData) {
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
    } else if (paymentData.method === 'card') {
      paymentMethod = `Card (${paymentData.card?.network || 'Card'})`;
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

    // Send the receipt message
    const response = await axios({
      method: 'POST',
      url: `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: RECIPIENT_PHONE,
        type: 'text',
        text: {
          body: receiptMessage
        }
      }
    });

    console.log('Payment receipt sent successfully:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    logDetailedError('Payment receipt message', error);
  }
}

// Example usage with sample payment data
const samplePaymentData = {
  id: "pay_QEdFmrfUYpDAw1",
  amount: 1000,
  currency: "INR",
  status: "captured",
  method: "upi",
  vpa: "8076333861@ybl",
  email: "kapilworkspace23@gmail.com",
  contact: "+918305387299",
  description: "Registration for Zumba Blast",
  fee: 24,
  tax: 4,
  created_at: 1743693651,
  notes: {
    eventId: "cm91hse5g0000n3nny6bgs1ah",
    userId: "cm91hltre0000js0499mv13j0"
  }
};

// Uncomment to test
sendPaymentReceiptMessage(samplePaymentData);

// sendEventDetailsMessage()
// sendTextMessage()

