// File: app/api/whatsapp/registration/route.js
import { NextResponse } from 'next/server';

import crypto from 'crypto';
import { createUser } from '../users/route';

// Function to extract the last 10 digits from a phone number
function extractLast10Digits(phoneNumber) {
  if (!phoneNumber) return null;
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  return digitsOnly.slice(-10);
}

// Pre-defined screen responses
const SCREEN_RESPONSES = {
  // Initial registration screen
  REGISTRATION: {
    version: "3.0",
    screen: "REGISTRATION",
    data: {}
  },
  // Confirmation screen with user details
  CONFIRMATION: {
    version: "3.0",
    screen: "CONFIRMATION",
    data: {}
  }
};

/**
 * Main handler for WhatsApp flow requests
 * Handles various actions: INIT, data_exchange, ping
 */
async function handleFlowRequest(body) {
  const { screen, action, data, version, flow_token } = body;
  
  // Handle health check request
  if (action === "ping") {
    return {
      version: version || "3.0",
      data: {
        status: "active"
      }
    };
  }

  // Handle error notification
  if (data?.error) {
    console.warn("Received client error:", data);
    return {
      version: version || "3.0",
      data: {
        acknowledged: true
      }
    };
  }

  // Handle initial request when opening the flow
  if (action === "INIT") {
    return {
      ...SCREEN_RESPONSES.REGISTRATION
    };
  }

  if (action === "data_exchange") {
    // Handle the request based on the current screen
    switch (screen) {
      // Handle when user completes REGISTRATION screen
      case "REGISTRATION":
        return {
          ...SCREEN_RESPONSES.CONFIRMATION,
          data: {
            name: data.name,
            email: data.email,
            age: data.age,
            gender: data.gender,
            city: data.city,
            phoneNumber: data.phoneNumber || ""
          }
        };
        
      // Handle when user completes CONFIRMATION screen
      case "CONFIRMATION":
        // Process user registration
        try {
          // Format user data for createUser function
          const userRequest = {
            json: async () => ({
              name: data.name,
              email: data.email,
              age: parseInt(data.age, 10) || null,
              gender: data.gender,
              city: data.city,
              mobileNumber: data.phoneNumber || extractLast10Digits(data.from)
            })
          };
          
          // Call the existing createUser function
          await createUser(userRequest);
          
          // Return success response
          return {
            version: version || "3.0",
            screen: "SUCCESS",
            data: {
              extension_message_response: {
                params: {
                  flow_token: flow_token,
                  registration_success: true
                }
              }
            }
          };
        } catch (error) {
          console.error("Error creating user:", error);
          return {
            version: version || "3.0",
            data: {
              error: "Failed to create user"
            }
          };
        }
      
      default:
        console.error(`Unhandled screen: ${screen}`);
        break;
    }
  }

  // Handle any unspecified action
  console.error("Unhandled request action:", action);
  throw new Error(
    "Unhandled endpoint request. Make sure you handle the request action & screen properly."
  );
}

/**
 * POST handler for the API route
 */
export async function POST(request) {
  try {
    // Parse the request body
    const body = await request.json();
    console.log('Received flow request:', JSON.stringify(body, null, 2));
    
    // Process the request
    const response = await handleFlowRequest(body);
    
    // Return the response
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing WhatsApp flow request:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET handler for health checks
 */
export async function GET(request) {
  return NextResponse.json(
    { status: 'healthy', timestamp: new Date().toISOString() },
    { status: 200 }
  );
}

/**
 * Note on Encryption:
 * 
 * The Meta example mentions encryption, but doesn't show the actual implementation.
 * If your WhatsApp Business Account requires encrypted responses, you'll need to:
 * 
 * 1. Obtain the encryption keys from your WhatsApp Business Account settings
 * 2. Implement encryption/decryption using those keys
 * 3. Decrypt incoming requests and encrypt outgoing responses
 * 
 * The encryption implementation would likely use AES or similar algorithm with
 * the keys provided by WhatsApp.
 */