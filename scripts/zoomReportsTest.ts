

import { getDetailedAttendanceReport, getMeetingParticipants } from '../lib/zoomReports';

/**
 * Test script to verify the Zoom meeting attendance reporting functionality
 */
async function testZoomAttendance() {
  // Replace with an actual meetingId from a completed Zoom meeting
  const meetingId = '81177447435';
  
  console.log('🧪 Testing Zoom attendance reporting...\n');
  
  try {
    // First test: Get basic participant list
    console.log('Test 1: Fetching participant list');
    const participants = await getMeetingParticipants(meetingId);
    console.log(`Found ${participants.length} participants`);
    console.log('First 3 participants:', participants.slice(0, 3));
    console.log('\n-----------------------------------\n');
    
    // Second test: Get detailed attendance report
    console.log('Test 2: Generating detailed attendance report');
    const attendanceReport = await getDetailedAttendanceReport(meetingId);
    console.log('Meeting details:', {
      id: attendanceReport.meetingId,
      topic: attendanceReport.meetingDetails.topic,
      duration: attendanceReport.meetingDetails.duration,
      participants: attendanceReport.attendanceData.length
    });
    
    // Show attendance summary
    console.log('Attendance summary:', attendanceReport.summary);
    
    // Show a few attendance records
    console.log('Sample attendance records:');
    attendanceReport.attendanceData.slice(0, 3).forEach((record, index) => {
      console.log(`Participant ${index + 1}:`, {
        name: record.name,
        email: record.email,
        duration: `${record.duration.toFixed(1)} minutes`,
        percentage: `${record.attendancePercentage}%`,
        fullAttendance: record.wasInEntireMeeting ? 'Yes' : 'No'
      });
    });
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
  
  console.log('\nTesting complete!');
}

// Run the test
testZoomAttendance()
  .then(() => {
    console.log('All tests completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed with error:', error);
    process.exit(1);
  });