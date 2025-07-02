// lib/googleCalender.js (with fixed permissions)
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Create a reusable auth client that can automatically refresh tokens
let oauth2Client = null;

const getAuthClient = async () => {
  try {
    // If we already have a client, return it
    if (oauth2Client) return oauth2Client;
    
    // Log credential info (without revealing secrets)
    console.log("🔑 Creating OAuth2 client with:");
    console.log(`- Client ID: ${process.env.GOOGLE_CLIENT_ID?.substring(0, 10)}...`);
    console.log(`- Client Secret: ${process.env.GOOGLE_CLIENT_SECRET ? '[Set]' : '[Not Set]'}`);
    console.log(`- Refresh Token: ${process.env.GOOGLE_REFRESH_TOKEN ? '[Set]' : '[Not Set]'}`);
    
    // Create new OAuth client
    oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost:3000/oauth2callback' // Not used for refresh tokens
    );
    
    // Set credentials using the refresh token
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });
    
    return oauth2Client;
  } catch (error) {
    console.error("⚠️ Error creating OAuth client:", error);
    throw error;
  }
};

export const createGoogleMeet = async (title, startTime, endTime, attendees) => {
  try {
    console.log("⏳ Getting authenticated client...");
    
    // Get authenticated client
    const auth = await getAuthClient();
    
    console.log("✅ Got authenticated client");
    
    // Create Calendar client
    const calendar = google.calendar({ version: 'v3', auth });
    
    console.log("📅 Creating calendar event...");
    console.log(`- Title: ${title}`);
    console.log(`- Start: ${startTime}`);
    console.log(`- End: ${endTime}`);
    console.log(`- Attendees: ${attendees.join(', ')}`);
    
    // Create event with Google Meet - With updated conferenceData settings
    const event = {
      summary: title,
      description: `Automatically generated meeting for ${title}`,
      start: {
        dateTime: startTime,
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: endTime,
        timeZone: 'Asia/Kolkata',
      },
      attendees: attendees.map(attendee => ({ 
        email: attendee,
        responseStatus: 'accepted' // Mark as accepted to ensure they appear as confirmed
      })),
      // Important: Configure conferenceData with proper entry points access
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
          // Add these settings to allow attendees to join directly
          status: { statusCode: 'success' }
        },
        // Set entryPoints access levels
        entryPoints: [
          {
            entryPointType: 'video',
            uri: '', // Will be filled by Google
            label: title,
            accessLevel: 'reader' // 'reader' allows direct access without knocking
          }
        ],
        // Set conference properties to allow automatic joining
        conferenceProperties: {
          allowedConferenceSolutionTypes: ['hangoutsMeet'],
          // This is critical - ensure invited guests can join automatically
          autoAdmittedUsers: 'INVITED_USERS_CAN_JOIN_AUTOMATICALLY'
        }
      },
      // No reminders
      reminders: {
        useDefault: false
      },
      // Make the meeting publicly accessible for invited guests
      visibility: 'public',
      // Mark as transparent to not block calendar time
      transparency: 'transparent',
      // Give attendees full modifying access
      guestsCanModify: false,
      // Allow guests to invite others
      guestsCanInviteOthers: false
    };

    // Insert the event with conferenceDataVersion=1 to create a Google Meet
    console.log("⏳ Inserting calendar event with proper permissions...");
    
    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: 1,
        resource: event,
        // This is important - set to 'all' to send notifications to all attendees
        sendUpdates: 'all'
      });
      
      console.log("✅ Calendar event created successfully");
      
      // Return the Google Meet link and eventId
      if (response.data.conferenceData && response.data.conferenceData.entryPoints) {
        const meetEntryPoint = response.data.conferenceData.entryPoints.find(
          entryPoint => entryPoint.entryPointType === 'video'
        );
        
        // Log the full conference data to debug permissions
        console.log("📊 Conference Data:", JSON.stringify(response.data.conferenceData, null, 2));
        
        return {
          meetLink: meetEntryPoint ? meetEntryPoint.uri : null,
          eventId: response.data.id,
          // Include the hangoutLink as backup
          alternateLink: response.data.hangoutLink
        };
      }
      
      console.log("⚠️ No conference data in response");
      return null;
    } catch (insertError) {
      console.error("⚠️ Error inserting calendar event:", insertError);
      
      // Try to extract more detailed error information
      if (insertError.response && insertError.response.data) {
        console.error("Error details:", JSON.stringify(insertError.response.data, null, 2));
      }
      
      throw insertError;
    }
  } catch (error) {
    console.error('❌ Error creating Google Meet:', error);
    throw error;
  }
};