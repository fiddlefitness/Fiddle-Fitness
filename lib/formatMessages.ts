import { CHARACTER_LIMITS, truncateText } from './whatsappLimits';

/**
 * Formats an event details message ensuring it stays within character limits
 * 
 * @param eventDetails - Event details object containing title, date, time, etc.
 * @returns Formatted message text
 */
export function formatEventDetailsMessage(eventDetails: {
  title: string;
  date: string;
  time: string;
  location?: string;
  trainers?: string;
  description?: string;
  spotsRemaining?: number;
  maxCapacity?: number;
}) {
  // Make sure none of the event details exceeds character limits individually
  // This ensures we can control the overall message length
  const truncatedDetails = {
    title: truncateText(eventDetails.title, 50),
    date: truncateText(eventDetails.date, 30),
    time: truncateText(eventDetails.time, 30),
    location: truncateText(eventDetails.location || 'Online', 50),
    trainers: truncateText(eventDetails.trainers || 'To be announced', 100),
    description: truncateText(eventDetails.description || '', 200),
  };

  // Build message content with emojis and formatting
  let messageBody = 
    `📅 *Date:* ${truncatedDetails.date}\n` +
    `⏰ *Time:* ${truncatedDetails.time}\n` +
    `📍 *Location:* ${truncatedDetails.location}\n` +
    `👨‍🏫 *Trainers:* ${truncatedDetails.trainers}\n\n`;
  
  // Add description if available
  if (truncatedDetails.description) {
    messageBody += `${truncatedDetails.description}\n\n`;
  }
  
  // Add capacity info if available
  if (eventDetails.spotsRemaining !== undefined && eventDetails.maxCapacity) {
    messageBody += `*Spots Remaining:* ${eventDetails.spotsRemaining} out of ${eventDetails.maxCapacity}`;
  }
  
  // Ensure the total message doesn't exceed WhatsApp text message limit
  // Leave room for the title and registration link that might be added later
  const reservedSpace = 100; // Space for title and registration link
  const maxBodyLength = CHARACTER_LIMITS.TEXT_MESSAGE - reservedSpace;
  
  return truncateText(messageBody, maxBodyLength);
}

/**
 * Creates a complete event message with title and registration link
 * 
 * @param eventTitle - The title of the event
 * @param messageBody - The formatted message body from formatEventDetailsMessage
 * @param registrationUrl - URL for event registration 
 * @returns Complete formatted message
 */
export function createEventMessage(eventTitle: string, messageBody: string, registrationUrl: string) {
  const truncatedTitle = truncateText(eventTitle, 80);
  const truncatedUrl = truncateText(registrationUrl, 100);
  
  // Combine all elements into a complete message
  const fullMessage = `${truncatedTitle}\n\n${messageBody}\n\nRegister here: ${truncatedUrl}`;
  
  // Final check to ensure we're under the absolute maximum
  return truncateText(fullMessage, CHARACTER_LIMITS.TEXT_MESSAGE);
} 