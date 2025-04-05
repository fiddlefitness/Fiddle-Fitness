// Test script for all WhatsApp templates
import dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import {
    sendEventMeetLinkTemplate,
    sendFlowTemplate,
    sendInteractiveMessageWithLink,
    sendMeetLinkTrainerTemplate,
    sendTextMessage,
    sendTrainerReminder2Template,
    sendTrainerReminderTemplate,
    sendUserReminder2Template,
    sendUserReminderTemplate,
    sendWelcomeMessageTemplate
} from '../lib/whatsapp.ts';

// Initialize dotenv
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config();

// Constants
const RECIPIENT_PHONE = '8305387299'; // Target phone number for testing

// Example data for templates
const EVENT_TITLE = 'Zumba Dance Session';
const EVENT_DATE = 'Monday, April 1, 2024';
const EVENT_TIME = '6:00 PM - 7:00 PM';
const TRAINER_NAME = 'Kapil Bamotriya';
const MEET_LINK = 'https://us04web.zoom.us/j/71912345678?pwd=abcdefghijklmnopqrstuvwxyz123456';
const PAYMENT_LINK = 'https://fiddle-fitness-fiddle-fitness-projects.vercel.app/payment/event123';
const IMAGE_URL = 'https://images.pexels.com/photos/4720236/pexels-photo-4720236.jpeg';
const MESSAGE_BODY = 'This is a test message for the WhatsApp API. Join our fitness session and stay healthy!';
const BUTTON_TEXT = 'Complete Payment';

/**
 * Utility function to log template test info
 */
function logTestInfo(templateName, ...params) {
  console.log('='.repeat(50));
  console.log(`TESTING: ${templateName}`);
  console.log('-'.repeat(50));
  
  // Log each parameter
  if (params.length > 0) {
    console.log('Parameters:');
    params.forEach((param, index) => {
      console.log(`  ${index + 1}. ${param}`);
    });
  } else {
    console.log('No parameters required for this template');
  }
  
  console.log('-'.repeat(50));
}

/**
 * Test send_event_meet_link template
 */
async function testEventMeetLinkTemplate() {
  try {
    logTestInfo('send_event_meet_link', 
      `Event Title: ${EVENT_TITLE}`, 
      `Event Date: ${EVENT_DATE}`, 
      `Event Time: ${EVENT_TIME}`,
      `Trainer Name: ${TRAINER_NAME}`,
      `Meet Link: ${MEET_LINK}`
    );
    
    const response = await sendEventMeetLinkTemplate(
      RECIPIENT_PHONE,
      EVENT_TITLE,
      EVENT_DATE,
      EVENT_TIME,
      TRAINER_NAME,
      MEET_LINK
    );
    
    console.log('SUCCESS!');
    console.log('Response:', JSON.stringify(response, null, 2));
    return true;
  } catch (error) {
    console.log('ERROR!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    return false;
  }
}

/**
 * Test simple text message
 */
async function testTextMessage() {
  try {
    logTestInfo('Text Message (not a template)', 
      `Message: "This is a test message for WhatsApp API"`
    );
    
    const response = await sendTextMessage(
      RECIPIENT_PHONE,
      "This is a test message for WhatsApp API"
    );
    
    console.log('SUCCESS!');
    console.log('Response:', JSON.stringify(response, null, 2));
    return true;
  } catch (error) {
    console.log('ERROR!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    return false;
  }
}

/**
 * Test welcome_message_with_img template
 */
async function testWelcomeMessageTemplate() {
  try {
    logTestInfo('welcome_message_with_img', 
      `Image URL: ${IMAGE_URL}`
    );
    
    const response = await sendWelcomeMessageTemplate(
      RECIPIENT_PHONE,
      IMAGE_URL
    );
    
    console.log('SUCCESS!');
    console.log('Response:', JSON.stringify(response, null, 2));
    return true;
  } catch (error) {
    console.log('ERROR!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    return false;
  }
}

/**
 * Test flow template (enter_your_details)
 */
async function testFlowTemplate() {
  try {
    logTestInfo('Flow Template (enter_your_details)', 
      `Template Name: enter_your_details`
    );
    
    const response = await sendFlowTemplate(
      RECIPIENT_PHONE,
      'enter_your_details'
    );
    
    console.log('SUCCESS!');
    console.log('Response:', JSON.stringify(response, null, 2));
    return true;
  } catch (error) {
    console.log('ERROR!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    return false;
  }
}

/**
 * Test send_meet_link_trainer template
 */
async function testMeetLinkTrainerTemplate() {
  try {
    logTestInfo('send_meet_link_trainer', 
      `Trainer Name: ${TRAINER_NAME}`,
      `Event Title: ${EVENT_TITLE}`, 
      `Event Date: ${EVENT_DATE}`, 
      `Event Time: ${EVENT_TIME}`,
      `Meet Link: ${MEET_LINK}`
    );
    
    const response = await sendMeetLinkTrainerTemplate(
      RECIPIENT_PHONE,
      TRAINER_NAME,
      EVENT_TITLE,
      EVENT_DATE,
      EVENT_TIME,
      MEET_LINK
    );
    
    console.log('SUCCESS!');
    console.log('Response:', JSON.stringify(response, null, 2));
    return true;
  } catch (error) {
    console.log('ERROR!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    return false;
  }
}

/**
 * Test trainer_reminder_1 template (no params)
 */
async function testTrainerReminderTemplate() {
  try {
    logTestInfo('trainer_reminder_1');
    
    const response = await sendTrainerReminderTemplate(
      RECIPIENT_PHONE
    );
    
    console.log('SUCCESS!');
    console.log('Response:', JSON.stringify(response, null, 2));
    return true;
  } catch (error) {
    console.log('ERROR!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    return false;
  }
}

/**
 * Test user_reminder_1 template (no params)
 */
async function testUserReminderTemplate() {
  try {
    logTestInfo('user_reminder_1');
    
    const response = await sendUserReminderTemplate(
      RECIPIENT_PHONE
    );
    
    console.log('SUCCESS!');
    console.log('Response:', JSON.stringify(response, null, 2));
    return true;
  } catch (error) {
    console.log('ERROR!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    return false;
  }
}

/**
 * Test interactive message with link (within 24-hour window)
 */
async function testInteractiveMessageWithLink() {
  try {
    logTestInfo('Interactive Message with Link', 
      `Event Title: ${EVENT_TITLE}`,
      `Message Body: ${MESSAGE_BODY}`,
      `Button Text: ${BUTTON_TEXT}`,
      `Link URL: ${PAYMENT_LINK}`
    );
    
    const response = await sendInteractiveMessageWithLink(
      RECIPIENT_PHONE,
      EVENT_TITLE,
      MESSAGE_BODY,
      BUTTON_TEXT,
      PAYMENT_LINK
    );
    
    console.log('SUCCESS!');
    console.log('Response:', JSON.stringify(response, null, 2));
    return true;
  } catch (error) {
    console.log('ERROR!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    return false;
  }
}

/**
 * Test user_reminder_2 template
 */
async function testUserReminder2Template() {
  try {
    logTestInfo('user_reminder_2', 
      `Event Title: ${EVENT_TITLE}`,
      `Meet Link: ${MEET_LINK}`
    );
    
    const response = await sendUserReminder2Template(
      RECIPIENT_PHONE,
      EVENT_TITLE,
      MEET_LINK
    );
    
    console.log('SUCCESS!');
    console.log('Response:', JSON.stringify(response, null, 2));
    return true;
  } catch (error) {
    console.log('ERROR!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    return false;
  }
}

/**
 * Test trainer_reminder_2 template
 */
async function testTrainerReminder2Template() {
  try {
    logTestInfo('trainer_reminder_2', 
      `Trainer Name: ${TRAINER_NAME}`,
      `Event Title: ${EVENT_TITLE}`,
      `Event Time: ${EVENT_TIME}`,
      `Meet Link: ${MEET_LINK}`
    );
    
    const response = await sendTrainerReminder2Template(
      RECIPIENT_PHONE,
      TRAINER_NAME,
      EVENT_TITLE,
      EVENT_TIME,
      MEET_LINK
    );
    
    console.log('SUCCESS!');
    console.log('Response:', JSON.stringify(response, null, 2));
    return true;
  } catch (error) {
    console.log('ERROR!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    return false;
  }
}

// Main function to test all templates
async function main() {
  console.log('Starting WhatsApp template tests...');
  console.log(`Target Phone: ${RECIPIENT_PHONE}`);
  console.log('='.repeat(50));
  
  const tests = [
    { name: 'Text Message', fn: testTextMessage },
    { name: 'Event Meet Link Template', fn: testEventMeetLinkTemplate },
    { name: 'Welcome Message Template', fn: testWelcomeMessageTemplate },
    { name: 'Flow Template', fn: testFlowTemplate },
    { name: 'Meet Link Trainer Template', fn: testMeetLinkTrainerTemplate },
    { name: 'Trainer Reminder Template', fn: testTrainerReminderTemplate },
    { name: 'User Reminder Template', fn: testUserReminderTemplate },
    { name: 'Interactive Message With Link', fn: testInteractiveMessageWithLink },
    { name: 'User Reminder 2 Template', fn: testUserReminder2Template },
    { name: 'Trainer Reminder 2 Template', fn: testTrainerReminder2Template }
  ];
  
  // Get test index from command line args
  const args = process.argv.slice(2);
  const testIndex = args.length > 0 ? parseInt(args[0]) : 0;
  
  console.log('Select which template to test:');
  console.log('0. All templates');
  tests.forEach((test, index) => {
    console.log(`${index + 1}. ${test.name}`);
  });
  console.log('='.repeat(50));
  
  try {
    if (testIndex === 0) {
      console.log('Testing all templates...');
      
      const results = [];
      for (const test of tests) {
        console.log(`\nRunning test: ${test.name}`);
        const success = await test.fn();
        results.push({ name: test.name, success });
      }
      
      // Print summary
      console.log('\n='.repeat(50));
      console.log('TEST SUMMARY:');
      console.log('-'.repeat(50));
      results.forEach(result => {
        console.log(`${result.name}: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
      });
      console.log('='.repeat(50));
    } else if (testIndex > 0 && testIndex <= tests.length) {
      console.log(`Testing only: ${tests[testIndex - 1].name}`);
      await tests[testIndex - 1].fn();
    } else {
      console.log('Invalid test index. Exiting.');
    }
    
    console.log('\nTest run completed!');
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Run all template tests
main(); 