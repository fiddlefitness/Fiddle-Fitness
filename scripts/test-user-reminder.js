// Script to test the user_reminder_2 template
import dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { sendUserReminder2Template } from '../lib/whatsapp.ts';

// Initialize dotenv
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config();

// Constants
const RECIPIENT_PHONE = '8305387299'; // Target phone number for testing
const EVENT_TITLE = 'Zumba Dance Session';
const MEET_LINK = 'https://us04web.zoom.us/j/71912345678?pwd=abcdefghijklmnopqrstuvwxyz123456';

// Main function to execute the test
async function main() {
  try {
    console.log('Starting test for user_reminder_2 template...');
    console.log('='.repeat(50));
    console.log('SENDING TEMPLATE MESSAGE');
    console.log('-'.repeat(50));
    console.log(`Recipient: ${RECIPIENT_PHONE}`);
    console.log(`Template: user_reminder_2`);
    console.log(`Event Title: ${EVENT_TITLE}`);
    console.log(`Meet Link: ${MEET_LINK}`);
    console.log('-'.repeat(50));
    
    // Send template message
    const response = await sendUserReminder2Template(
      RECIPIENT_PHONE,
      EVENT_TITLE,
      MEET_LINK
    );
    
    console.log('SUCCESS!');
    console.log('Response Data:', JSON.stringify(response, null, 2));
    console.log('='.repeat(50));
    console.log('Test completed successfully!');
  } catch (error) {
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