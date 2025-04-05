// Script to test sending the send_event_meet_link WhatsApp template message
import dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { sendEventMeetLinkTemplate } from '../lib/whatsapp.ts';

// Initialize dotenv
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config();

// Constants
const RECIPIENT_PHONE = '8305387299'; // Target phone number from user's request

// Test data from the image
const EVENT_TITLE = 'Event Title';
const EVENT_DATE = '04 April';
const EVENT_TIME = '10:00 AM';
const TRAINER_NAME = 'Kapil Bamotriya';
const MEET_LINK = 'https://us04web.zoom.us/j/71912345678?pwd=abcdefghijklmnopqrstuvwxyz123456';

// Main function to execute the test
async function main() {
  try {
    console.log('Starting test for send_event_meet_link template...');
    console.log('='.repeat(50));
    console.log('SENDING TEMPLATE MESSAGE');
    console.log('-'.repeat(50));
    console.log(`Recipient: ${RECIPIENT_PHONE}`);
    console.log(`Template: send_event_meet_link (Utility - Order Status)`);
    console.log(`Event Title: ${EVENT_TITLE}`);
    console.log(`Event Date: ${EVENT_DATE}`);
    console.log(`Event Time: ${EVENT_TIME}`);
    console.log(`Trainer Name: ${TRAINER_NAME}`);
    console.log(`Meet Link: ${MEET_LINK}`);
    console.log('-'.repeat(50));
    
    // Send template message using the library function
    const response = await sendEventMeetLinkTemplate(
      RECIPIENT_PHONE,
      EVENT_TITLE,
      EVENT_DATE,
      EVENT_TIME,
      TRAINER_NAME,
      MEET_LINK
    );
    
    console.log('-'.repeat(50));
    console.log('SUCCESS!');
    console.log('Response Data:', JSON.stringify(response, null, 2));
    console.log('='.repeat(50));
    console.log('Test completed successfully!');
  } catch (error) {
    console.log('-'.repeat(50));
    console.log('ERROR!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    console.log('='.repeat(50));
    console.error('Test failed');
    process.exit(1);
  }
}

// Run the test
main();