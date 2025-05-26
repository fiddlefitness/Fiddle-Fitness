// File: app/api/whatsapp/registration/route.js
import { extractReferralCode } from '@/lib/referralHelpers'
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createUser } from '../users/route'
import { genderMapping, statesMapping } from './formDataMapping'

// Function to extract the last 10 digits from a phone number
function extractLast10Digits(phoneNumber) {
  if (!phoneNumber) return null
  const digitsOnly = phoneNumber.replace(/\D/g, '')
  return digitsOnly.slice(-10)
}

// Pre-defined screen responses
const SCREEN_RESPONSES = {
  REGISTRATION: {
    screen: 'REGISTRATION',
    data: {},
  },
  CONFIRMATION: {
    screen: 'CONFIRMATION',
    data: {
      name: 'John Doe',
      email: 'john@example.com',
      yob: '30',
      gender: 'male',
      state: 'New York',
      phoneNumber: '',
    },
  },
  COMPLETE: {
    screen: 'COMPLETE',
    data: {
      name: 'John Doe',
      email: 'john@example.com',
      yob: '30',
      gender: 'male',
      state: 'New York',
      phoneNumber: '',
    },
  },
  SUCCESS: {
    screen: 'SUCCESS',
    data: {
      extension_message_response: {
        params: {
          flow_token: 'REPLACE_FLOW_TOKEN',
          some_param_name: 'PASS_CUSTOM_VALUE',
        },
      },
    },
  },
}

/**
 * Decrypt the request body from WhatsApp Flow
 * @param {Object} body - The encrypted request body
 * @param {string} privatePem - The private key in PEM format
 * @returns {Object} Decrypted body and encryption parameters
 */
export function decryptRequest(body, privatePem) {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body

  // Decrypt the AES key created by the client
  const decryptedAesKey = crypto.privateDecrypt(
    {
      key: crypto.createPrivateKey(privatePem),
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(encrypted_aes_key, 'base64'),
  )

  // Decrypt the Flow data
  const flowDataBuffer = Buffer.from(encrypted_flow_data, 'base64')
  const initialVectorBuffer = Buffer.from(initial_vector, 'base64')

  const TAG_LENGTH = 16
  const encrypted_flow_data_body = flowDataBuffer.subarray(0, -TAG_LENGTH)
  const encrypted_flow_data_tag = flowDataBuffer.subarray(-TAG_LENGTH)

  const decipher = crypto.createDecipheriv(
    'aes-128-gcm',
    decryptedAesKey,
    initialVectorBuffer,
  )
  decipher.setAuthTag(encrypted_flow_data_tag)

  const decryptedJSONString = Buffer.concat([
    decipher.update(encrypted_flow_data_body),
    decipher.final(),
  ]).toString('utf-8')

  return {
    decryptedBody: JSON.parse(decryptedJSONString),
    aesKeyBuffer: decryptedAesKey,
    initialVectorBuffer,
  }
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
  const flipped_iv = []
  for (const pair of initialVectorBuffer.entries()) {
    flipped_iv.push(~pair[1])
  }

  // Encrypt the response data
  const cipher = crypto.createCipheriv(
    'aes-128-gcm',
    aesKeyBuffer,
    Buffer.from(flipped_iv),
  )

  return Buffer.concat([
    cipher.update(JSON.stringify(response), 'utf-8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString('base64')
}

/**
 * Process the WhatsApp Flow request
 * @param {Object} decryptedBody - The decrypted request body
 * @returns {Object} The response object
 */
async function processFlowRequest(decryptedBody) {
  const { screen, action, data, flow_token, version } = decryptedBody
  console.log('Processing decrypted request:', { screen, action, data })

  console.log(flow_token)

  // Handle health check request
  if (action === 'ping') {
    return {
      version: version || '3.0',
      data: {
        status: 'active',
      },
    }
  }

  // Handle error notification
  if (data?.error) {
    console.warn('Received client error:', data)
    return {
      version: version || '3.0',
      data: {
        acknowledged: true,
      },
    }
  }

  // Handle initial request when opening the flow
  if (action === 'INIT') {
    return {
      ...SCREEN_RESPONSES.REGISTRATION,
    }
  }

  // Handle back navigation
  if (action === 'BACK') {
    if (screen === 'CONFIRMATION') {
      const state = statesMapping.find((state) => state.id === data?.state)
      const gender = genderMapping.find((gender) => gender.id === data?.gender)
      const stateName = state?.title || data?.state || ''
      const genderName = gender?.title || data?.gender || ''

      console.log('stateName', stateName)
      // Going back from confirmation to registration
      return {
        ...SCREEN_RESPONSES.REGISTRATION,
        data: {
          // Pre-fill the data from the confirmation screen
          name: data?.name || '',
          email: data?.email || '',
          yob: data?.yob || '',
          gender: genderName,
          state: stateName,
          phoneNumber: data?.phoneNumber || '',
          referral_code: data?.referral_code || '',
        },
      }
    }

    // Default back behavior
    return {
      ...SCREEN_RESPONSES.REGISTRATION,
    }
  }

  if (action === 'data_exchange') {
    // Handle the request based on the current screen
    const state = statesMapping.find((state) => state.id === data?.state)
    const stateName = state?.title || data?.state || ''
    const gender = genderMapping.find((gender) => gender.id === data?.gender)
    const genderName = gender?.title || data?.gender || ''

    switch (screen) {
      // Handle when user completes REGISTRATION screen
      case 'REGISTRATION':
        console.log(data, 'data in registration')
        
        // Handle referral code validation
        let referralMessage = data.referral_code || '';
        
        if (data.referral_code) {
          // Validate the referral code by calling createUser with isFormValidation flag
          const mobileNumber = extractLast10Digits(flow_token);
          
          try {
            const validationRequest = {
              json: async () => ({
                name: data.name,
                email: data.email,
                yearOfBirth: String(data.yob) || null,
                gender: data.gender,
                state: data.state,
                mobileNumber,
                referralCode: data.referral_code,
                isFormValidation: true
              }),
            };
            
            const response = await createUser(validationRequest);
            const responseData = await response.json();
            
            // If validation returned a formatted code or error message
            if (responseData.referralCode) {
              referralMessage = responseData.referralCode;
            } else {
              referralMessage = "INVALID CODE!";
            }
          } catch (error) {
            console.error("Error validating referral code:", error);
            referralMessage = "Error validating code";
          }
        }
        
        return {
          ...SCREEN_RESPONSES.CONFIRMATION,
          data: {
            name: data.name,
            email: data.email,
            yob: data.yob,
            gender: genderName,
            state: stateName,
            phoneNumber: data.phoneNumber || '',
            referral_code: referralMessage,
          },
        }

      // Handle when user completes CONFIRMATION screen
      case 'CONFIRMATION':
        // Process user registration
        try {
          // Format user data for createUser function
          const mobileNumber = extractLast10Digits(flow_token);
          
          // Extract just the code part if it's in the formatted form
          let referralCode = data.referral_code || null;
          if (referralCode && !referralCode.includes("INVALID")) {
            referralCode = extractReferralCode(referralCode);
          } else if (referralCode && referralCode.includes("INVALID")) {
            referralCode = null; // Don't use invalid codes
          }
          
          const userRequest = {
            json: async () => ({
              name: data.name,
              email: data.email,
              yearOfBirth: String(data.yob) || null,
              gender: data.gender,
              state: data.state,
              mobileNumber,
              referralCode: referralCode,
            }),
          }

          // Call the existing createUser function
          await createUser(userRequest)

          // Return success response
          return {
            ...SCREEN_RESPONSES.COMPLETE,
            data: {},
          }
        } catch (error) {
          console.error('Error creating user:', error)
          return {
            version: version || '3.0',
            screen: 'CONFIRMATION',
            data: {
              name: data.name,
              email: data.email,
              yob: data.yob,
              gender: data.gender,
              state: stateName,
              phoneNumber: data.phoneNumber || '',
              referral_code: data.referral_code || '',
              error_message: 'Failed to create user. Please try again.',
            },
          }
        }

      case 'COMPLETE': {
        // Return a JSON string for SUCCESS screen
        return {
          screen: 'SUCCESS',
          data: JSON.parse(JSON.stringify({
            extension_message_response: {
              params: {
                flow_token: decryptedBody.flow_token || 'unused',
                optional_param1: '<value1>',
                optional_param2: '<value2>',
              },
            },
          })),
        }
      }

      default:
        break
    }
  }

  // Handle any unspecified action
  console.error('Unhandled request action:', action)
  throw new Error(
    'Unhandled endpoint request. Make sure you handle the request action & screen properly.',
  )
}

/**
 * POST handler for the API route
 */
export async function POST(request) {
  try {
    const body = await request.json()
    console.log('Received encrypted request:', body)

    // Get the private key from environment variables
    const PRIVATE_KEY = process.env.WHATSAPP_FLOW_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!PRIVATE_KEY) {
      console.error('Missing WHATSAPP_FLOW_PRIVATE_KEY environment variable')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 },
      )
    }

    // Decrypt the request
    const { decryptedBody, aesKeyBuffer, initialVectorBuffer } = decryptRequest(
      body,
      PRIVATE_KEY,
    )
    console.log('Decrypted request body:', decryptedBody)

    // Process the request
    const responseData = await processFlowRequest(decryptedBody)

    // If the flow token needs to be included in the response
    if (
      responseData.data?.extension_message_response?.params?.flow_token ===
      'REPLACE_FLOW_TOKEN'
    ) {
      responseData.data.extension_message_response.params.flow_token =
        decryptedBody.flow_token
    }

    console.log('Response data before encryption:', JSON.stringify(responseData, null, 2))

    // Encrypt the response
    const encryptedResponse = encryptResponse(
      responseData,
      aesKeyBuffer,
      initialVectorBuffer,
    )

    // Return the encrypted response
    return new Response(encryptedResponse, {
      headers: {
        'Content-Type': 'text/plain',
      },
    })
  } catch (error) {
    console.error('Error processing WhatsApp flow request:', error)
    return NextResponse.json(
      { error: 'Failed to process request', details: error.message },
      { status: 500 },
    )
  }
}

/**
 * GET handler for health checks
 */
export async function GET(request) {
  return NextResponse.json(
    { status: 'healthy', timestamp: new Date().toISOString() },
    { status: 200 },
  )
}
