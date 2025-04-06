import { EVENT_CATEGORIES } from '@/lib/constants/categoryIds'
import { extractLast10Digits } from '@/lib/formatMobileNumber'
import { prisma } from '@/lib/prisma'
import {
  sendFlowTemplate,
  sendHelpTroubleshootingMessage,
  sendPaymentLinkTemplate,
  sendTextMessage,
  sendUserHelpMessageToAdmin,
  sendWelcomeMessageTemplate,
} from '@/lib/whatsapp'
import {
  limitListRows,
  truncateBody,
  truncateFooter,
  truncateHeader,
  truncateListDescription,
  truncateListTitle,
} from '@/lib/whatsappLimits'
import axios from 'axios'
import { NextRequest } from 'next/server'

// Types
interface WhatsAppMessage {
  from: string
  id: string
  type: string
  text?: {
    body: string
  }
  interactive?: {
    type: string
    button_reply?: {
      id: string
    }
    list_reply?: {
      id: string
    }
    nfm_reply?: {
      response_json: {
        flow_token: string
      }
      body: string
      name: string
    }
  }
}

interface WhatsAppWebhookBody {
  object: string
  entry: Array<{
    changes: Array<{
      value: {
        messages: WhatsAppMessage[]
      }
    }>
  }>
}

interface User {
  id: string
  mobileNumber: string
  name?: string
  email?: string
  conversationState?: ConversationState
  lastInteraction?: Date
  contextData?: {
    selectedCategory?: string
    eventIds?: string[]
    selectedEventId?: string
    registeredEventIds?: string[]
    lastAction?: string
    lastActionTimestamp?: Date
  }
}

// Constants
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const WHATSAPP_API_URL = `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`
const VERSION = 'v18.0' // Meta Graph API version
const flowBaseUrl = `https://graph.facebook.com/${VERSION}/${PHONE_NUMBER_ID}`
const CONTEXT_TIMEOUT_MINUTES = 10

// Define conversation states
enum ConversationState {
  IDLE = 'idle',
  AWAITING_MEDICAL_CHECK = 'awaiting_medical_check',
  AWAITING_CATEGORY_SELECTION = 'awaiting_category_selection',
  AWAITING_EVENT_SELECTION = 'awaiting_event_selection',
  AWAITING_REGISTRATION_CONFIRMATION = 'awaiting_registration_confirmation',
  AWAITING_REGISTERED_EVENT_SELECTION = 'awaiting_registered_event_selection',
}

// Add type definition for EVENT_CATEGORIES
interface Category {
  value: string
  label: string
}

// Update Event interface to match Prisma model
interface Event {
  id: string
  title: string
  description: string | null
  eventDate: Date
  eventTime: string
  location: string | null
  category: string
  price: number | null
  maxCapacity: number
  poolCapacity: number
  registrationDeadline: Date | null
  createdAt: Date
  updatedAt: Date
}

// State Management Functions
async function updateUserState(
  user: User,
  newState: ConversationState,
  contextData?: any,
) {
  const updateData: any = {
    lastInteraction: new Date(),
    conversationState: newState,
  }

  if (contextData) {
    updateData.contextData = {
      ...(user.contextData || {}),
      ...contextData,
      lastAction: newState,
      lastActionTimestamp: new Date(),
    }
  }

  return prisma.user.update({
    where: { id: user.id },
    data: updateData,
  })
}

async function checkContextTimeout(user: User): Promise<boolean> {
  if (!user.lastInteraction) return true
  const timeoutMinutesAgo = new Date(
    Date.now() - CONTEXT_TIMEOUT_MINUTES * 60 * 1000,
  )
  return new Date(user.lastInteraction) < timeoutMinutesAgo
}

async function resetUserState(user: User) {
  return updateUserState(user, ConversationState.IDLE, {
    selectedCategory: null,
    eventIds: null,
    selectedEventId: null,
    registeredEventIds: null,
    lastAction: null,
    lastActionTimestamp: null,
  })
}

// Message Utility Functions
// Remove the local implementation of sendTextMessage
// Remove the local implementation of sendFlowTemplate
// Remove the local implementation of sendWelcomeMessageTemplate
// Remove the local implementation of sendSessionConfirmationTemplate

// now we will create a function to send a message with image or video to user
async function sendImageOrVideoMessage(
  phoneNumber: string,
  imageOrVideoUrl: string,
  message: string,
) {
  try {
    await axios({
      method: 'POST',
      url: WHATSAPP_API_URL,
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'interactive',
        interactive: {
          type: 'image',
          header: {
            type: 'image',
            image: {
              link: imageOrVideoUrl,
            },
          },
          body: {
            text: message,
          },
        },
      },
    })
  } catch (error) {
    console.error('Error sending image or video message:', error)
    throw error
  }
}

async function sendInteractiveMessage(phoneNumber: string, message: any) {
  try {
    await axios.post(WHATSAPP_API_URL, message, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Error sending interactive message:', error)
    throw error
  }
}

// Event List Functions
async function sendCategoryList(user: User) {
  try {
    const upcomingCategories = await getUpcomingEventCategories()
    console.log('upcomingCategoriesfromsendCategoryList', upcomingCategories)

    if (upcomingCategories.length === 0) {
      await sendTextMessage(
        user.mobileNumber,
        'Sorry, there are no upcoming events available at the moment. Please check back later!',
      )

      await resetUserState(user)
      return
    }

    const listMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: user.mobileNumber,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: {
          type: 'text',
          text: 'Event Categories',
        },
        body: {
          text: 'Select a category to explore upcoming events and never miss out on activities that interest you!',
        },
        footer: {
          text: 'Reply with your selection',
        },
        action: {
          button: 'View Categories',
          sections: [
            {
              title: 'Available Categories',
              rows: upcomingCategories.map(category => ({
                id: category.value,
                title: category.label,
                description: `Browse upcoming ${category.label} events`,
              })),
            },
          ],
        },
      },
    }

    await sendInteractiveMessage(user.mobileNumber, listMessage)
    await updateUserState(user, ConversationState.AWAITING_CATEGORY_SELECTION)
  } catch (error) {
    console.error('Error sending category list:', error)
    throw error
  }
}

// Add this helper function at the top with other utility functions
function getTodayAtMidnight() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now
}

// Update getUpcomingEventCategories function
async function getUpcomingEventCategories() {
  const now = getTodayAtMidnight()
  const upcomingEvents = await prisma.event.findMany({
    where: {
      eventDate: {
        gte: now,
      },
      OR: [
        { registrationDeadline: null },
        { registrationDeadline: { gte: now } },
      ],
    },
    select: {
      category: true,
    },
    orderBy: {
      eventDate: 'asc',
    },
  })

  const eventCategories = [
    ...new Set(upcomingEvents.map(event => event.category)),
  ]

  return EVENT_CATEGORIES.filter((category: Category) =>
    eventCategories.some(
      eventCategory =>
        category.value === eventCategory ||
        category.value === `cat_${eventCategory}` ||
        eventCategory === `cat_${category.value.replace('cat_', '')}`,
    ),
  )
}

async function sendRegisteredEventsList(user: User) {
  try {
    const registeredEvents = await prisma.eventRegistration.findMany({
      where: { userId: user.id },
      include: { event: true },
      orderBy: { createdAt: 'desc' },
    })

    if (registeredEvents.length === 0) {
      await sendTextMessage(
        user.mobileNumber,
        "You are not registered for any events yet. Let's find some events for you!",
      )
      await sendCategoryList(user)
      return
    }

    const formattedEvents = registeredEvents.map(registration => {
      const event = registration.event
      const eventDate = new Date(event.eventDate)
      const formattedDate = eventDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })

      return {
        id: event.id,
        title: event.title,
        description: `happening on ${formattedDate} - ${event.eventTime}`,
      }
    })

    console.log('formattedEvents', formattedEvents)

    const listMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: user.mobileNumber,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: {
          type: 'text',
          text: 'Your Upcoming Events',
        },
        body: {
          text: "You're registered for these events",
        },
        footer: {
          text: 'Select an event for more details',
        },
        action: {
          button: 'View Events',
          sections: [
            {
              title: 'Your Events',
              rows: formattedEvents.map(event => ({
                id: event.id,
                title: event.title,
                description: event.description,
              })),
            },
          ],
        },
      },
    }

    await sendInteractiveMessage(user.mobileNumber, listMessage)
    await updateUserState(
      user,
      ConversationState.AWAITING_REGISTERED_EVENT_SELECTION,
      {
        registeredEventIds: formattedEvents.map(e => e.id),
      },
    )
  } catch (error) {
    console.error('Error sending registered events list:', error)
    throw error
  }
}

// State Handler Functions
async function handleIdleState(
  user: User,
  message: WhatsAppMessage,
  forwardedState: boolean = false,
) {
  try {
    if (!forwardedState) {
      await sendTextMessage(
        user.mobileNumber,
        `Hello ${user.name} 👋, Welcome Back! Let's get moving `,
      )
    }

    const userRegisteredEvents = await prisma.eventRegistration.findMany({
      where: { userId: user.id },
      include: { event: true },
    })

    if (userRegisteredEvents.length > 0) {
      await sendMainMenu(user.mobileNumber, forwardedState)
    } else {
      await handleRegisterNewEvent(user)
    }
  } catch (error) {
    console.error('Error in handleIdleState:', error)
    await sendTextMessage(
      user.mobileNumber,
      'Sorry, I encountered an error. Please try again later.',
    )
  }
}

async function handleRegisterNewEvent(user: User) {
  await sendMedicalFitnessCheck(user)
  await updateUserState(user, ConversationState.AWAITING_MEDICAL_CHECK)
}

async function handleMedicalFitYes(user: User) {
  await sendTextMessage(
    user.mobileNumber,
    "Thank you for confirming. Let's find the perfect event for you!",
  )
  await sendCategoryList(user)
  await updateUserState(user, ConversationState.AWAITING_CATEGORY_SELECTION)
}

async function handleMedicalFitNo(user: User) {
  await sendTextMessage(
    user.mobileNumber,
    "Thanks for letting us know. Prioritize your health, and we'll have more sessions soon!",
  )
  await resetUserState(user)
}

// Message Content Functions
async function sendMainMenu(
  phoneNumber: string,
  forwardedState: boolean = false,
) {
  try {
    // Check if the user has any events scheduled for today
    const userWithId = await prisma.user.findUnique({
      where: { mobileNumber: phoneNumber },
      select: { id: true },
    })

    if (!userWithId) {
      console.log(`User not found with phone number: ${phoneNumber}`)
      return
    }

    // Check for today's events
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Start of today
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1) // Start of tomorrow

    const todaysEvents = await prisma.eventRegistration.findMany({
      where: {
        userId: userWithId.id,
        event: {
          eventDate: {
            gte: today,
            lt: tomorrow,
          },
        },
      },
      include: {
        event: true,
      },
    })

    const hasTodayEvent = todaysEvents.length > 0
    console.log(`User ${phoneNumber} has ${todaysEvents.length} events today`)

    // Prepare buttons based on whether user has an event today
    const buttons = [
      {
        type: 'reply',
        reply: {
          id: 'view_registered_events',
          title: 'View My Events',
        },
      },
      {
        type: 'reply',
        reply: {
          id: 'register_new_event',
          title: 'Register New Event',
        },
      },
    ]

    // Add Help button if user has an event today
    if (hasTodayEvent) {
      buttons.push({
        type: 'reply',
        reply: {
          id: 'help_button',
          title: 'Need Help?',
        },
      })
    }

    const message = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: forwardedState
            ? 'Is there anything else I can help you with?'
            : 'What would you like to do today?',
        },
        action: {
          buttons: buttons,
        },
      },
    }

    await sendInteractiveMessage(phoneNumber, message)
  } catch (error) {
    console.error('Error sending main menu:', error)
  }
}

async function sendMedicalFitnessCheck(user: User) {
  const message = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: user.mobileNumber,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: 'Your well-being is important, please consider any health conditions before engaging in physical activity.',
      },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: {
              id: 'medical_fit_yes',
              title: 'Count me in',
            },
          },
          {
            type: 'reply',
            reply: {
              id: 'medical_fit_no',
              title: "I'll skip this one",
            },
          },
        ],
      },
    },
  }

  await sendInteractiveMessage(user.mobileNumber, message)
}

// Event Selection Handlers
async function handleEventSelection(user: User, message: WhatsAppMessage) {
  try {
    let selectedEventId = null

    if (
      message.type === 'interactive' &&
      message.interactive?.type === 'list_reply'
    ) {
      selectedEventId = message.interactive.list_reply?.id
    } else if (message.type === 'text' && message.text?.body) {
      const text = message.text.body.trim()
      if (user.contextData?.eventIds?.includes(text)) {
        selectedEventId = text
      }
    }

    if (!selectedEventId) {
      await sendTextMessage(
        user.mobileNumber,
        "I couldn't identify which event you selected. Please try again.",
      )
      await resetUserState(user)
      await sendCategoryList(user)
      return
    }

    const event = await prisma.event.findUnique({
      where: { id: selectedEventId },
      include: {
        eventTrainers: {
          include: {
            trainer: true,
          },
        },
        registrations: {
          where: {
            userId: user.id,
          },
        },
      },
    })

    if (!event) {
      await sendTextMessage(
        user.mobileNumber,
        "Sorry, I couldn't find details for that event. It may have been removed.",
      )
      await resetUserState(user)
      return
    }

    // Add check for registration deadline
    const now = getTodayAtMidnight()
    if (event.registrationDeadline && event.registrationDeadline < now) {
      await sendTextMessage(
        user.mobileNumber,
        'Sorry, the registration deadline for this event has passed.',
      )
      await resetUserState(user)
      return
    }

    const isUserRegistered = event.registrations.length > 0

    if (isUserRegistered) {
      const eventDate = new Date(event.eventDate).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
      await sendTextMessage(
        user.mobileNumber,
        `✅ You are already registered for:\n\n` +
          `🎯 "${event.title}"\n` +
          `📅 ${eventDate}\n` +
          `⏰ ${event.eventTime}\n\n` +
          `📝 Meeting details and joining instructions will be shared prior to the event.\n\n` +
          `🎉 We look forward to your participation!`,
      )
      await resetUserState(user)
      await handleIdleState(user, message, true)
      return
    }

    const trainerNames =
      event.eventTrainers.map(et => et.trainer.name).join(', ') || 'TBA'
    const registrationCount = await prisma.eventRegistration.count({
      where: { eventId: event.id },
    })
    const spotsRemaining = event.maxCapacity - registrationCount

    const messageBody = `Great choice! You're confirmed for ${
      event.title
    } on ${new Date(event.eventDate).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })} at ${
      event.eventTime
    } IST. Kindly complete the payment to secure your spot.`

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      'https://fiddle-fitness-fiddle-fitness-projects.vercel.app/'
    const registrationUrl = new URL(
      `/payment/${event.id}/${user.mobileNumber}`,
      baseUrl,
    )

    // await sendTextMessage(
    //   user.mobileNumber,
    //   `*${
    //     event.title
    //   }*\n\n${messageBody}\n\nRegister here: ${registrationUrl.toString()}`,
    // )

    await sendPaymentLinkTemplate(
      user.mobileNumber,
      event.title,
      new Date(event.eventDate).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      event.eventTime,
      `/${event.id}/${user.mobileNumber}`,
    )

    await updateUserState(user, ConversationState.IDLE, {
      selectedEventId,
    })
  } catch (error) {
    console.error('Error handling event selection:', error)
    await handleError(error, user.mobileNumber)
    await resetUserState(user)
  }
}

async function handleRegisteredEventSelection(
  user: User,
  message: WhatsAppMessage,
) {
  try {
    let selectedEventId = null

    if (
      message.type === 'interactive' &&
      message.interactive?.type === 'list_reply'
    ) {
      selectedEventId = message.interactive.list_reply?.id
    } else if (message.type === 'text' && message.text?.body) {
      const text = message.text.body.trim()
      if (user.contextData?.registeredEventIds?.includes(text)) {
        selectedEventId = text
      }
    }

    if (!selectedEventId) {
      await sendTextMessage(
        user.mobileNumber,
        "I couldn't identify which event you selected. Please try again.",
      )
      await sendRegisteredEventsList(user)
      return
    }

    const event = await prisma.event.findUnique({
      where: { id: selectedEventId },
      include: {
        eventTrainers: {
          include: {
            trainer: true,
          },
        },
        pools: {
          include: {
            attendees: {
              where: {
                userId: user.id,
              },
            },
          },
        },
      },
    })

    if (!event) {
      await sendTextMessage(
        user.mobileNumber,
        "Sorry, I couldn't find details for that event. It may have been removed.",
      )
      await resetUserState(user)
      return
    }

    const eventDate = new Date(event.eventDate)
    const formattedDate = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })

    const trainerNames =
      event.eventTrainers.map(et => et.trainer.name).join(', ') || 'TBA'
    const poolsAssigned = event.poolsAssigned
    const userPool = event.pools[0] // Get the first (and only) pool

    let messageBody =
      `📅 *Date:* ${formattedDate}\n` +
      `⏰ *Time:* ${event.eventTime}\n` +
      `📍 *Location:* ${event.location || 'Online'}\n` +
      `👨 *Trainers:* ${trainerNames}\n\n` +
      `${event.description || 'Join this exciting event!'}\n\n`

    if (poolsAssigned && userPool) {
      // Get the user's unique meeting link from poolAttendee
      const userPoolAttendee = await prisma.poolAttendee.findFirst({
        where: {
          poolId: userPool.id,
          userId: user.id,
        },
      })

      const meetLinkText =
        userPoolAttendee?.meetLink || 'Link will be shared soon'

      if (meetLinkText.includes('zoom.us')) {
        messageBody +=
          `🎉 *Your Event is Ready!*\n\n` +
          `You've been assigned to: *${userPool.name || 'Main Pool'}*\n` +
          `📱 *Your Unique Meeting Link:* ${meetLinkText}\n\n` +
          `*Note:* This is your unique meeting link. Please:\n` +
          `- Use the same email that was used for registration\n` +
          `- Join a few minutes before the event starts\n` +
          `- Keep your display name clear and recognizable\n\n` +
          `See you at the event!`
      } else {
        messageBody +=
          `🎉 *Your Event is Ready!*\n\n` +
          `You've been assigned to: *${userPool.name || 'Main Pool'}*\n` +
          `📱 *Your Unique Meeting Link:* ${meetLinkText}\n\n` +
          `See you at the event!`
      }
    } else {
      messageBody +=
        `⏳ *Status:* Your registration is confirmed! \n\n` +
        `You'll receive event details including joining instructions before the event starts.`
    }

    await sendTextMessage(
      user.mobileNumber,
      `*Event Name: ${event.title}*\n\n${messageBody}`,
    )
    await resetUserState(user)

    setTimeout(async () => {
      await handleIdleState(user, message, true)
    }, 2000)
  } catch (error) {
    console.error('Error handling registered event selection:', error)
    await handleError(error, user.mobileNumber)
    await resetUserState(user)
  }
}

async function handleRegistrationConfirmation(
  user: User,
  message: WhatsAppMessage,
) {
  await sendTextMessage(
    user.mobileNumber,
    'Registration confirmation flow would be implemented here.',
  )
  await resetUserState(user)
}

// Add a new function to handle help requests
async function handleHelpRequest(user: User) {
  try {
    console.log(`Processing help request for user: ${user.id}`)
    await sendHelpTroubleshootingMessage(user.mobileNumber)
    return true
  } catch (error) {
    console.error('Error handling help request:', error)
    await sendTextMessage(
      user.mobileNumber,
      'Sorry, we encountered an error processing your help request. Please try again later.',
    )
    return false
  }
}

// Add a function to handle Get Help button click
async function handleGetHelpButtonClick(user: User) {
  try {
    console.log(`Processing "Get Help" request for user: ${user.id}`)

    // Get admin phone number from environment variable or use a default
    const adminPhoneNumber = process.env.ADMIN_PHONE_NUMBER || '8305387299'

    // Send help request to admin
    await sendUserHelpMessageToAdmin(
      adminPhoneNumber,
      user.name || 'User',
      user.mobileNumber,
      user.email || '',
    )

    // Inform the user that help is on the way
    await sendTextMessage(
      user.mobileNumber,
      'Thank you for reaching out. Our team has been notified and will contact you shortly to assist with your issue.',
    )

    return true
  } catch (error) {
    console.error('Error handling Get Help request:', error)
    await sendTextMessage(
      user.mobileNumber,
      'Sorry, we encountered an error while forwarding your help request. Please try again later or contact us directly.',
    )
    return false
  }
}

// Button Handler
async function handleButtonResponse(
  user: User,
  message: WhatsAppMessage,
): Promise<boolean> {
  if (
    message.type !== 'interactive' ||
    message.interactive?.type !== 'button_reply'
  ) {
    return false
  }

  const buttonId = message.interactive.button_reply?.id
  if (!buttonId) return false

  switch (buttonId) {
    case 'view_registered_events':
      await sendRegisteredEventsList(user)
      return true
    case 'register_new_event':
      await handleRegisterNewEvent(user)
      return true
    case 'medical_fit_yes':
      await handleMedicalFitYes(user)
      return true
    case 'medical_fit_no':
      await handleMedicalFitNo(user)
      return true
    case 'help_button':
      await handleHelpRequest(user)
      return true
    case 'get_help':
      await handleGetHelpButtonClick(user)
      return true
    default:
      return false
  }
}

// Add these new functions for handling reviews

// Send reasons list for unsatisfied ratings (1-3)
async function sendDissatisfactionReasonsList(
  phoneNumber: string,
  eventTitle: string,
) {
  try {
    // Truncate the event title to ensure it fits within WhatsApp's character limits
    const truncatedEventTitle = truncateHeader(eventTitle)

    const listMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: {
          type: 'text',
          text: 'We Value Your Feedback',
        },
        body: {
          text: truncateBody(
            `We're sorry to hear that your experience with "${truncatedEventTitle}" didn't meet your expectations. Could you please tell us what aspect of the event didn't work for you?`,
          ),
        },
        footer: {
          text: truncateFooter('Select a reason'),
        },
        action: {
          button: 'Select Reason',
          sections: [
            {
              title: 'Reasons',
              rows: [
                {
                  id: `reason_audio_video`,
                  title: 'Audio & Video Quality',
                  description: 'Issues with streaming quality',
                },
                {
                  id: `reason_trainer`,
                  title: 'Trainer Effectiveness',
                  description: 'Issues with trainer performance',
                },
                {
                  id: `reason_content`,
                  title: 'Choice of Songs',
                  description: 'Issues with music selection',
                },
                {
                  id: `reason_payment`,
                  title: 'Payment/Registration',
                  description: 'Issues with payment or registration',
                },
              ],
            },
          ],
        },
      },
    }

    await sendInteractiveMessage(phoneNumber, listMessage)
    return true
  } catch (error) {
    console.error('Error sending dissatisfaction reasons list:', error)
    return false
  }
}

// Handle review rating responses
async function handleReviewResponse(user: User, message: WhatsAppMessage) {
  // Check for both button replies and list replies
  if (message.type === 'interactive' && message.interactive) {
    const isButtonReply = message.interactive.type === 'button_reply'
    const isListReply = message.interactive.type === 'list_reply'

    if (!isButtonReply && !isListReply) {
      return false
    }

    // Extract the rating ID from either button or list reply
    let ratingId = null
    if (isButtonReply) {
      ratingId = message.interactive.button_reply?.id
    } else if (isListReply) {
      ratingId = message.interactive.list_reply?.id
    }

    if (!ratingId || !ratingId.startsWith('rating_')) {
      return false
    }

    const rating = parseInt(ratingId.split('_')[1])
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return false
    }

    return await processReviewRating(user, rating)
  }
  // Also handle text-based responses for ratings 1 and 2
  else if (message.type === 'text' && message.text?.body) {
    const text = message.text.body.trim()
    // Accept any text input that's a valid rating number (1-5)
    if (['1', '2', '3', '4', '5'].includes(text)) {
      const rating = parseInt(text)
      return await processReviewRating(user, rating)
    }
  }

  return false
}

// Helper function to process a review rating
async function processReviewRating(user: User, rating: number) {
  try {
    console.log(`Processing rating ${rating} for user ${user.id}`)

    // Find the pending review for this user
    const pendingReview = await prisma.eventReview.findFirst({
      where: {
        userId: user.id,
        status: 'pending',
        rating: null, // Should not have a rating yet
      },
      include: {
        event: true,
      },
    })

    if (!pendingReview) {
      console.log(`No pending review found for user ${user.id}`)
      await sendTextMessage(
        user.mobileNumber,
        "Sorry, we couldn't find an active review request for you.",
      )
      return true
    }

    console.log(
      `Updating review ID: ${pendingReview.id} with rating: ${rating}`,
    )

    // Update the review with the rating
    const updatedReview = await prisma.eventReview.update({
      where: { id: pendingReview.id },
      data: {
        rating: rating,
        status: rating >= 4 ? 'completed' : 'pending', // Only mark as completed for 4-5 ratings
      },
    })

    if (rating <= 3) {
      // For ratings 1-3, ask for reason
      console.log(`Low rating (${rating}) received, asking for reason`)
      await sendDissatisfactionReasonsList(
        user.mobileNumber,
        pendingReview.event.title,
      )
    } else {
      // For ratings 4-5, thank the user
      console.log(`High rating (${rating}) received, thanking user`)
      await sendTextMessage(
        user.mobileNumber,
        `Thank you for your positive feedback! We're glad you enjoyed the ${pendingReview.event.title} event.`,
      )
    }

    return true
  } catch (error) {
    console.error('Error processing review rating:', error)
    await sendTextMessage(
      user.mobileNumber,
      'Sorry, we encountered an error processing your feedback. Please try again later.',
    )
    return true
  }
}

// Handle dissatisfaction reason selection
async function handleDissatisfactionReason(
  user: User,
  message: WhatsAppMessage,
) {
  if (
    message.type !== 'interactive' ||
    message.interactive?.type !== 'list_reply'
  ) {
    return false
  }

  const replyId = message.interactive.list_reply?.id
  if (!replyId || !replyId.startsWith('reason_')) {
    return false
  }

  try {
    // Extract just the reason type (audio_video, trainer, etc)
    const reason = replyId.split('_')[1] // Just get the reason part

    if (!reason) {
      console.error('Could not extract reason from reply ID:', replyId)
      return false
    }

    console.log(`Processing feedback reason: ${reason} for user: ${user.id}`)

    // Find the pending review for this user instead of trying to use ID from the message
    const pendingReview = await prisma.eventReview.findFirst({
      where: {
        userId: user.id,
        status: 'pending',
        rating: { not: null }, // Make sure it has a rating (user has already rated)
      },
      include: {
        event: true,
      },
    })

    if (!pendingReview) {
      console.error(`No pending review found for user ${user.id}`)
      await sendTextMessage(
        user.mobileNumber,
        "Sorry, we couldn't find your active review. Please try again later.",
      )
      return true
    }

    // Update the review with the reason
    const updatedReview = await prisma.eventReview.update({
      where: { id: pendingReview.id }, // Use the ID from the found review
      data: {
        feedback: reason,
        status: 'completed',
      },
      include: {
        event: true,
      },
    })

    // Thank the user for their feedback
    await sendTextMessage(
      user.mobileNumber,
      `Thank you for your detailed feedback about ${updatedReview.event.title}. We appreciate your input and will use it to improve future events.`,
    )

    return true
  } catch (error) {
    console.error('Error processing dissatisfaction reason:', error)
    await sendTextMessage(
      user.mobileNumber,
      'Sorry, we encountered an error processing your feedback. Our team will look into this.',
    )
    return true
  }
}

// Main Message Handler
async function handleIncomingMessage(
  phoneNumber: string,
  message: WhatsAppMessage,
) {
  try {
    // Only process messages that are text, interactive buttons, or list responses
    if (
      message.type !== 'text' &&
      message.type !== 'interactive' &&
      !message.text?.body &&
      !(message.interactive?.type === 'button_reply') &&
      !(message.interactive?.type === 'list_reply') &&
      !(message.interactive?.type === 'nfm_reply')
    ) {
      // Ignore non-actionable webhook events like reactions, status updates etc
      return
    }

    let userData = await prisma.user.findUnique({
      where: { mobileNumber: phoneNumber },
    })

    if (!userData) {
      // await sendTextMessage(phoneNumber, "Hi there! 👋 Welcome to Fiddle Fitness 💪. We're excited & ready to help you on your fitness journey! 🎯")
      // Since these are async calls, we need to wait for the welcome message to complete before sending flow template
      try {
        // Send welcome message first and wait for it to complete
        await sendWelcomeMessageTemplate(
          phoneNumber,
          'https://images.pexels.com/photos/4720236/pexels-photo-4720236.jpeg',
        )
        // Add a small delay to ensure messages are sent in order
        await new Promise(resolve => setTimeout(resolve, 1000))
        // Then send the flow template
        await sendFlowTemplate(phoneNumber, 'enter_your_details')
      } catch (error) {
        console.error('Error sending welcome sequence:', error)
      }
      return
    }

    const user = convertToUser(userData)

    // Try handling review responses first - BEFORE checking context timeout
    if (message.type === 'interactive' && message.interactive) {
      // Check if this is a review rating response (both button and list replies)
      if (
        (message.interactive.type === 'button_reply' &&
          message.interactive.button_reply?.id?.startsWith('rating_')) ||
        (message.interactive.type === 'list_reply' &&
          message.interactive.list_reply?.id?.startsWith('rating_'))
      ) {
        const handled = await handleReviewResponse(user, message)
        if (handled) return // Exit early, don't process any further logic
      }

      // Check if this is a dissatisfaction reason response
      if (
        message.interactive.type === 'list_reply' &&
        message.interactive.list_reply?.id?.startsWith('reason_')
      ) {
        const handled = await handleDissatisfactionReason(user, message)
        if (handled) return // Exit early, don't process any further logic
      }
    }

    // Check context timeout AFTER handling review responses
    // This prevents the welcome message from appearing after a review
    const isContextTimeout = await checkContextTimeout(user)
    if (isContextTimeout) {
      await resetUserState(user)
      await handleIdleState(user, message)
      return // Return after handling idle state to prevent further processing
    }

    // Handle button responses
    if (
      message.type === 'interactive' &&
      message.interactive?.type === 'button_reply'
    ) {
      const handled = await handleButtonResponse(user, message)
      if (handled) return
    }

    // Handle flow responses
    if (
      message.type === 'interactive' &&
      message.interactive?.type === 'nfm_reply'
    ) {
      const flowResponse = message.interactive.nfm_reply
      if (!flowResponse) {
        console.error('Invalid flow response structure')
        return
      }

      if (flowResponse.body === 'Sent' && flowResponse.name === 'flow') {
        await sendTextMessage(
          phoneNumber,
          `Thanks ${user.name}, we now know you well. Thrilled you're here!`,
        )
        await handleRegisterNewEvent(user)
        return
      }
    }

    // Handle state-based messages
    switch (user.conversationState) {
      case ConversationState.IDLE:
        await handleIdleState(user, message)
        break
      case ConversationState.AWAITING_MEDICAL_CHECK:
        await handleButtonResponse(user, message)
        break
      case ConversationState.AWAITING_CATEGORY_SELECTION:
        await handleCategorySelection(user, message)
        break
      case ConversationState.AWAITING_EVENT_SELECTION:
        await handleEventSelection(user, message)
        break
      case ConversationState.AWAITING_REGISTRATION_CONFIRMATION:
        await handleRegistrationConfirmation(user, message)
        break
      case ConversationState.AWAITING_REGISTERED_EVENT_SELECTION:
        await handleRegisteredEventSelection(user, message)
        break
      default:
        await resetUserState(user)
        await handleIdleState(user, message)
    }
  } catch (error) {
    await handleError(error, phoneNumber)
  }
}

// Error Handler
async function handleError(error: any, phoneNumber: string) {
  console.error('Error handling message:')
  if (axios.isAxiosError(error)) {
    console.error('Error data:', error.response?.data)
  } else if (error instanceof Error) {
    console.error('Error message:', error.message)
  }
  console.error('Error config:', (error as any).config)

  await sendTextMessage(
    phoneNumber,
    'Sorry, an error occurred. Please try again later.',
  )
}

// API Routes
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (body?.object && body?.entry?.length > 0) {
      const entry = body.entry[0]
      if (entry?.changes?.length > 0) {
        const change = entry.changes[0]
        if (change?.value?.messages?.length > 0) {
          const message = change.value.messages[0]
          const from = extractLast10Digits(message.from)
          await handleIncomingMessage(from, message)
        }
      }
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response('Server Error', { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED')
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  return new Response('Bad Request', { status: 400 })
}

// Type conversion helper
function convertToUser(userData: any): User {
  return {
    ...userData,
    conversationState: userData.conversationState as
      | ConversationState
      | undefined,
  }
}

// Update getUpcomingEventsByCategory function
async function getUpcomingEventsByCategory(category: string): Promise<Event[]> {
  const now = getTodayAtMidnight()
  return prisma.event.findMany({
    where: {
      category,
      eventDate: {
        gte: now,
      },
      OR: [
        { registrationDeadline: null },
        { registrationDeadline: { gte: now } },
      ],
    },
    orderBy: {
      eventDate: 'asc',
    },
    take: 10,
  })
}

// Add the missing sendEventsList function
async function sendEventsList(
  phoneNumber: string,
  events: Event[],
  categoryName: string,
) {
  try {
    const categoryInfo = EVENT_CATEGORIES.find(
      cat => cat.value === categoryName,
    )
    const categoryLabel = categoryInfo ? categoryInfo.label : categoryName

    // Make sure we don't exceed the maximum number of events in a list
    const limitedEvents = limitListRows(events)

    const formattedEvents = limitedEvents.map(event => {
      const eventDate = new Date(event.eventDate)
      const formattedDate = eventDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })

      // Create description text
      const description = `happening on ${formattedDate} - ${event.eventTime}, Price: ₹${event.price}`

      return {
        id: event.id,
        title: truncateListTitle(event.title),
        description: truncateListDescription(description),
      }
    })

    const listMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: {
          type: 'text',
          text: truncateHeader(`${categoryLabel} Events`),
        },
        body: {
          text: truncateBody(
            `Kindly select the event you wish to participate in from the options provided.`,
          ),
        },
        footer: {
          text: truncateFooter('Select an event for more details'),
        },
        action: {
          button: 'View Events',
          sections: [
            {
              title: 'Upcoming Events',
              rows: formattedEvents.map(event => ({
                id: event.id,
                title: event.title,
                description: event.description,
              })),
            },
          ],
        },
      },
    }

    await sendInteractiveMessage(phoneNumber, listMessage)
  } catch (error) {
    console.error('Error sending events list:', error)
    throw error
  }
}

// Update the handleCategorySelection function with proper type
async function handleCategorySelection(user: User, message: WhatsAppMessage) {
  try {
    let selectedCategory = null

    if (
      message.type === 'interactive' &&
      message.interactive?.type === 'list_reply'
    ) {
      selectedCategory = message.interactive.list_reply?.id
    } else if (message.type === 'text' && message.text?.body) {
      const text = message.text.body.toLowerCase()
      const matchedCategory = EVENT_CATEGORIES.find(
        cat =>
          cat.value.toLowerCase() === text ||
          cat.label.toLowerCase().includes(text),
      )
      if (matchedCategory) {
        selectedCategory = matchedCategory.value
      }
    }

    if (!selectedCategory) {
      await sendTextMessage(
        user.mobileNumber,
        "Sorry, I couldn't understand your selection. Please choose from the list of categories.",
      )
      await sendCategoryList(user)
      return
    }

    const categoryInfo = EVENT_CATEGORIES.find(
      cat => cat.value === selectedCategory,
    )
    const categoryDescription = categoryInfo
      ? categoryInfo.description
      : 'Unknown category'

    await sendTextMessage(
      user.mobileNumber,
      `Thanks for your selection!\n${categoryDescription}`,
    )

    const events = await getUpcomingEventsByCategory(selectedCategory)

    if (events.length === 0) {
      await sendTextMessage(
        user.mobileNumber,
        `Sorry, there are no upcoming events in the "${selectedCategory}" category. Would you like to check other categories?`,
      )
      await resetUserState(user)
      await sendCategoryList(user)
      return
    }

    await updateUserState(user, ConversationState.AWAITING_EVENT_SELECTION, {
      selectedCategory,
      eventIds: events.map((e: Event) => e.id),
    })

    await sendEventsList(user.mobileNumber, events, selectedCategory)
  } catch (error) {
    console.error('Error handling category selection:', error)
    throw error
  }
}
