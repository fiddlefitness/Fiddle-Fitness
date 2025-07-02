// Script to verify environment variables
import dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

// Initialize dotenv
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config();

// Check environment variables
console.log('Environment Variables Check:');
console.log('-'.repeat(50));
console.log('WHATSAPP_TOKEN exists:', process.env.WHATSAPP_TOKEN ? 'YES' : 'NO');
console.log('WHATSAPP_PHONE_NUMBER_ID exists:', process.env.WHATSAPP_PHONE_NUMBER_ID ? 'YES' : 'NO');
console.log('-'.repeat(50));

// Display masked tokens for verification
if (process.env.WHATSAPP_TOKEN) {
  const tokenLength = process.env.WHATSAPP_TOKEN.length;
  const maskedToken = process.env.WHATSAPP_TOKEN.substring(0, 4) + 
    '*'.repeat(tokenLength - 8) + 
    process.env.WHATSAPP_TOKEN.substring(tokenLength - 4);
  console.log('Token (masked):', maskedToken);
}

if (process.env.WHATSAPP_PHONE_NUMBER_ID) {
  console.log('Phone Number ID:', process.env.WHATSAPP_PHONE_NUMBER_ID);
}

console.log('-'.repeat(50)); 