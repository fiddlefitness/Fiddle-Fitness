// lib/zoom/reports.ts
import axios from 'axios';
import { getZoomAccessToken } from './zoom';
/**
 * Get participant details for a completed Zoom meeting
 * 
 * @param meetingId The UUID or ID of the Zoom meeting
 * @returns Array of participant data including join time, leave time, and duration
 */
export async function getMeetingParticipants(meetingId: string) {
  try {
    // Get JWT token for Zoom API authentication (using your existing auth method)
    const token = await getZoomAccessToken();
    
    // Make request to Zoom API to get participants report
    const response = await axios.get(
      `https://api.zoom.us/v2/report/meetings/${meetingId}/participants`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          page_size: 300 // Adjust based on expected number of participants
        }
      }
    );
    
    // Return the participants data
    return response.data.participants;
  } catch (error) {
    console.error('Error fetching Zoom meeting participants:', error);
    throw new Error('Failed to retrieve meeting participants data');
  }
}

/**
 * Get a detailed report of a completed Zoom meeting
 * 
 * @param meetingId The UUID or ID of the Zoom meeting
 * @returns Detailed meeting data including start time, end time, duration
 */
export async function getMeetingDetails(meetingId: string) {
  try {
    // Get JWT token for Zoom API authentication
    const token = await getZoomAccessToken();
    
    // Make request to Zoom API to get meeting details
    const response = await axios.get(
      `https://api.zoom.us/v2/report/meetings/${meetingId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Return the meeting details
    return response.data;
  } catch (error) {
    console.error('Error fetching Zoom meeting details:', error);
    throw new Error('Failed to retrieve meeting details');
  }
}

/**
 * Get a list of all meetings for a specified date range
 * 
 * @param from Start date in 'YYYY-MM-DD' format
 * @param to End date in 'YYYY-MM-DD' format
 * @returns List of meetings in the date range
 */
export async function getCompletedMeetings(from: string, to: string) {
  try {
    // Get JWT token for Zoom API authentication
    const token = await getZoomAccessToken();
    
    // Make request to Zoom API to get meetings list
    const response = await axios.get(
      'https://api.zoom.us/v2/users/me/meetings',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          type: 'past',
          page_size: 100,
          from,
          to
        }
      }
    );
    
    // Return the meetings list
    return response.data.meetings;
  } catch (error) {
    console.error('Error fetching completed Zoom meetings:', error);
    throw new Error('Failed to retrieve completed meetings list');
  }
}

/**
 * Get detailed attendance data for a meeting including
 * user information, join/leave times, and attendance duration
 * 
 * @param meetingId The UUID or ID of the Zoom meeting
 * @returns Processed attendance data with detailed metrics
 */
export async function getDetailedAttendanceReport(meetingId: string) {
  try {
    // Get both meeting details and participants
    const [meetingDetails, participants] = await Promise.all([
      getMeetingDetails(meetingId),
      getMeetingParticipants(meetingId)
    ]);
    
    // Process the meeting duration
    const meetingDuration = meetingDetails.duration; // Duration in minutes
    
    // Process participant data to get attendance metrics
    const attendanceData = participants.map((participant: any) => {
      // Calculate duration in minutes
      const joinTime = new Date(participant.join_time);
      const leaveTime = new Date(participant.leave_time);
      const durationMinutes = (leaveTime.getTime() - joinTime.getTime()) / (1000 * 60);
      
      // Calculate attendance percentage relative to meeting duration
      const attendancePercentage = Math.min(100, (durationMinutes / meetingDuration) * 100);
      
      return {
        id: participant.id,
        name: participant.name,
        email: participant.email,
        joinTime: participant.join_time,
        leaveTime: participant.leave_time,
        duration: durationMinutes,
        attendancePercentage: Math.round(attendancePercentage * 10) / 10, // Round to 1 decimal
        wasInEntireMeeting: attendancePercentage >= 90 // Consider 90%+ as full attendance
      };
    });
    
    return {
      meetingId,
      meetingDetails,
      attendanceData,
      summary: {
        totalParticipants: attendanceData.length,
        averageAttendancePercentage: 
          attendanceData.reduce((sum:any, p:any) => sum + p.attendancePercentage, 0) / attendanceData.length,
        fullAttendanceCount: attendanceData.filter((p: any) => p.wasInEntireMeeting).length
      }
    };
  } catch (error) {
    console.error('Error generating detailed attendance report:', error);
    throw new Error('Failed to generate attendance report');
  }
}

