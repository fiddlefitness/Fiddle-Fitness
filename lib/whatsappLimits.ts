/**
 * WhatsApp API Character Limits
 * 
 * This file contains utility functions to ensure that dynamic content
 * in WhatsApp messages doesn't exceed the platform's character limits.
 */

// Message component limits as per WhatsApp API docs
export const CHARACTER_LIMITS = {
  // Text message
  TEXT_MESSAGE: 4096,
  
  // Interactive components
  INTERACTIVE_HEADER_TEXT: 60,
  INTERACTIVE_BODY_TEXT: 1024,
  INTERACTIVE_FOOTER_TEXT: 60,
  
  // Buttons
  BUTTON_TEXT: 20,
  REPLY_BUTTON_MAX: 3, // Maximum number of reply buttons
  
  // List message components
  LIST_BUTTON_TEXT: 20,
  LIST_SECTION_TITLE: 24,
  LIST_ROW_TITLE: 24,
  LIST_ROW_DESCRIPTION: 72,
  LIST_ROW_MAX: 10, // Maximum number of rows per section
  
  // Template components
  TEMPLATE_PARAMETER: 1024,
  
  // Dynamic URL
  URL_LENGTH: 2000,
};

/**
 * Truncates text to a specific character limit and adds ellipsis if needed
 * 
 * @param text - The text to truncate
 * @param limit - Maximum allowed characters
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, limit: number): string {
  if (!text) return '';
  
  // If text is already within limit, return it as is
  if (text.length <= limit) return text;
  
  // Otherwise truncate and add ellipsis (account for ellipsis in the limit)
  return text.substring(0, limit - 3) + '...';
}

/**
 * Truncates text for use in interactive message headers
 * 
 * @param text - Header text
 * @returns Truncated header text
 */
export function truncateHeader(text: string): string {
  return truncateText(text, CHARACTER_LIMITS.INTERACTIVE_HEADER_TEXT);
}

/**
 * Truncates text for use in interactive message bodies
 * 
 * @param text - Body text
 * @returns Truncated body text
 */
export function truncateBody(text: string): string {
  return truncateText(text, CHARACTER_LIMITS.INTERACTIVE_BODY_TEXT);
}

/**
 * Truncates text for use in interactive message footers
 * 
 * @param text - Footer text
 * @returns Truncated footer text
 */
export function truncateFooter(text: string): string {
  return truncateText(text, CHARACTER_LIMITS.INTERACTIVE_FOOTER_TEXT);
}

/**
 * Truncates text for use in button labels
 * 
 * @param text - Button text
 * @returns Truncated button text
 */
export function truncateButtonText(text: string): string {
  return truncateText(text, CHARACTER_LIMITS.BUTTON_TEXT);
}

/**
 * Truncates text for use in list row titles
 * 
 * @param text - Row title
 * @returns Truncated row title
 */
export function truncateListTitle(text: string): string {
  return truncateText(text, CHARACTER_LIMITS.LIST_ROW_TITLE);
}

/**
 * Truncates text for use in list row descriptions
 * 
 * @param text - Row description
 * @returns Truncated row description
 */
export function truncateListDescription(text: string): string {
  return truncateText(text, CHARACTER_LIMITS.LIST_ROW_DESCRIPTION);
}

/**
 * Truncates text for use in template parameters
 * 
 * @param text - Template parameter text
 * @returns Truncated template parameter text
 */
export function truncateTemplateParam(text: string): string {
  return truncateText(text, CHARACTER_LIMITS.TEMPLATE_PARAMETER);
}

/**
 * Ensures a list doesn't exceed the maximum number of allowed rows
 * 
 * @param items - Array of items for the list
 * @returns Truncated array limited to the maximum number of rows
 */
export function limitListRows<T>(items: T[]): T[] {
  return items.slice(0, CHARACTER_LIMITS.LIST_ROW_MAX);
} 