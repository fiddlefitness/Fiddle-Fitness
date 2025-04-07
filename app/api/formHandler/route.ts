// File: app/api/whatsapp/registration/route.js
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createUser } from '../users/route'
import { statesMapping, genderMapping } from './formDataMapping'

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
        return {
          ...SCREEN_RESPONSES.CONFIRMATION,
          data: {
            name: data.name,
            email: data.email,
            yob: data.yob,
            gender: genderName,
            state: stateName,
            phoneNumber: data.phoneNumber || '',
          },
        }

      // Handle when user completes CONFIRMATION screen
      case 'CONFIRMATION':
        // Process user registration
        try {
          // Format user data for createUser function
          const mobileNumber = extractLast10Digits(flow_token)
          const userRequest = {
            json: async () => ({
              name: data.name,
              email: data.email,
              yearOfBirth: String(data.yob) || null,
              gender: data.gender,
              state: data.state,
              mobileNumber,
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
    // const PRIVATE_KEY = process.env.WHATSAPP_FLOW_PRIVATE_KEY;
    const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC+FxVlOO/UAyv0
zqSvCifrTc/XyST1zE+UeTDt9K3a4KTXEiWhLJKptuv01Okz4s7g7rfiruhg31Jh
0n/QnaO2OyRro5F4kNGNEgaW7Xy+ZQWtA9mONakQLur1d0iJ/oufwEHMpZ0vWD+R
kyel0+PjRE1hU8NQq1tOW9RNsdsqq/LppJS+YhcKHgEiwR29fsYTcEgJ4qVK3yGg
tckBYXfGg6A9mvfoQ5Guc/9AMRvxag4aA8XdRXBioawMlpauJ3gdrdpkEDXzLCGn
jAABW+XdjC+sOJzCEv6NtofUM53HAZlH7Eg/AUEG2JlKalj68R+LwyuQx2x9Gl2E
1V980xZtAgMBAAECggEAAIzaf8AW6WZFgZr6Szf3Do8pvOAE6/OL6fov74qcPIxs
MGO7lcL7oLGExGERf2Zr+AptSuL74rUB4lfEqeLkQcdp/VLFL3CDpd93u+pE5RT2
1JpKDjk80PQ0CLuwIJc8m/IumT3ZXcNMmc4E7jh5e7HIABzQGBvgMt1kdTqOz8KN
itP+SKYmNR43l3AUGcbUdhxxrY4yuU4FUfcosJCt6WEw7nG+xKxEtRm+/pKYz07f
ZF8ilG7bRELVOWzvshcngiZc7Li0p/8cje7vqu9NjdxHtRzHNHOdOn1cmsvPOYg/
nGsua3rednymTIKCOplVESjFlurj9/FOaUtZuNqWwQKBgQDiZqTKBHHYwH0kxaje
H38PBG8MD0FlojNuILwZOKryJVDhIuOgKwf1GbTcMC+6ta+1wo7v83XfFfW1Si6k
n2HF6WIuP42iI+InL1a5bgOuWZWqnLBkzB/UWTl9I2x/xZxnWubzBLvjYJB67PJc
mup+CvoZpDo8t8RUEdr8/ycfQQKBgQDW8SnZ+p6HBuPxQoL/X0OVP/DWUH4oma7e
cPidc0Tay8HnEgF3ye3WVpSl8zRVZzEYxWg6/9OliKq1hTKWcL3D8AR/AaiRIzx9
PUDfb1vn0nW8DKo9uT1oqyBImACOkXUL1pV20sqY9hcTF11sNDu2sdlEIE+PvQSW
Q+DVc2SYLQKBgQCnYiXxacnV67JaLnzEBFtG+gszyk+aWYpWoIMQzpGsRyR93vKV
p1rRvji2FjYjf1IyOm69Pq1lyvGHIBpOAbwiu4KoGLqZJph8SgZ/P7QfAgKiSggr
7bKWp4TWXQtJiAszasSW5WgYGnuXNnmVN7+ogmsX7BBWdbMESNMz+1ysQQKBgBCl
1SwA8U5cBkOldyf4ZO+maCzxRxQ18wlfjqIDT43ywi33gw2YIke7pP/FeoQy3eah
Q5VuQyJLF42/p09npAsNCAweQMQdCo5YtDGaGnA2KNBL2tO1CUCWIIX+3+wq7/ne
wOzXHsICLX9ZC+9ZjFZ2J/HS3tavOS+6Siu+KEhxAoGBALQJZFdHzB/NniW36jw4
G4lh/StPGPrSm1MNcBLBLIOdl0p56Y8b3iOsane9UMRiKHEQwFxvufb5jijoJX+p
CWf4H03UbN/7Bwgelpp4xd4c7XLHPgvQVKCuDrpfrv0t5PWCrwBb324q9ouAUb/R
wXf3wtLxDH0PM7mvAhsCR+BS
-----END PRIVATE KEY-----`

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
