// This script is for testing your WhatsApp API integration
require('dotenv').config();
const axios = require('axios');

// Replace with the phone number you want to send a message to
const RECIPIENT_PHONE = '8305387299';
const WHATSAPP_TOKEN = 'EAAQpLM8tVZCQBOwHsJjUAVq780pjo4ek2KZC1hTcJELTCMMhkMig0snW4eJiR4lZB86H4alDJXRwGWUsGs4hYyj3QFApIaz5g6zZAH3KvhY4OfazbVPe5DNXU63dFdszgnV2lGLVchrswlSBp2Gw3ZCZBMqmHXLZBz27XWxYFsvbSZA6ZBOdrP5ysVZAU1uIHnX20XnSgLrt4NuwOjQ4ZCwz7EVkVjZBc4Dgl5ZAXfOYZD'
const WHATSAPP_PHONE_NUMBER_ID = 623332544193238


async function sendMessage() {
    console.log(process.env.WHATSAPP_TOKEN)
  try {
    const response = await axios({
      method: 'POST',
      url: `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        to: RECIPIENT_PHONE,
        type: 'text',
        text: {
          body: 'Hello! This is a test message from your WhatsApp bot.',
        },
      },
    });

    console.log('Message sent successfully:', response.data);
  } catch (error) {
    console.error('Error sending message:', error.response ? error.response.data : error.message);
  }
}

async function sendEventList() {
  try {
    const response = await axios({
      method: 'POST',
      url: `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
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
            text: 'Available Events'
          },
          body: {
            text: 'Please select an event you\'re interested in:'
          },
          footer: {
            text: 'Tap to select an event'
          },
          action: {
            button: 'View Events',
            sections: [
              {
                title: 'Upcoming Events',
                rows: [
                  {
                    id: 'event_001',
                    title: 'Annual Conference 2025',
                    description: 'Our flagship annual event'
                  },
                  {
                    id: 'event_002',
                    title: 'Next.js Workshop', // Fixed: Title was too long (max 24 chars)
                    description: 'Learn advanced Next.js techniques'
                  },
                  {
                    id: 'event_003',
                    title: 'Networking Mixer',
                    description: 'Connect with industry professionals'
                  }
                ]
              }
            ]
          }
        }
      },
    });

    console.log('Event list sent successfully:', response.data);
  } catch (error) {
    console.error('Error sending event list:', error.response ? error.response.data : error.message);
  }
}

// Run the tests
// sendMessage();
// Uncomment to test sending an event list
sendEventList();