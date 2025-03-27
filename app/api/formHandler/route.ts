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
  REGISTRATION: {
    version: "3.0",
    screen: "REGISTRATION",
    data: {
        
    }
  },
  CONFIRMATION: {
    version: "3.0",
    screen: "CONFIRMATION",
    data: {}
  },
  COMPLETE: {
    version: "3.0",
    screen: "COMPLETE",
    data: {},
  },
   SUCCESS: {
    version: "3.0",
    screen: "SUCCESS",
    data: {
      extension_message_response: {
        params: {
          flow_token: "REPLACE_FLOW_TOKEN",
          some_param_name: "PASS_CUSTOM_VALUE",
        },
      },
    },
  },
};

/**
 * Decrypt the request body from WhatsApp Flow
 * @param {Object} body - The encrypted request body
 * @param {string} privatePem - The private key in PEM format
 * @returns {Object} Decrypted body and encryption parameters
 */
export function decryptRequest(body, privatePem) {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;

  // Decrypt the AES key created by the client
  const decryptedAesKey = crypto.privateDecrypt(
    {
      key: crypto.createPrivateKey(privatePem),
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(encrypted_aes_key, "base64"),
  );

  // Decrypt the Flow data
  const flowDataBuffer = Buffer.from(encrypted_flow_data, "base64");
  const initialVectorBuffer = Buffer.from(initial_vector, "base64");

  const TAG_LENGTH = 16;
  const encrypted_flow_data_body = flowDataBuffer.subarray(0, -TAG_LENGTH);
  const encrypted_flow_data_tag = flowDataBuffer.subarray(-TAG_LENGTH);

  const decipher = crypto.createDecipheriv(
    "aes-128-gcm",
    decryptedAesKey,
    initialVectorBuffer,
  );
  decipher.setAuthTag(encrypted_flow_data_tag);

  const decryptedJSONString = Buffer.concat([
    decipher.update(encrypted_flow_data_body),
    decipher.final(),
  ]).toString("utf-8");

  return {
    decryptedBody: JSON.parse(decryptedJSONString),
    aesKeyBuffer: decryptedAesKey,
    initialVectorBuffer,
  };
}

/**
 * Encrypt the response for WhatsApp Flow
 * @param {Object} response - The response object
 * @param {Buffer} aesKeyBuffer - The AES key buffer
 * @param {Buffer} initialVectorBuffer - The initialization vector buffer
 * @returns {string} Encrypted response as base64 string
 */
function encryptResponse(response, aesKeyBuffer, initialVectorBuffer) {
  // Flip the initialization vector
  const flipped_iv = [];
  for (const pair of initialVectorBuffer.entries()) {
    flipped_iv.push(~pair[1]);
  }
  
  // Encrypt the response data
  const cipher = crypto.createCipheriv(
    "aes-128-gcm",
    aesKeyBuffer,
    Buffer.from(flipped_iv),
  );
  
  return Buffer.concat([
    cipher.update(JSON.stringify(response), "utf-8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}

/**
 * Process the WhatsApp Flow request
 * @param {Object} decryptedBody - The decrypted request body
 * @returns {Object} The response object
 */
async function processFlowRequest(decryptedBody) {
  const { screen, action, data, flow_token, version } = decryptedBody;
  console.log('Processing decrypted request:', { screen, action, data });

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

  // Handle back navigation
  if (action === "BACK") {
    if (screen === "CONFIRMATION") {
      // Going back from confirmation to registration
      return {
        ...SCREEN_RESPONSES.REGISTRATION,
        data: {
          // Pre-fill the data from the confirmation screen
          name: data?.name || "",
          email: data?.email || "",
          age: data?.age || "",
          gender: data?.gender || "",
          city: data?.city || "",
          phoneNumber: data?.phoneNumber || ""
        }
      };
    }
    
    // Default back behavior
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
            ...SCREEN_RESPONSES.COMPLETE,
            data: {}
          };
        } catch (error) {
          console.error("Error creating user:", error);
          return {
            version: version || "3.0",
            screen: "CONFIRMATION",
            data: {
              name: data.name,
              email: data.email,
              age: data.age,
              gender: data.gender,
              city: data.city,
              phoneNumber: data.phoneNumber || "",
              error_message: "Failed to create user. Please try again."
            }
          };
        }
      
      default:
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
    const body = await request.json();
    console.log('Received encrypted request:', body);
    
    // Get the private key from environment variables
    const PRIVATE_KEY = process.env.WHATSAPP_FLOW_PRIVATE_KEY;
    
    if (!PRIVATE_KEY) {
      console.error('Missing WHATSAPP_FLOW_PRIVATE_KEY environment variable');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    // Decrypt the request
    const { decryptedBody, aesKeyBuffer, initialVectorBuffer } = decryptRequest(body, PRIVATE_KEY);
    console.log('Decrypted request body:', decryptedBody);
    
    // Process the request
    const responseData = await processFlowRequest(decryptedBody);
    
    // If the flow token needs to be included in the response
    if (responseData.data?.extension_message_response?.params?.flow_token === "REPLACE_FLOW_TOKEN") {
      responseData.data.extension_message_response.params.flow_token = decryptedBody.flow_token;
    }
    
    console.log('Response data before encryption:', responseData);
    
    // Encrypt the response
    const encryptedResponse = encryptResponse(responseData, aesKeyBuffer, initialVectorBuffer);
    
    // Return the encrypted response
    return new Response(encryptedResponse, {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
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