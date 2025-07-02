// Script to test a single WhatsApp template
import dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { sendTextMessage, sendWelcomeAboardTemplate } from '../lib/whatsapp.ts';

// Initialize dotenv (with debugging)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config();

console.log('='.repeat(50));
console.log('ENVIRONMENT CHECK');
console.log('-'.repeat(50));
console.log('WHATSAPP_TOKEN exists:', process.env.WHATSAPP_TOKEN ? 'YES' : 'NO');
console.log('WHATSAPP_PHONE_NUMBER_ID exists:', process.env.WHATSAPP_PHONE_NUMBER_ID ? 'YES' : 'NO');
console.log('-'.repeat(50));

// Constants
const RECIPIENT_PHONE = '8305387299'; // Target phone number for testing

// Main function to execute the test
async function main() {
  try {
    console.log('Starting test for text message (simplest test)...');
    console.log('='.repeat(50));
    
    // Send template message
    const response = await sendWelcomeAboardTemplate(8305387399, 50, fdgrg)
    
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
    console.error('Full error:', error);
    console.log('='.repeat(50));
    console.error('Test failed');
    process.exit(1);
  }
}

// Run the test
main(); 