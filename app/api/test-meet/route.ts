// app/api/test-meet/route.js
import { NextResponse } from 'next/server';


import { createGoogleMeet } from '@/lib/googleCalender';
import { sendAiSensyRequest, sendEventNotification } from '@/app/components/FiddleFitness';

export async function GET(request) {
  try {
    console.log("🚀 Starting demo Google Meet creation test...");
    
    // Hard-coded test data - REPLACE THESE WITH YOUR ACTUAL TEST PHONE NUMBERS
    const testUsers = [
      {
        id: "user1",
        name: "Kapil Bamotriya",
        email: "kapilbamotriya12345@gmail.com", // Replace with your actual email
        mobileNumber: "+918305387299", // Replace with your actual phone number
      },
      {
        id: "user2",
        name: "Test User",
        email: "lakhanbamotriya123@gmail.com", // Replace with a second email if available
        mobileNumber: "+918076333861", // Replace with a second phone number or reuse yours
      }
    ];
    
    const testEvent = {
      title: "Fitness Test Event",
      description: "This is a test event for Google Meet integration",
      eventDate: new Date(Date.now()), // Tomorrow
      eventTime: "18:00 - 19:00"
    };
    
    const testPool = {
      name: "Pool A",
      trainerName: "Fitness Trainer"
    };
    
    // Format date for logging
    const formattedDate = testEvent.eventDate.toLocaleDateString('en-IN', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    console.log(`📅 Test event scheduled for: ${formattedDate} at ${testEvent.eventTime}`);
    
    // Create start and end times for the Google Meet
    const meetStartTime = new Date(testEvent.eventDate);
    meetStartTime.setHours(7, 0, 0); // 6:00 PM
    
    const meetEndTime = new Date(testEvent.eventDate);
    meetEndTime.setHours(8, 0, 0); // 7:00 PM
    
    // Get user emails for the Google Meet
    const userEmails = testUsers.map(user => user.email).filter(email => email && email.includes('@'));
    
    console.log(`📧 Emails to be added to Google Meet: ${userEmails.join(', ')}`);
    
    // Create the Google Meet
    console.log("🔄 Creating Google Meet...");
    
    let meetData = null;
    try {
      meetData = await createGoogleMeet(
        `${testEvent.title} - ${testPool.name}`,
        meetStartTime.toISOString(),
        meetEndTime.toISOString(),
        userEmails
      );
      
      console.log("✅ Google Meet created successfully!");
      console.log(`🔗 Meet Link: ${meetData?.meetLink}`);
      console.log(`🆔 Calendar Event ID: ${meetData?.eventId}`);
    } catch (error) {
      console.error("❌ Error creating Google Meet:", error);
      console.error("Error details:", error.response?.data || error.message);
    }
    
    // Send notifications to users
    console.log("🔄 Sending notifications to users...");
    
    const notificationResults = [];
    for (const user of testUsers) {
      try {
        console.log(`📱 Sending notification to ${user.name} (${user.mobileNumber})...`);

         const params = {
              campaignName: 'Fiddle Fitness event testing',
              destination: user.mobileNumber,
              userName: 'Fiddle Fitness LLP',
              templateParams: [
              'value 1',
              'value 2',
              meetData?.meetLink,
              'randomlink.com/userid/eventid'
              ],
              source: 'new-landing-page form',
              media: {},
              buttons: [],
              carouselCards: [],
              location: {},
              attributes: {},
              paramsFallbackValue: {
              FirstName: 'user'
              },
            }
        
            const response = await sendAiSensyRequest(params)
            console.log(response)
        
        // const result = await sendEventNotification(
        //   user,
        //   testEvent.title,
        //   testEvent.eventDate,
        //   testEvent.eventTime,
        //   testPool.name,
        //   testPool.trainerName,
        //   meetData?.meetLink || "https://meet.google.com/test-link"
        // );
        
        console.log(`✅ Notification sent to ${user.name}!`);
        notificationResults.push({
          user: user.name,
          mobileNumber: user.mobileNumber,
          success: true,
          response: result
        });
      } catch (error) {
        console.error(`❌ Error sending notification to ${user.name}:`, error);
        notificationResults.push({
          user: user.name,
          mobileNumber: user.mobileNumber,
          success: false,
          error: error.message
        });
      }
    }
    
    // Return the results
    return NextResponse.json({
      success: true,
      message: "Demo test completed",
      googleMeet: {
        success: !!meetData,
        meetLink: meetData?.meetLink,
        eventId: meetData?.eventId
      },
      notifications: notificationResults
    });
  } catch (error) {
    console.error("❌ Demo test failed:", error);
    return NextResponse.json(
      { error: 'Demo test failed: ' + error.message },
      { status: 500 }
    );
  }
}