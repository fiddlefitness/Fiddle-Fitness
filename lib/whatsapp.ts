/**
 * WhatsApp template message utilities
 * Provides functions to send various WhatsApp templates
 */
import axios from 'axios';
import { truncateBody, truncateButtonText, truncateHeader, truncateTemplateParam } from './whatsappLimits';

// Constants for WhatsApp API - using process.env directly for reliability
const getToken = () => process.env.WHATSAPP_TOKEN;
const getPhoneNumberId = () => process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERSION = 'v18.0'; // Meta Graph API version
const getBaseUrl = () => `https://graph.facebook.com/${VERSION}/${getPhoneNumberId()}`;

/**
 * Send a WhatsApp template message with event details
 * 
 * @param recipient - Recipient's phone number
 * @param eventTitle - Title of the event
 * @param eventDate - Date of the event
 * @param eventTime - Time of the event
 * @param trainerName - Name of the trainer
 * @param meetLink - Zoom meeting link
 * @param languageCode - Language code (default: 'en')
 * @returns API response data
 */

// is used in assign pools when the meet link is created
export async function sendEventMeetLinkTemplate(
  recipient: string,
  eventTitle: string,
  eventDate: string,
  eventTime: string,
  trainerName: string,
  meetLink: string,
  languageCode: string = 'en'
) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: 'send_event_meet_link',
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: truncateTemplateParam(eventTitle) },
            { type: 'text', text: truncateTemplateParam(eventDate) },
            { type: 'text', text: truncateTemplateParam(eventTime) },
            { type: 'text', text: truncateTemplateParam(trainerName) },
            { type: 'text', text: truncateTemplateParam(meetLink) }
          ]
        }
      ]
    }
  };

  try {
    const response = await axios({
      method: 'POST',
      url: `${getBaseUrl()}/messages`,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      data
    });
    
    return response.data;
  } catch (error) {
    console.error('Error sending event meet link template:', error);
    throw error;
  }
}

/**
 * Send a simple text message via WhatsApp
 * 
 * @param recipient - Recipient's phone number
 * @param message - Text message to send
 * @returns API response data
 */
export async function sendTextMessage(
  recipient: string, 
  message: string
) {
  try {
    const response = await axios({
      method: 'POST',
      url: `${getBaseUrl()}/messages`,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'text',
        text: {
          body: message,
        },
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('Error sending text message:', error);
    throw error;
  }
}

/**
 * Send a welcome message template 
 * 
 * @param recipient - Recipient's phone number
 * @param imageUrl - URL for header image
 * @param languageCode - Language code (default: 'en')
 * @returns API response data
 */
export async function sendWelcomeMessageTemplate(
  recipient: string,
  imageUrl: string,
  languageCode: string = 'en'
) {
  try {
    const response = await axios({
      method: 'POST',
      url: `${getBaseUrl()}/messages`,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'template',
        template: {
          name: 'welcome_message_with_img',
          language: { code: languageCode },
          components: [
            {
              type: 'header',
              parameters: [
                {
                  type: 'image',
                  image: { link: imageUrl }
                }
              ]
            }
          ]
        }
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error sending welcome message template:', error);
    throw error;
  }
}

/**
 * Send a template with flow
 * 
 * @param recipient - Recipient's phone number
 * @param templateName - Name of the template to send
 * @param languageCode - Language code (default: 'en')
 * @returns API response data
 */
export async function sendFlowTemplate(
  recipient: string,
  templateName: string,
  languageCode: string = 'en'
) {
  try {
    const response = await axios({
      method: 'POST',
      url: `${getBaseUrl()}/messages`,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: 'button',
              sub_type: 'FLOW',
              index: '0',
              parameters: [
                {
                  type: 'action',
                  action: {
                    flow_token: recipient,
                    flow_action_data: {
                      flow_action_payload: {
                        data: {
                          name: '',
                          email: '',
                          age: '',
                          gender: '',
                          city: '',
                          phoneNumber: '',
                        },
                      },
                    },
                  },
                },
              ],
            },
          ],
        }
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error sending flow template:', error);
    throw error;
  }
}

/**
 * Send a WhatsApp template message with event details to a trainer
 * 
 * @param recipient - Recipient's phone number (trainer)
 * @param trainerName - Name of the trainer
 * @param eventTitle - Title of the event
 * @param eventDate - Date of the event
 * @param eventTime - Time of the event
 * @param meetLink - Zoom meeting link
 * @param languageCode - Language code (default: 'en')
 * @returns API response data
 */
export async function sendMeetLinkTrainerTemplate(
  recipient: string,
  trainerName: string,
  eventTitle: string,
  eventDate: string,
  eventTime: string,
  meetLink: string,
  languageCode: string = 'en'
) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: 'send_meet_link_trainer',
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: truncateTemplateParam(trainerName) },
            { type: 'text', text: truncateTemplateParam(eventTitle) },
            { type: 'text', text: truncateTemplateParam(eventDate) },
            { type: 'text', text: truncateTemplateParam(eventTime) },
            { type: 'text', text: truncateTemplateParam(meetLink) }
          ]
        }
      ]
    }
  };

  try {
    const response = await axios({
      method: 'POST',
      url: `${getBaseUrl()}/messages`,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      data
    });
    
    return response.data;
  } catch (error) {
    console.error('Error sending meet link trainer template:', error);
    throw error;
  }
}

/**
 * Send a trainer reminder template (no parameters)
 * 
 * @param recipient - Recipient's phone number (trainer)
 * @param languageCode - Language code (default: 'en')
 * @returns API response data
 */
export async function sendTrainerReminderTemplate(
  recipient: string,
  languageCode: string = 'en'
) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: 'trainer_reminder_1',
      language: { code: languageCode }
    }
  };

  try {
    const response = await axios({
      method: 'POST',
      url: `${getBaseUrl()}/messages`,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      data
    });
    
    return response.data;
  } catch (error) {
    console.error('Error sending trainer reminder template:', error);
    throw error;
  }
}

/**
 * Send a user reminder template (no parameters)
 * 
 * @param recipient - Recipient's phone number (user)
 * @param languageCode - Language code (default: 'en')
 * @returns API response data
 */
export async function sendUserReminderTemplate(
  recipient: string,
  languageCode: string = 'en'
) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: 'user_reminder_1',
      language: { code: languageCode }
    }
  };

  try {
    const response = await axios({
      method: 'POST',
      url: `${getBaseUrl()}/messages`,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      data
    });
    
    return response.data;
  } catch (error) {
    console.error('Error sending user reminder template:', error);
    throw error;
  }
} 

/**
 * Send an interactive WhatsApp message with a link button
 * 
 * @param phoneNumber - Recipient's phone number
 * @param eventTitle - Title to show in message header
 * @param messageBody - Main message text
 * @param buttonText - Text to show on the button
 * @param linkUrl - URL to open when button is clicked
 */
export async function sendInteractiveMessageWithLink(
  phoneNumber: string,
  eventTitle: string,
  messageBody: string,
  buttonText: string,
  linkUrl: string
) {
  try {
    const response = await axios({
      method: 'POST',
      url: `${getBaseUrl()}/messages`,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'interactive',
        interactive: {
          type: 'button',
          header: {
            type: 'text',
            text: truncateHeader(eventTitle)
          },
          body: {
            text: truncateBody(messageBody)
          },
          action: {
            buttons: [
              {
                type: 'url',
                url: linkUrl,
                text: truncateButtonText(buttonText)
              }
            ]
          }
        }
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error sending interactive message with link:', error);
    throw error;
  }
}

/**
 * Send a user reminder template with event title and meet link
 * 
 * @param recipient - Recipient's phone number (user)
 * @param eventTitle - Title of the event
 * @param meetLink - User's unique meeting link
 * @param languageCode - Language code (default: 'en')
 * @returns API response data
 */
export async function sendUserReminder2Template(
  recipient: string,
  eventTitle: string,
  meetLink: string,
  languageCode: string = 'en'
) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: 'user_reminder_2',
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: eventTitle },
            { type: 'text', text: meetLink }
          ]
        }
      ]
    }
  };

  try {
    const response = await axios({
      method: 'POST',
      url: `${getBaseUrl()}/messages`,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      data
    });
    
    return response.data;
  } catch (error) {
    console.error('Error sending user reminder 2 template:', error);
    throw error;
  }
}

/**
 * Send a trainer reminder template with trainer details and event info
 * 
 * @param recipient - Recipient's phone number (trainer)
 * @param trainerName - Name of the trainer
 * @param eventTitle - Title of the event
 * @param eventTime - Time of the event
 * @param meetLink - Trainer's meeting link
 * @param languageCode - Language code (default: 'en')
 * @returns API response data
 */
export async function sendTrainerReminder2Template(
  recipient: string,
  trainerName: string,
  eventTitle: string,
  eventTime: string,
  meetLink: string,
  languageCode: string = 'en'
) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: 'trainer_reminder_2',
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: trainerName },
            { type: 'text', text: eventTitle },
            { type: 'text', text: eventTime },
            { type: 'text', text: meetLink }
          ]
        }
      ]
    }
  };

  try {
    const response = await axios({
      method: 'POST',
      url: `${getBaseUrl()}/messages`,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      data
    });
    
    return response.data;
  } catch (error) {
    console.error('Error sending trainer reminder 2 template:', error);
    throw error;
  }
}

/**
 * Send a pool assignment error notification to the event owner
 * 
 * @param recipient - Event owner's phone number
 * @param eventTitle - Title of the event
 * @param eventDate - Date of the event formatted as string
 * @param eventTime - Time of the event 
 * @param errorMessage - Brief error message or reason for failure
 * @param dashboardUrl - URL to the admin dashboard to review the event
 * @param languageCode - Language code (default: 'en')
 * @returns API response data
 */
export async function sendPoolAssignmentErrorTemplate(
  recipient: string,
  eventTitle: string,
  eventDate: string,
  eventTime: string, 
  errorMessage: string,
  dashboardUrl: string,
  languageCode: string = 'en'
) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: 'pool_assignment_error_msg_template',
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: eventTitle },
            { type: 'text', text: eventDate },
            { type: 'text', text: eventTime },
            { type: 'text', text: errorMessage }
          ]
        },
        {
          type: 'button',
          sub_type: 'url',
          index: 0,
          parameters: [
            {
              type: 'text',
              text: dashboardUrl
            }
          ]
        }
      ]
    }
  };

  try {
    const response = await axios({
      method: 'POST',
      url: `${getBaseUrl()}/messages`,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      data
    });
    
    return response.data;
  } catch (error) {
    console.error('Error sending pool assignment error template:', error);
    throw error;
  }
}

/**
 * Send a troubleshooting help message with a "Get Help" button
 * 
 * @param recipient - Recipient's phone number
 * @returns API response data
 */
export async function sendHelpTroubleshootingMessage(recipient: string) {
  try {
    const helpMessage = 
      "Check the following , before reaching out for help - \n" +
      "1- Check Internet: Is your Wi-Fi or data connection stable?\n" +
      "2- Verify Link: Are you using the correct Zoom meeting link?\n" +
      "3- Zoom App: Is the Zoom app installed and up-to-date?\n" +
      "4- Email Match: Are you logged into the Zoom app with the email you used for registration (if required)?\n" +
      "5- Password: If prompted, is your Zoom account password correct?\n" +
      "6- Restart: Try closing and reopening the Zoom app.\n" +
      "7- Device Restart: If still stuck, try restarting your device.\n\n" +
      "Still need help?";

    const response = await axios({
      method: 'POST',
      url: `${getBaseUrl()}/messages`,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: helpMessage
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: 'get_help',
                  title: 'Get Help'
                }
              }
            ]
          }
        }
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error sending help troubleshooting message:', error);
    throw error;
  }
}

/**
 * Send a help request notification to admin
 * 
 * @param adminPhoneNumber - Admin's phone number
 * @param userName - User's name
 * @param userPhoneNumber - User's phone number
 * @param userEmail - User's email
 * @param languageCode - Language code (default: 'en')
 * @returns API response data
 */
export async function sendUserHelpMessageToAdmin(
  adminPhoneNumber: string,
  userName: string,
  userPhoneNumber: string,
  userEmail: string,
  languageCode: string = 'en'
) {
  try {
    // Format the base URL for the user profile
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://fiddle-fitness-fiddle-fitness-projects.vercel.app';
    const userProfileUrl = `${baseUrl}/profile/${userPhoneNumber}`;

    const response = await axios({
      method: 'POST',
      url: `${getBaseUrl()}/messages`,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: adminPhoneNumber,
        type: 'template',
        template: {
          name: 'user_help_message_to_admin',
          language: { code: languageCode },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: userName },
                { type: 'text', text: userPhoneNumber },
                { type: 'text', text: userEmail || 'Not provided' }
              ]
            },
            {
              type: 'button',
              sub_type: 'url',
              index: '0',
              parameters: [
                {
                  type: 'text',
                  text: userPhoneNumber
                }
              ]
            }
          ]
        }
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error sending user help message to admin:', error);
    throw error;
  }
}

/**
 * Send a payment link template to a user
 * 
 * @param recipient - Recipient's phone number
 * @param eventTitle - Title of the event
 * @param eventDate - Date of the event (e.g., "10 April")
 * @param eventTime - Time of the event (e.g., "11 AM")
 * @param paymentLink - URL for the payment
 * @param languageCode - Language code (default: 'en')
 * @returns API response data
 */
export async function sendPaymentLinkTemplate(
  recipient: string,
  eventTitle: string,
  eventDate: string,
  eventTime: string,
  paymentLink: string,
  languageCode: string = 'en'
) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: 'send_payment_link',
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: truncateTemplateParam(eventTitle) },
            { type: 'text', text: truncateTemplateParam(eventDate) },
            { type: 'text', text: truncateTemplateParam(eventTime) }
          ]
        },
        {
          type: 'button',
          sub_type: 'url',
          index: 0,
          parameters: [
            {
              type: 'text',
              text: paymentLink
            }
          ]
        }
      ]
    }
  };

  try {
    const response = await axios({
      method: 'POST',
      url: `${getBaseUrl()}/messages`,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      data
    });
    
    return response.data;
  } catch (error) {
    console.error('Error sending payment link template:', error);
    throw error;
  }
}

/**
 * Send a "welcome_aboard" template message with fiddle coins and a referral code CTA.
 * 
 * @param recipient - Recipient's phone number
 * @param fiddle_coins - Number of Fiddle Coins awarded
 * @param referral_code - Referral code to be copied
 * @param languageCode - Language code (default: 'en')
 * @returns API response data
 */
export async function sendWelcomeAboardTemplate(
  recipient: string,
  fiddle_coins: string, // Assuming fiddle_coins is passed as a string
  referral_code: string,
  languageCode: string = 'en'
) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: 'welcome_aboard',
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: truncateTemplateParam(fiddle_coins) }
          ]
        },
        {
          type: 'button',
          sub_type: 'COPY_CODE',
          index: '0', // Assuming this is the first (or only) button of this type
          parameters: [
            {
              type: 'coupon_code',
              coupon_code: referral_code 
            }
          ]
        }
      ]
    }
  };

  try {
    const response = await axios({
      method: 'POST',
      url: `${getBaseUrl()}/messages`,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      data
    });
    
    return response.data;
  } catch (error) {
    console.error('Error sending welcome_aboard template:', error);
    throw error;
  }
}

/**
 * Send a "referral_success_message" template message.
 * This is a static template and does not require any dynamic parameters.
 * 
 * @param recipient - Recipient's phone number
 * @param languageCode - Language code (default: 'en')
 * @returns API response data
 */
export async function sendReferralSuccessMessageTemplate(
  recipient: string,
  languageCode: string = 'en'
) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: 'referral_success_message',
      language: { code: languageCode }
      // No components needed for a static template without variables or buttons
    }
  };

  try {
    const response = await axios({
      method: 'POST',
      url: `${getBaseUrl()}/messages`,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      data
    });
    
    return response.data;
  } catch (error) {
    console.error('Error sending referral_success_message template:', error);
    throw error;
  }
}