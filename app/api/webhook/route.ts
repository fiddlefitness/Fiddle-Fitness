import { EVENT_CATEGORIES } from '@/lib/constants/categoryIds'
import { extractLast10Digits } from '@/lib/formatMobileNumber'
import { sendWelcomeAboardTemplate, sendWelcomeMessageTemplate } from '@/lib/whatsapp'
// import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma';
import axios from 'axios'
import { NextRequest } from 'next/server'
import pool from "@/lib/db"; // added for PG



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
  conversationState?: ConversationState
  lastInteraction?: Date
  contextData?: {
    selectedCategory?: string
    eventIds?: string[]
    selectedEventId?: string
    registeredEventIds?: string[]
  }
}

// Constants
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const WHATSAPP_API_URL = `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`
const VERSION = 'v18.0' // Meta Graph API version
const flowBaseUrl = `https://graph.facebook.com/${VERSION}/${PHONE_NUMBER_ID}`

// Define conversation states
enum ConversationState {
  IDLE = 'idle',
  AWAITING_CATEGORY_SELECTION = 'awaiting_category_selection',
  AWAITING_EVENT_SELECTION = 'awaiting_event_selection',
  AWAITING_REGISTRATION_CONFIRMATION = 'awaiting_registration_confirmation',
  AWAITING_REGISTERED_EVENT_SELECTION = 'awaiting_registered_event_selection',
}

// Process incoming messages
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Check if this is a WhatsApp message

    if (body?.object && body?.entry?.length > 0) {
      const entry = body.entry[0]

      // Make sure it's a WhatsApp Business Account
      if (entry?.changes?.length > 0) {
        const change = entry.changes[0]

        if (change?.value?.messages?.length > 0) {
          // Extract message details
          const message = change.value.messages[0]
          let from = message.from // User's phone number
          from = extractLast10Digits(from) // Extract last 10 digits
          const messageId = message.id

          console.log(`Received message from ${from}:`, JSON.stringify(message))

          // // before actually checing the message, check if the body of the message is Hello
          // if (message.text.body.toLowerCase().includes('hello')) {
          //   await sendTextMessage(from, '👋 Hello! How can I help you today?')
          //   return
          // }

          // Process the message based on type and user state
          handleIncomingMessage(from, message)
        }
      }
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response('Server Error', { status: 500 })
  }
}

/**
 * Main handler for incoming messages
 */
async function handleIncomingMessage(
  phoneNumber: string,
  message: WhatsAppMessage,
) {
  try {
    // Check if user exists, create if not
    console.log('Checking user by phone:', phoneNumber)
    // let user = await prisma.user.findUnique({
    //   where: { mobileNumber: phoneNumber },
    //   select: {
    //     id: true,
    //   }
    // })
    // console.log('User:', user)


    //setup for pg query
    // try {
    //   const client = await pool.connect();
    //   await client.query("SELECT NOW()"); // simple lightweight query
    //   client.release();
    //   console.log("✅ PostgreSQL is connected!");
    //   } catch (error: any) {
    //   console.error("❌ PostgreSQL connection error:", error.message);
    // }

    const result = await pool.query(
    'SELECT * FROM "User" WHERE "mobileNumber" = $1 LIMIT 1',
    [phoneNumber]
    );
    const user = result.rows[0];
    console.log("✅ Found User:", user);
    

    if (!user) {
      // Create a new user with minimal info
      console.log('Creating new user:', phoneNumber);
      // the new user form will be added here right now we are only figuring out the flow for the existing user
     // let res1 = await sendWelcomeMessageTemplate(phoneNumber, 'https://traderscontent.livetraders.com/galary/875199.jpeg');
    //  console.log("sendWelcomeMessageTemplate ====== ", res1);
      let res2 = await sendFlowTemplate(phoneNumber, 'enter_your_details');
     // console.log("sendFlowTemplate ====== ", res2);
      return
    }

    // Handle conversation reset and update last interaction in a single operation
    if (user) {
      const updateData: any = {
        lastInteraction: new Date(),
      }

      // Check if last interaction was more than 15 minutes ago
      if (user.lastInteraction) {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
        if (new Date(user.lastInteraction) < fifteenMinutesAgo) {
          console.log('Reset conversation state to IDLE due to inactivity')
          updateData.conversationState = ConversationState.IDLE
        }
      } else {
        // If no last interaction, ensure we have a conversation state
        updateData.conversationState =
          user.conversationState || ConversationState.IDLE
      }

      // Update user with a single database call
      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      })
    }

    // Check if this is a button response
    if (
      user &&
      message.type === 'interactive' &&
      message.interactive?.type === 'button_reply'
    ) {
      const handled = await handleButtonResponse(user, message)
      if (handled) return // Exit if we handled the button
    }

    if (
      message?.type === 'interactive' &&
      message.interactive?.type === 'nfm_reply'
    ) {
      // This is a flow response
      const flowResponse = message.interactive.nfm_reply
      if (!flowResponse) {
        console.error('Invalid flow response structure')
        return
      }

      const flowToken = flowResponse.response_json.flow_token
      const body = flowResponse.body
      const name = flowResponse.name

      if (body === 'Sent' && name === 'flow') {
        console.log('Flow response received with token:', flowToken)

        // await sendTextMessage(
        //   phoneNumber,
        //   `Welcome aboard! We're  glad to have you here! 🎉\n\nDid you know? You can earn 50 Fiddle Coins for each friend who successfully registers using your referral code \n ${user.referralCode} \n Share the love and watch your coins grow! 💫`,
        // )

        // await sendReferralCodeCtaMessage(phoneNumber, '50', user.referralCode)
        await sendWelcomeAboardTemplate(phoneNumber, '50', user.referralCode)

        await sendCategoryList(user)
        return // Exit early as flow responses don't need further processing
      }
    }

    // Handle message based on current conversation state
    switch (user?.conversationState) {
      case ConversationState.IDLE:
        await handleIdleState(user, message)
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
        // Reset to idle state if unknown and show categories
        await sendCategoryList(user)
        break
    }
  } catch (error) {
    console.error('Error handling message:', error)
    if (axios.isAxiosError(error)) {
      // The request was made and server responded with non-2xx status
      console.error('Error data:', error.response?.data)
      // console.error('Status:', error.response.status)
      // console.error('Headers:', error.response.headers)
    } else if (error instanceof Error) {
      // Something happened in setting up the request
      console.error('Error message:', error.message)
    }
    console.error('Error config:', (error as any).config)
    // Send error message to user
    await sendTextMessage(
      phoneNumber,
      'Sorry, an error occurred. Please try again later.',
    )
  }
}

/**
 * Handle messages when user is in idle state
 */
async function handleIdleState(user: any, message: any) {
  try {
    // Send welcome message
    await sendTextMessage(
      user.mobileNumber,
      `Hello ${user.name} 👋, welcome back! Let's explore your fitness journey together.`,
    )

    // Check if user is registered for any events
    const userRegisteredEvents = await prisma.eventRegistration.findMany({
      where: {
        userId: user.id,
      },
      include: {
        event: true,
      },
    })

    if (userRegisteredEvents.length > 0) {
      // User has registered events, offer two options
      const buttons = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: user.mobileNumber,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: 'What would you like to do today?',
          },
          action: {
            buttons: [
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
            ],
          },
        },
      }

      // Send buttons and update state to handle the response
      await axios.post(WHATSAPP_API_URL, buttons, {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      })
    } else {
      // User has no registered events, directly show event categories
      await sendCategoryList(user)
    }
  } catch (error) {
    console.error('Error in handleIdleState:', error)
    await sendTextMessage(
      user.mobileNumber,
      'Sorry, I encountered an error. Please try again later.',
    )
  }
}

/**
 * Send list of registered events to user
 */
async function sendRegisteredEventsList(user: any) {
  try {
    // Fetch user's registered events
    const registeredEvents = await prisma.eventRegistration.findMany({
      where: {
        userId: user.id,
      },
      include: {
        event: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (registeredEvents.length === 0) {
      await sendTextMessage(
        user.mobileNumber,
        "You are not registered for any events yet. Let's find some events for you!",
      )

      // Show category list since user has no registered events
      await sendCategoryList(user)
      return
    }

    // Format events for display
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
        description: `${formattedDate} - ${event.eventTime}`,
      }
    })

    // Create interactive list message
    const listMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: user.mobileNumber,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: {
          type: 'text',
          text: 'Your Registered Events',
        },
        body: {
          text: "Here are the events you've registered for. Select one to view details.",
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

    // Send list message and update user state
    await axios.post(WHATSAPP_API_URL, listMessage, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    // Update user state to awaiting registered event selection
    await prisma.user.update({
      where: { id: user.id },
      data: {
        conversationState:
          ConversationState.AWAITING_REGISTERED_EVENT_SELECTION,
        contextData: {
          ...user.contextData,
          registeredEventIds: formattedEvents.map(e => e.id),
        },
      },
    })
  } catch (error) {
    console.error('Error sending registered events list:', error)
    throw error
  }
}

/**
 * Handle user selection of registered event
 */
async function handleRegisteredEventSelection(user: any, message: any) {
  try {
    // Extract selected event ID from the interactive message
    let selectedEventId = null

    if (
      message.type === 'interactive' &&
      message.interactive?.type === 'list_reply'
    ) {
      selectedEventId = message.interactive.list_reply.id
    } else if (message.type === 'text') {
      // Try to find event by ID in text
      const text = message.text.body.trim()

      // Check if text matches any registered event ID
      if (user.contextData?.registeredEventIds?.includes(text)) {
        selectedEventId = text
      }
    }

    if (!selectedEventId) {
      await sendTextMessage(
        user.mobileNumber,
        "I couldn't identify which event you selected. Please try again.",
      )

      // Show registered events list again
      await sendRegisteredEventsList(user)
      return
    }

    // Fetch the selected event details with pool information
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

      // Reset state to idle
      await prisma.user.update({
        where: { id: user.id },
        data: { conversationState: ConversationState.IDLE },
      })

      return
    }

    // Format event date and time
    const eventDate = new Date(event.eventDate)
    const formattedDate = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })

    // Format trainer names
    const trainerNames =
      event.eventTrainers.map(et => et.trainer.name).join(', ') || 'TBA'

    // Check if pools are assigned and user is in a pool
    const poolsAssigned = event.poolsAssigned
    const userPool = event.pools.find(pool => pool.attendees.length > 0)

    let messageBody =
      `📅 *Date:* ${formattedDate}\n` +
      `⏰ *Time:* ${event.eventTime}\n` +
      `📍 *Location:* ${event.location || 'Online'}\n` +
      `👨‍🏫 *Trainers:* ${trainerNames}\n\n` +
      `${event.description || 'Join this exciting event!'}\n\n`

    if (poolsAssigned && userPool) {
      // Pool is created and user is assigned
      let meetLinkText = userPool.meetLink || 'Link will be shared soon'

      // Add instructions for Google Meet links
      if (meetLinkText.includes('meet.google.com')) {
        messageBody +=
          `🎉 *Your Event is Ready!*\n\n` +
          `You've been assigned to: *${userPool.name || 'Main Pool'}*\n` +
          `📱 *Meeting Link:* ${meetLinkText}\n\n` +
          `*Note:* You may need to request access to join the meeting. This happens when the Google Meet security settings require manual admission of participants. Make sure to:\n` +
          `- Join using the same Google account email that was used for registration\n` +
          `- Join a few minutes before the event starts\n` +
          `- Keep your display name clear and recognizable\n\n` +
          `See you at the event!`
      } else {
        messageBody +=
          `🎉 *Your Event is Ready!*\n\n` +
          `You've been assigned to: *${userPool.name || 'Main Pool'}*\n` +
          `📱 *Meeting Link:* ${meetLinkText}\n\n` +
          `See you at the event!`
      }
    } else {
      // Pool is not created yet
      messageBody +=
        `⏳ *Status:* Your registration is confirmed! \n\n` +
        `You'll receive event details including joining instructions before the event starts.`
    }

    // Send event details as text message
    await sendTextMessage(
      user.mobileNumber,
      `*${event.title}*\n\n${messageBody}`,
    )

    // Reset conversation state to idle
    await prisma.user.update({
      where: { id: user.id },
      data: { conversationState: ConversationState.IDLE },
    })

    // After showing event details, ask if user wants to do something else
    setTimeout(async () => {
      await handleIdleState(user, message)
    }, 2000)
  } catch (error) {
    console.error('Error handling registered event selection:', error)
    await sendTextMessage(
      user.mobileNumber,
      'Sorry, I encountered an error while retrieving event details. Please try again later.',
    )

    // Reset conversation state on error
    await prisma.user.update({
      where: { id: user.id },
      data: { conversationState: ConversationState.IDLE },
    })
  }
}

/**
 * Fetch available event categories and send as interactive list
 */
async function sendCategoryList(user: any) {
  try {
    // Fetch upcoming events with categories
    const upcomingCategories = await getUpcomingEventCategories()

    console.log('Upcoming categories:', upcomingCategories)
    console.log(
      'Upcoming categories rows:',
      upcomingCategories.map(category => ({
        id: category.value,
        title: category.label,
        description: `${category.label} events`,
      })),
    )

    if (upcomingCategories.length === 0) {
      await sendTextMessage(
        user.mobileNumber,
        'Sorry, there are no upcoming events available at the moment. Please check back later!',
      )
      await prisma.user.update({
        where: { id: user.id },
        data: {
          conversationState: ConversationState.IDLE,
          // Optionally, clear context data if it's no longer relevant
          // contextData: {},
        },
      })
      return
    }

    // Prepare interactive list message for WhatsApp
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

    // Send list message via WhatsApp API
    const response = await axios.post(WHATSAPP_API_URL, listMessage, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    // Update user state to awaiting category selection
    await prisma.user.update({
      where: { id: user.id },
      data: {
        conversationState: ConversationState.AWAITING_CATEGORY_SELECTION,
      },
    })

    console.log('Category list sent:', response.data)
  } catch (error) {
    console.error('Error sending category list:', error)
    throw error
  }
}

/**
 * Get unique categories from upcoming events
 */
async function getUpcomingEventCategories() {
  const now = new Date()
  const upcomingEvents = await prisma.event.findMany({
    where: {
      eventDate: {
        gt: now,
      },
      // Only include events with registration open
      OR: [
        { registrationDeadline: null },
        { registrationDeadline: { gt: now } },
      ],
    },
    select: {
      category: true,
    },
    orderBy: {
      eventDate: 'asc',
    },
  })

  // Extract unique categories from upcoming events
  const eventCategories = [
    ...new Set(upcomingEvents.map(event => event.category)),
  ]

  // Match with EVENT_CATEGORIES to get full category details
  return EVENT_CATEGORIES.filter(category =>
    eventCategories.some(
      eventCategory =>
        category.value === eventCategory ||
        category.value === `cat_${eventCategory}` ||
        eventCategory === `cat_${category.value.replace('cat_', '')}`,
    ),
  )
}

/**
 * Handle category selection response from user
 */
async function handleCategorySelection(user: any, message: any) {
  try {
    // Extract selected category from interactive message response
    let selectedCategory = null

    console.log('categoryselection', message)

    if (
      message.type === 'interactive' &&
      message.interactive?.type === 'list_reply'
    ) {
      selectedCategory = message.interactive.list_reply.id
    } else if (message.type === 'text') {
      // Try to match text with category values or labels
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
      // If category not recognized, ask again
      await sendTextMessage(
        user.mobileNumber,
        "Sorry, I couldn't understand your selection. Please choose from the list of categories.",
      )
      await sendCategoryList(user)
      return
    }

    // Fetch events for selected category
    const events = await getUpcomingEventsByCategory(selectedCategory)

    if (events.length === 0) {
      // No events in this category
      await sendTextMessage(
        user.mobileNumber,
        `Sorry, there are no upcoming events in the "${selectedCategory}" category. Would you like to check other categories?`,
      )
      // Reset to idle to allow choosing another category
      await prisma.user.update({
        where: { id: user.id },
        data: { conversationState: ConversationState.IDLE },
      })
      await sendCategoryList(user)
      return
    }

    // Store selected category in user context
    await prisma.user.update({
      where: { id: user.id },
      data: {
        contextData: { selectedCategory, eventIds: events.map(e => e.id) },
        conversationState: ConversationState.AWAITING_EVENT_SELECTION,
      },
    })

    // Send events list for the selected category
    await sendEventsList(user.mobileNumber, events, selectedCategory)
  } catch (error) {
    console.error('Error handling category selection:', error)
    throw error
  }
}

/**
 * Fetch upcoming events by category
 */
async function getUpcomingEventsByCategory(category: string) {
  const now = new Date()
  return prisma.event.findMany({
    where: {
      category,
      eventDate: {
        gt: now,
      },
      OR: [
        { registrationDeadline: null },
        { registrationDeadline: { gt: now } },
      ],
    },
    orderBy: {
      eventDate: 'asc',
    },
    take: 10, // Limit to 10 events as WhatsApp lists have limits
  })
}

/**
 * Send list of events to user
 */
async function sendEventsList(
  phoneNumber: string,
  events: any[],
  categoryName: string,
) {
  try {
    // Find category label for display
    const categoryInfo = EVENT_CATEGORIES.find(
      cat => cat.value === categoryName,
    )
    const categoryLabel = categoryInfo ? categoryInfo.label : categoryName

    // Format event dates for display
    const formattedEvents = events.map(event => {
      const eventDate = new Date(event.eventDate)
      const formattedDate = eventDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })

      return {
        id: event.id,
        title: event.title,
        description: `${formattedDate} - ${event.eventTime}`,
      }
    })

    // Create interactive list message
    const listMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: {
          type: 'text',
          text: `${categoryLabel} Events`,
        },
        body: {
          text: `Here are the upcoming ${categoryLabel} events. Select one to view details and register.`,
        },
        footer: {
          text: 'Select an event for more details',
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

    // Send list message via WhatsApp API
    await axios.post(WHATSAPP_API_URL, listMessage, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Error sending events list:', error)
    throw error
  }
}

/**
 * Handle event selection from user
 */
async function handleEventSelection(user: any, message: any) {
  console.log('User selected event:', message)

  // First check if this is actually a category selection (with cat_ prefix)
  if (
    message.type === 'interactive' &&
    message.interactive?.type === 'list_reply' &&
    message.interactive.list_reply.id.startsWith('cat_')
  ) {
    console.log(
      'Category prefix detected:',
      message.interactive.list_reply.id.substring(4),
    )
    await handleCategorySelection(user, message)
    return
  }

  try {
    // Extract selected event ID from the interactive message
    let selectedEventId = null

    if (
      message.type === 'interactive' &&
      message.interactive?.type === 'list_reply'
    ) {
      selectedEventId = message.interactive.list_reply.id
    } else if (message.type === 'text') {
      // Try to find event by ID in text - this is a fallback option
      const text = message.text.body.trim()

      // If the user's contextData contains eventIds, check if text matches any
      if (user.contextData?.eventIds?.includes(text)) {
        selectedEventId = text
      }
    }

    if (!selectedEventId) {
      await sendTextMessage(
        user.mobileNumber,
        "I couldn't identify which event you selected. Please try again.",
      )

      // Reset to idle state and show categories again
      await prisma.user.update({
        where: { id: user.id },
        data: { conversationState: ConversationState.IDLE },
      })

      await sendCategoryList(user)
      return
    }

    // Fetch the selected event details from database
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

      // Reset state to idle
      await prisma.user.update({
        where: { id: user.id },
        data: { conversationState: ConversationState.IDLE },
      })

      return
    }

    // Format event date and time
    const eventDate = new Date(event.eventDate)
    const formattedDate = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })

    // Check if user is already registered
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

      await prisma.user.update({
        where: { id: user.id },
        data: {
          contextData: {
            ...(user.contextData || {}),
            selectedEventId,
          },
          conversationState: ConversationState.IDLE,
        },
      })

      return
    }

    // Format trainer names
    const trainerNames =
      event.eventTrainers.map(et => et.trainer.name).join(', ') || 'TBA'

    // Get registration count
    const registrationCount = await prisma.eventRegistration.count({
      where: { eventId: event.id },
    })

    // Calculate spots remaining
    const spotsRemaining = event.maxCapacity - registrationCount

    // Construct event details message with proper formatting
    const messageBody =
      `📅 *Date:* ${formattedDate}\n` +
      `⏰ *Time:* ${event.eventTime}\n` +
      `📍 *Location:* ${event.location || 'Online'}\n` +
      `👨‍🏫 *Trainers:* ${trainerNames}\n\n` +
      `${event.description || 'Join this exciting event!'}\n\n` +
      `*Spots Remaining:* ${spotsRemaining} out of ${event.maxCapacity}`

    // Build registration URL with proper encoding
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      'https://fiddle-fitness-fiddle-fitness-projects.vercel.app/'
    const registrationUrl = new URL(
      `/payment/${event.id}/${user.mobileNumber}`,
      baseUrl,
    )

    // Send interactive button message
    // Send event details as text message
    await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: user.mobileNumber,
        type: 'text',
        text: {
          body: `*${
            event.title
          }*\n\n${messageBody}\n\nRegister here: ${registrationUrl.toString()}`,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    )

    // Update user context with the selected event
    await prisma.user.update({
      where: { id: user.id },
      data: {
        contextData: {
          ...(user.contextData || {}),
          selectedEventId,
        },
        conversationState: ConversationState.IDLE,
      },
    })
  } catch (error) {
    console.error('Error sending template message:')
    if (axios.isAxiosError(error)) {
      // The request was made and the server responded with a status code that falls out of the range of 2xx
      console.error('Error data:', error.response?.data)
      // console.error('Status:', error.response.status);
    } else if (error instanceof Error) {
      // Something happened in setting up the request that triggered an error
      console.error('Error message:', error.message)
    }
    throw error
    await sendTextMessage(
      user.mobileNumber,
      'Sorry, I encountered an error while retrieving event details. Please try again later.',
    )

    // Reset conversation state on error
    await prisma.user.update({
      where: { id: user.id },
      data: { conversationState: ConversationState.IDLE },
    })
  }
}

/**
 * Handle registration confirmation
 */
async function handleRegistrationConfirmation(user: any, message: any) {
  // This function would be implemented to handle registration confirmation
  // For now we'll just send a placeholder response
  await sendTextMessage(
    user.mobileNumber,
    'Registration confirmation flow would be implemented here.',
  )

  // Reset conversation state
  await prisma.user.update({
    where: { id: user.id },
    data: { conversationState: ConversationState.IDLE },
  })
}

/**
 * Utility function to send a simple text message
 */
export async function sendTextMessage(phoneNumber: string, message: string) {
  try {
    console.log("Check Token" + WHATSAPP_TOKEN);
    const response = await axios({
      method: 'POST',
      url: WHATSAPP_API_URL,
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: {
          body: message,
        },
      },
    })
  } catch (error) {
    console.error('Error sending text message:', error)
    throw error
  }
}

export async function sendReferralCodeCtaMessage(
  phoneNumber: string,
  referralCode: string,
  messagePrefix?: string,
) {
  // Default message prefix if not provided
  const prefix = messagePrefix || "Here's your referral code:"

  // Message body clearly showing the referral code.
  // Added a hint for users to tap/hold the code in the message body to copy,
  // as button actions for direct copy-to-clipboard are limited in non-template messages.
  const messageBodyText = `${prefix} ${referralCode}\n\n(You can usually tap and hold the code above to copy it.)`

  // Determine button title based on referral code length.
  // WhatsApp button titles have a maximum length (typically 20 characters).
  let buttonTitle = referralCode
  if (referralCode.length > 20) {
    buttonTitle = 'Copy Code' // Generic title if code is too long for the button
  }

  // Construct the payload for the interactive message
  const payload = {
    messaging_product: 'whatsapp',
    to: phoneNumber,
    type: 'interactive',
    interactive: {
      type: 'button', // Type of interactive message
      body: {
        text: messageBodyText, // Main text of the message
      },
      action: {
        buttons: [
          {
            type: 'reply', // This type of button sends a reply message back to your webhook when tapped
            reply: {
              // The title is what the user sees on the button (max 20 chars)
              title: buttonTitle,
              // The ID is sent back to your webhook when the button is tapped.
              // Make this ID unique and descriptive for your backend logic (max 256 chars).
              // Using a combination of a prefix, part of the code, and a timestamp for uniqueness.
              id: `referral_cta_${referralCode
                .substring(0, 10)
                .replace(/\s/g, '_')}_${Date.now()}`,
            },
          },
        ],
      },
    },
  }

  try {
    // Make the POST request to the WhatsApp API
    const response = await axios({
      method: 'POST',
      url: WHATSAPP_API_URL,
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: payload,
    })

    console.log('Referral code CTA message sent successfully:', response.data)
    return response.data // Return the response for further handling if needed
  } catch (error) {
    // Log detailed error information if available
    if (axios.isAxiosError(error) && error.response) {
      console.error(
        'Error sending referral code CTA message. Status:',
        error.response.status,
        'Data:',
        error.response.data,
      )
    } else if (error instanceof Error) {
      console.error('Error sending referral code CTA message:', error.message)
    } else {
      console.error(
        'An unknown error occurred while sending referral code CTA message:',
        error,
      )
    }
    throw error // Re-throw the error for the caller to handle
  }
}

async function sendFlowTemplate(
  recipient: string,
  templateName: string,
  languageCode: string = 'en',
) {
  try {
    console.log(`Sending flow template "${templateName}" to ${recipient}...`)

    const response = await axios({
      method: 'POST',
      url: `${flowBaseUrl}/messages`,
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
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
                          phoneNumber: '',
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
    if (axios.isAxiosError(error)) {
      // The request was made and the server responded with a status code that falls out of the range of 2xx
      console.error('Error data:', error.response?.data)
      // console.error('Status:', error.response.status);
    } else if (error instanceof Error) {
      // Something happened in setting up the request that triggered an error
      console.error('Error message:', error.message)
    }
    throw error
  }
}

// Add this function to handle button responses
async function handleButtonResponse(user: any, message: any) {
  // This function should be called from handleIncomingMessage when a button is pressed
  if (
    message.type === 'interactive' &&
    message.interactive?.type === 'button_reply'
  ) {
    const buttonId = message.interactive.button_reply.id

    if (buttonId === 'view_registered_events') {
      await sendRegisteredEventsList(user)
    } else if (buttonId === 'register_new_event') {
      await sendCategoryList(user)
    }
    return true // Indicate that we handled the button
  }
  return false // Not a button response
}

// Webhook verification for WhatsApp
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  // Check if token and mode exist in the query
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
      // Respond with the challenge token from the request
      console.log('WEBHOOK_VERIFIED')
      return new Response(challenge, { status: 200 })
    } else {
      // Respond with '403 Forbidden' if verify tokens do not match
      return new Response('Forbidden', { status: 403 })
    }
  }

  return new Response('Bad Request', { status: 400 })
}
