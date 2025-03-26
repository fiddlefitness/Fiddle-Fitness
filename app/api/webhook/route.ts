import { NextResponse } from 'next/server';

// Webhook verification for WhatsApp
export async function GET(req) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Check if token and mode exist in the query
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
      // Respond with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      return new Response(challenge, {
        status: 200,
      });
    } else {
      // Respond with '403 Forbidden' if verify tokens do not match
      return new Response('Forbidden', {
        status: 403,
      });
    }
  }

  return new Response('Bad Request', {
    status: 400,
  });
}

// Process incoming messages
export async function POST(req) {
  try {
    const body = await req.json();

    // Check if this is a WhatsApp message
    if (body?.object && body?.entry?.length > 0) {
      const entry = body.entry[0];
      
      // Make sure it's a WhatsApp Business Account
      if (entry?.changes?.length > 0) {
        const change = entry.changes[0];
        
        if (change?.value?.messages?.length > 0) {
          const message = change.value.messages[0];
          const from = message.from; // User's phone number
          const messageId = message.id;
          
          console.log(`Received message from ${from}: ${JSON.stringify(message)}`);
          
          // Handle interactive messages (list selections)
          if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
            const selectedId = message.interactive.button_reply.id;
            console.log(`User selected event with ID: ${selectedId}`);
            
            // Here you would process the selection
            // await processEventSelection(from, selectedId);
            
            // Send a confirmation back to the user
            await sendTextMessage(from, `You selected event ID: ${selectedId}`);
          } 
          // Handle regular text messages
          else if (message.type === 'text') {
            const msgText = message.text.body;
            
            if (msgText.toLowerCase() === 'events') {
              // Send the event list when user requests events
              await sendEventList(from);
            } else {
              // Default response for other messages
              await sendTextMessage(from, `Echo: ${msgText}`);
            }
          }
        }
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response('Server Error', { status: 500 });
  }
}

// Function to send text messages
async function sendTextMessage(to, text) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: {
            body: text,
          },
        }),
      }
    );
    
    const data = await response.json();
    console.log('Message sent successfully:', data);
    return data;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

// Function to send event list
async function sendEventList(to) {
  try {
    // These would typically come from your database
    const events = [
      { 
        name: "Annual Conference 2025",
        id: "event_001"
      },
      { 
        name: "Workshop: Next.js Development",
        id: "event_002"
      },
      { 
        name: "Networking Mixer",
        id: "event_003"
      }
    ];
    
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
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
                  rows: events.map(event => ({
                    id: event.id,
                    title: event.name,
                    description: `Details for ${event.name}`
                  }))
                }
              ]
            }
          }
        }),
      }
    );
    
    const data = await response.json();
    console.log('Event list sent successfully:', data);
    return data;
  } catch (error) {
    console.error('Error sending event list:', error);
    throw error;
  }
}