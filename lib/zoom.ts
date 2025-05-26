import axios from 'axios'

interface ZoomParticipant {
  email: string
  first_name: string
  last_name: string
  role: number
}

interface ZoomMeetingConfig {
  topic: string
  start_time: string
  duration: number
  type: number
  settings: {
    host_video: boolean
    participant_video: boolean
    join_before_host: boolean
    mute_upon_entry: boolean
    waiting_room: boolean
    meeting_authentication: boolean
    registrants_email_notification: boolean
    registrants_confirmation_email: boolean
    registration_type: number
    approval_type: number
    use_pmi: boolean
    enforce_login: boolean
    alternative_hosts?: string
    auto_recording?: string
  }
}

export async function getZoomAccessToken(): Promise<string> {
  try {
    const accountId = process.env.ZOOM_ACCOUNT_ID
    const clientId = process.env.ZOOM_CLIENT_ID
    const clientSecret = process.env.ZOOM_CLIENT_SECRET

    if (!accountId || !clientId || !clientSecret) {
      throw new Error('Missing Zoom credentials in environment variables')
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const response = await axios.post(
      'https://zoom.us/oauth/token',
      'grant_type=account_credentials&account_id=' + accountId,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    )

    return response.data.access_token
  } catch (error) {
    console.error('Error getting Zoom access token:', error)
    throw error
  }
}

export async function createZoomMeeting(
  topic: string,
  startTime: string,
  duration: number,
  participants: string[],
  hostEmail: string,
  userNames: Record<string, string>,
): Promise<{
  meetingUrl: string
  meetingId: string
  registrantUrls: Record<string, string>
}> {
  try {
    // Get access token
    const token = await getZoomAccessToken()

    // Create meeting with secure settings
    const meetingConfig = {
      topic,
      start_time: startTime,
      duration,
      type: 2, // Scheduled meeting
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        mute_upon_entry: true,
        waiting_room: false,
        meeting_authentication: true,
        registrants_email_notification: true,
        registrants_confirmation_email: true,
        registration_type: 2, // Registration with approval required
        approval_type: 0, // Automatic approval for registered participants
        use_pmi: false,
        enforce_login: true,
        auto_recording: 'none',
        require_registration_email: true, // Must match registered email exactly
        allow_multiple_devices: false, // Prevent link sharing across devices
      },
    }

    console.log('Creating meeting...')
    const meetingResponse = await axios.post(
      'https://api.zoom.us/v2/users/me/meetings',
      meetingConfig,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    )

    const { join_url, id } = meetingResponse.data
    console.log(`Meeting created successfully with ID: ${id}`)

    // Store individual registration URLs
    const registrantUrls: Record<string, string> = {}

    // Register each participant with their actual name
    if (participants.length > 0) {
      for (const email of participants) {
        console.log(`Registering participant: ${email}`)

        // Get the user's full name
        const fullName = userNames[email] || email.split('@')[0]
        
        // Split the name into first and last name
        const nameParts = fullName.trim().split(/\s+/)
        let firstName = nameParts[0]
        let lastName = 'User' // Default last name if not provided

        if (nameParts.length > 1) {
          // If we have more than one part, use the last part as last name
          lastName = nameParts[nameParts.length - 1]
          // If we have more than two parts, join the middle parts
          if (nameParts.length > 2) {
            firstName = nameParts.slice(0, -1).join(' ')
          }
        }

        // Capitalize first letter of each name
        firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
        lastName = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()

        const participantData = {
          email: email,
          first_name: firstName,
          last_name: lastName,
          status: 'approved', // Pre-approve them
        }

        try {
          console.log(
            `Sending registration with first_name: ${firstName}, last_name: ${lastName}`,
          )
          const registrantResponse = await axios.post(
            `https://api.zoom.us/v2/meetings/${id}/registrants`,
            participantData,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            },
          )

          if (registrantResponse.data && registrantResponse.data.join_url) {
            registrantUrls[email] = registrantResponse.data.join_url
            console.log(
              `✅ Successfully registered ${email} with unique join link`,
            )
          } else {
            console.warn(`⚠️ No join_url found in response for ${email}`)
          }
        } catch (error: any) {
          console.error(
            `Error registering participant ${email}:`,
            error.response?.data || error.message,
          )

          // Try to retrieve existing registration if available
          try {
            const registrantsResponse = await axios.get(
              `https://api.zoom.us/v2/meetings/${id}/registrants?email=${encodeURIComponent(
                email,
              )}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              },
            )

            if (
              registrantsResponse.data.registrants &&
              registrantsResponse.data.registrants.length > 0
            ) {
              registrantUrls[email] =
                registrantsResponse.data.registrants[0].join_url
              console.log(`Retrieved existing join URL for ${email}`)
            }
          } catch (listError: any) {
            console.error(
              `Could not retrieve join URL for ${email}:`,
              listError.response?.data || listError.message,
            )
          }
        }
      }
    }

    return {
      meetingUrl: join_url,
      meetingId: id,
      registrantUrls: registrantUrls,
    }
  } catch (error: any) {
    console.error(
      'Error creating Zoom meeting:',
      error.response?.data || error.message,
    )
    throw error
  }
}

/**
 * Add new participants to an existing Zoom meeting
 * 
 * @param meetingId - The ID of the existing Zoom meeting
 * @param participants - Array of participant email addresses to add
 * @param userNames - Record mapping email addresses to full names
 * @returns Record mapping email addresses to their join URLs
 */
export async function addParticipantsToZoomMeeting(
  meetingId: string,
  participants: string[],
  userNames: Record<string, string>
): Promise<Record<string, string>> {
  try {
    // Get access token
    const token = await getZoomAccessToken();
    
    // Store individual registration URLs
    const registrantUrls: Record<string, string> = {};

    // Register each participant with their actual name
    if (participants.length > 0) {
      for (const email of participants) {
        console.log(`Registering additional participant: ${email}`);

        // Get the user's full name
        const fullName = userNames[email] || email.split('@')[0];
        
        // Split the name into first and last name
        const nameParts = fullName.trim().split(/\s+/);
        let firstName = nameParts[0];
        let lastName = 'User'; // Default last name if not provided

        if (nameParts.length > 1) {
          // If we have more than one part, use the last part as last name
          lastName = nameParts[nameParts.length - 1];
          // If we have more than two parts, join the middle parts
          if (nameParts.length > 2) {
            firstName = nameParts.slice(0, -1).join(' ');
          }
        }

        // Capitalize first letter of each name
        firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
        lastName = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();

        const participantData = {
          email: email,
          first_name: firstName,
          last_name: lastName,
          status: 'approved', // Pre-approve them
        };

        try {
          console.log(
            `Sending registration with first_name: ${firstName}, last_name: ${lastName}`
          );
          const registrantResponse = await axios.post(
            `https://api.zoom.us/v2/meetings/${meetingId}/registrants`,
            participantData,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (registrantResponse.data && registrantResponse.data.join_url) {
            registrantUrls[email] = registrantResponse.data.join_url;
            console.log(
              `✅ Successfully registered ${email} with unique join link`
            );
          } else {
            console.warn(`⚠️ No join_url found in response for ${email}`);
          }
        } catch (error: any) {
          console.error(
            `Error registering participant ${email}:`,
            error.response?.data || error.message
          );

          // Try to retrieve existing registration if available
          try {
            const registrantsResponse = await axios.get(
              `https://api.zoom.us/v2/meetings/${meetingId}/registrants?email=${encodeURIComponent(
                email
              )}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            if (
              registrantsResponse.data.registrants &&
              registrantsResponse.data.registrants.length > 0
            ) {
              registrantUrls[email] =
                registrantsResponse.data.registrants[0].join_url;
              console.log(`Retrieved existing join URL for ${email}`);
            }
          } catch (listError: any) {
            console.error(
              `Could not retrieve join URL for ${email}:`,
              listError.response?.data || listError.message
            );
          }
        }
      }
    }

    return registrantUrls;
  } catch (error: any) {
    console.error(
      'Error adding participants to Zoom meeting:',
      error.response?.data || error.message
    );
    throw error;
  }
}
