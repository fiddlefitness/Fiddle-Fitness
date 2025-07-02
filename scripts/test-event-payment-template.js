// Script to test sending the send_payment_link WhatsApp template message
import axios from 'axios';
import dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

// Initialize dotenv
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config();

// Constants
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERSION = 'v18.0'; // Meta Graph API version
const flowBaseUrl = `https://graph.facebook.com/${VERSION}/${PHONE_NUMBER_ID}`;
const RECIPIENT_PHONE = '8305387299'; // Target phone number from user's request

// Test data
const EVENT_TITLE = 'Zumba Dance Session';
const EVENT_DATE = 'Monday, April 1, 2024';
const EVENT_TIME = '6:00 PM - 7:00 PM';
const PAYMENT_ID = 'event12345'; // Example ID for the payment URL

/**
 * Send a WhatsApp template message with event details and payment link
 * @param {string} recipient - Recipient phone number
 * @param {string} eventTitle - Event title
 * @param {string} eventDate - Event date
 * @param {string} eventTime - Event time
 * @param {string} paymentId - Payment ID for the URL
 * @param {string} languageCode - Language code (default: 'en')
 */
async function sendPaymentLinkTemplate(
  recipient,
  eventTitle,
  eventDate,
  eventTime,
  paymentId,
  languageCode = 'en'
) {
  console.log('='.repeat(50));
  console.log('SENDING PAYMENT LINK TEMPLATE MESSAGE');
  console.log('-'.repeat(50));
  console.log(`Recipient: ${recipient}`);
  console.log(`Template: send_payment_link`);
  console.log(`Event Title: ${eventTitle}`);
  console.log(`Event Date: ${eventDate}`);
  console.log(`Event Time: ${eventTime}`);
  console.log(`Payment ID: ${paymentId}`);
  console.log('-'.repeat(50));

  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: 'send_payment_link',
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: eventTitle },
            { type: 'text', text: eventDate },
            { type: 'text', text: eventTime }
          ]
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            {
              type: 'text',
              text: paymentId
            }
          ]
        }
      ]
    }
  };

  try {
    console.log('Making API request...');
    console.log(JSON.stringify(data, null, 2));
    
    const response = await axios({
      method: 'POST',
      url: `${flowBaseUrl}/messages`,
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data
    });

    console.log('-'.repeat(50));
    console.log('SUCCESS!');
    console.log('Status Code:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));
    console.log('='.repeat(50));
    return response.data;
  } catch (error) {
    console.log('-'.repeat(50));
    console.log('ERROR!');
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    } else {
      // Something happened in setting up the request
      console.error('Error:', error.message);
    }
    console.log('='.repeat(50));
    throw error;
  }
}

// Main function to execute the test
async function main() {
  try {
    console.log('Starting test for send_payment_link template...');
    
    // Send template message
    await sendPaymentLinkTemplate(
      RECIPIENT_PHONE,
      EVENT_TITLE,
      EVENT_DATE,
      EVENT_TIME,
      PAYMENT_ID
    );
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
main(); 