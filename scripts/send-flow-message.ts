// send-flow-message.js
// Script to send a WhatsApp template message with flow and handle responses
const axios = require('axios')
require('dotenv').config()

// WhatsApp Business API Configuration
const PHONE_NUMBER_ID = 623332544193238 // Your WhatsApp Business Phone Number ID
const ACCESS_TOKEN =
  'EAAQpLM8tVZCQBO1ZAlZAmYY22oBsCczm5ZBbZAS8bn4A6GlF4ZBoKUse1VtYxkyZAT97MJpVSPzTSTJZAQYAx3SgzXRCQ8VszSZBtZBK4ZAUtGT1OxLNRxFXMcXaKid3zsXKhLCD3PA9o6OTAkcQZBeRgs0HjER7yNFg8OpJUF66yFZByIXJHYrXDx0ZArlG1GrWKrL4hCsAZDZD' // Your permanent access token
const RECIPIENT_PHONE = '8076333861'
// const RECIPIENT_PHONE = ; // The phone number to send test messages to
const VERSION = 'v18.0' // Meta Graph API version
const BASE_URL = `https://graph.facebook.com/${VERSION}/${PHONE_NUMBER_ID}`

/**
 * Send a template message with a flow attached
 * @param {string} recipient The recipient's phone number (with country code, no +)
 * @param {string} templateName The name of the template containing the flow
 * @param {string} languageCode The language code for the template (default: en_US)
 */
async function sendFlowTemplate(recipient, templateName, languageCode = 'en') {
  try {
    console.log(`Sending flow template "${templateName}" to ${recipient}...`)

    const response = await axios({
      method: 'POST',
      url: `${BASE_URL}/messages`,
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'template',
        template: {
          name: 'enter_your_details',
          language: {
            code: 'en',
          },
          components: [
            // If your template has a header (image, document, video, or text)
            // {
            //   type: 'header',
            //   parameters: [
            //     // For text header
            //     {
            //       type: 'text',
            //       text: 'User Registration',
            //     },
            //     // For image header, use this instead:
            //     // {
            //     //     type: "image",
            //     //     image: {
            //     //         link: "https://example.com/your-image.jpg"
            //     //     }
            //     // }
            //   ],
            // },
            // If your template has body parameters (variables in double curly braces like {{1}})
            // {
            //   type: 'body',
            //   parameters: [
            //     {
            //       type: 'text',
            //       text: 'registration form',
            //     },
            //     // Add more parameters as needed based on your template
            //   ],
            // },
            // If your template has buttons
            {
              type: 'button',
              sub_type: 'FLOW',
              index: '0',
              parameters: [
                {
                  type: 'action',
                  action: {
                    flow_token: recipient, //optional, default is "unused"
                    flow_action_data: {
                      flow_action_payload: {
                        data: {
                          name: '',
                          email: '',
                          age: '',
                          gender: '',
                          city: '',
                          phoneNumber: '5232165232',
                        },
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    })

    console.log('Template message sent successfully!')
    console.log('Response:', JSON.stringify(response.data, null, 2))
    return response.data
  } catch (error) {
    console.error('Error sending template message:')
    if (error.response) {
      // The request was made and the server responded with a status code that falls out of the range of 2xx
      console.error('Error data:', error.response.data)
      // console.error('Status:', error.response.status);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request)
    } else {
      // Something happened in setting up the request that triggered an error
      console.error('Error message:', error.message)
    }
    throw error
  }
}

/**
 * Send a text message after flow completion
 * @param {string} recipient The recipient's phone number
 * @param {string} message The message to send
 */
async function sendFollowUpMessage(recipient, message) {
  try {
    console.log(`Sending follow-up message to ${recipient}...`)

    const response = await axios({
      method: 'POST',
      url: `${BASE_URL}/messages`,
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: {
          body: message,
        },
      },
    })

    console.log('Follow-up message sent successfully!')
    console.log('Response:', JSON.stringify(response.data, null, 2))
    return response.data
  } catch (error) {
    console.error('Error sending follow-up message:')
    if (error.response) {
      console.error('Error data:', error.response.data)
      console.error('Status:', error.response.status)
    } else if (error.request) {
      console.error('No response received:', error.request)
    } else {
      console.error('Error message:', error.message)
    }
    throw error
  }
}

/**
 * Handle webhook event for flow completion
 * This would be called by your webhook handler when it receives a flow completion event
 * @param {Object} flowEvent The flow completion event from the webhook
 */
async function handleFlowCompletion(flowEvent) {
  try {
    // Extract information from the flow completion event
    const phoneNumber =
      flowEvent.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id
    const flowToken =
      flowEvent.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.interactive
        ?.flow_reply?.flow_token
    const responsePayload =
      flowEvent.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.interactive
        ?.flow_reply?.response_payload

    console.log('Flow completed with data:', responsePayload)

    // Check if this is indeed a flow completion event
    if (flowToken && phoneNumber) {
      // Send a personalized follow-up message
      const userName = responsePayload?.name || 'there'
      await sendFollowUpMessage(
        phoneNumber,
        `Thank you ${userName} for completing your registration! Our team will review your information and get back to you soon.`,
      )

      // Here you could also:
      // 1. Store the registration data in your database
      // 2. Trigger any internal workflows
      // 3. Send notifications to your team

      return true
    }

    return false
  } catch (error) {
    console.error('Error handling flow completion:', error)
    throw error
  }
}

// Execute the script if run directly
if (require.main === module) {
  // Usage example
  const templateName = 'enter_your_details' // The name of your template containing the flow

  sendFlowTemplate(RECIPIENT_PHONE, templateName)
    .then(() => {
      console.log('Test message sent successfully!')
      console.log('Check your WhatsApp to see and interact with the flow.')
    })
    .catch(error => {
      //   console.error('Failed to send test message:', error);
    })
}

module.exports = {
  sendFlowTemplate,
  sendFollowUpMessage,
  handleFlowCompletion,
}
