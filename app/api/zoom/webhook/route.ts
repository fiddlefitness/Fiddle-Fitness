import { prisma } from '@/lib/prisma';
import { truncateBody, truncateFooter, truncateHeader } from '@/lib/whatsappLimits';
import axios from 'axios';
import { NextResponse } from "next/server";

// Constants for WhatsApp messaging
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_API_URL = `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

// Fallback function to send a simple text message for review requests
async function sendFallbackReviewMessage(phoneNumber: string, eventTitle: string) {
    try {
        console.log(`Attempting to send fallback text review request to ${phoneNumber}`);
        
        // Format phone number - ensure it includes country code
        const formattedPhone = phoneNumber.startsWith('+') ? 
            phoneNumber : 
            phoneNumber.startsWith('91') ? 
                `+${phoneNumber}` : `+91${phoneNumber}`;
        
        const textMessage = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedPhone,
            type: 'text',
            text: {
                body: `Thank you for attending "${eventTitle}"! How would you rate your experience on a scale of 1-5?\n\n5 = Excellent\n4 = Good\n3 = Average\n2 = Poor\n1 = Very Poor\n\nPlease reply with just the number.`
            }
        };
        
        const response = await axios({
            method: 'POST',
            url: WHATSAPP_API_URL,
            headers: {
                Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json',
            },
            data: textMessage,
            timeout: 10000,
        });
        
        console.log(`Fallback message sent successfully to ${formattedPhone}`);
        return true;
    } catch (error) {
        console.error('Error sending fallback review message:');
        if (axios.isAxiosError(error)) {
            console.error('WhatsApp API error:', error.response?.data);
        } else {
            console.error('Non-Axios error:', error);
        }
        return false;
    }
}

// Function to send a review request message to a user using list message
async function sendReviewRequestMessage(phoneNumber: string, eventTitle: string) {
    try {
        // Format the phone number (ensure it's in international format)
        let formattedPhone = phoneNumber.trim();
        if (!formattedPhone.startsWith('+')) {
            // If it doesn't start with +, assume it's an Indian number
            if (formattedPhone.startsWith('0')) {
                formattedPhone = '+91' + formattedPhone.substring(1);
            } else {
                formattedPhone = '+91' + formattedPhone;
            }
        }
        
        // Remove any spaces or dashes
        formattedPhone = formattedPhone.replace(/[\s-]/g, '');
        
        console.log(`Sending review request to: ${formattedPhone}`);
        
        // Truncate event title to ensure it fits within WhatsApp's character limits
        const truncatedEventTitle = truncateHeader(eventTitle);
        
        // Use list message as requested
        const listMessage = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedPhone,
            type: 'interactive',
            interactive: {
                type: 'list',
                header: {
                    type: 'text',
                    text: 'Event Feedback',
                },
                body: {
                    text: truncateBody(`Thank you for attending "${truncatedEventTitle}"! Please rate your satisfaction with the event on a scale of 1 (Very Unsatisfied) to 5 (Very Satisfied). Your feedback is important to us.`),
                },
                footer: {
                    text: truncateFooter('Select your rating below'),
                },
                action: {
                    button: 'Rate Event',
                    sections: [
                        {
                            title: 'Rating Options',
                            rows: [
                                {
                                    id: 'rating_5',
                                    title: '5 - Very Satisfied',
                                    description: 'Excellent experience',
                                },
                                {
                                    id: 'rating_4',
                                    title: '4 - Satisfied',
                                    description: 'Good experience',
                                },
                                {
                                    id: 'rating_3',
                                    title: '3 - Neutral',
                                    description: 'Average experience',
                                },
                                {
                                    id: 'rating_2',
                                    title: '2 - Unsatisfied',
                                    description: 'Below average experience',
                                },
                                {
                                    id: 'rating_1',
                                    title: '1 - Very Unsatisfied',
                                    description: 'Poor experience',
                                },
                            ],
                        },
                    ],
                },
            },
        };

        console.log('Sending WhatsApp request to:', WHATSAPP_API_URL);
        
        const response = await axios({
            method: 'POST',
            url: WHATSAPP_API_URL,
            headers: {
                Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json',
            },
            data: listMessage,
            timeout: 10000, // 10 seconds timeout
        });

        console.log('WhatsApp API response:', response.data);
        return true;
    } catch (error) {
        console.error('Error sending WhatsApp review request:', error);
        return false;
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const event = body.event;
        
        console.log(`Received Zoom webhook: ${event}`);

        // Process meeting.ended events
        if (event === "meeting.ended") {
            const meetingId = body.payload.object.id;
            console.log(`✅ Meeting ${meetingId} ended at ${new Date().toISOString()}`);

            try {
                // Find the pool associated with this meeting ID
                // Check in meetLink fields as they contain the Zoom meeting URLs with IDs
                const poolAttendees = await prisma.poolAttendee.findMany({
                    where: {
                        meetLink: {
                            contains: meetingId.toString()
                        }
                    },
                    include: {
                        user: true,
                        pool: {
                            include: {
                                event: true
                            }
                        }
                    }
                });

                if (poolAttendees.length === 0) {
                    console.log(`No pool attendees found for meeting ID: ${meetingId}`);
                    return NextResponse.json({ message: "Webhook received but no matching event found" }, { status: 200 });
                }

                // Get event details from the first attendee (all attendees should be for the same event)
                const eventTitle = poolAttendees[0].pool.event.title;
                const eventId = poolAttendees[0].pool.eventId;

                console.log(`Found ${poolAttendees.length} attendees for event: ${eventTitle} (ID: ${eventId})`);
                // before sending the review messages we will check if the event is already reviewed by the users
                const eventReviews = await prisma.eventReview.findMany({
                    where: {
                        eventId: eventId
                    }
                });

                // if the event is already reviewed by the users we will not send the review messages
                if (eventReviews.length > 0) {
                    console.log(`Event ${eventTitle} (ID: ${eventId}) is already reviewed by the users`);
                    return NextResponse.json({ message: "Webhook received but no matching event found" }, { status: 200 });
                }
                

                // Send review requests to all attendees
                const results = await Promise.allSettled(
                    poolAttendees.map(async (attendee) => {
                        const mobileNumber = attendee.user.mobileNumber;
                        
                        try {
                            console.log(`Processing review for user: ${attendee.user.name} (${mobileNumber})`);
                            
                            // Use upsert instead of create to handle existing reviews
                            const review = await prisma.eventReview.upsert({
                                where: {
                                    userId_eventId: {
                                        userId: attendee.userId,
                                        eventId: eventId
                                    }
                                },
                                update: {
                                    status: 'pending', // Reset to pending if already exists
                                    rating: null,      // Clear any previous rating
                                    feedback: null,    // Clear any previous feedback
                                    updatedAt: new Date() // Update the timestamp
                                },
                                create: {
                                    userId: attendee.userId,
                                    eventId: eventId,
                                    status: 'pending',
                                },
                                select: {
                                    id: true,
                                    userId: true
                                }
                            });
                            
                            console.log(`Review record created/updated: ${JSON.stringify(review)}`);
                            
                            // Send review request to the user
                            const messageSent = await sendReviewRequestMessage(mobileNumber, eventTitle);
                            if (!messageSent) {
                                console.error(`Failed to send review request to ${mobileNumber}`);
                            }
                            
                            return { userId: attendee.userId, success: true, messageSent };
                        } catch (error) {
                            console.error(`Error processing review for user ${attendee.userId}:`, error);
                            return { userId: attendee.userId, success: false, error: String(error) };
                        }
                    })
                );
                
                // Count successful and failed operations
                const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
                const failed = results.filter(r => r.status === 'rejected' || !(r.value as any).success).length;
                
                console.log(`Review processing complete: ${successful} successful, ${failed} failed`);

                return NextResponse.json({ 
                    message: "Webhook processed successfully", 
                    attendeesProcessed: poolAttendees.length,
                    successful,
                    failed
                }, { status: 200 });
            } catch (error) {
                console.error("Error processing attendees:", error);
                return NextResponse.json({ 
                    error: "Error processing attendees", 
                    details: String(error)
                }, { status: 500 });
            }
        }

        // Default response for other event types
        return NextResponse.json({ message: "Webhook received" }, { status: 200 });
    } catch (error) {
        console.error("Error processing Zoom webhook:", error);
        return NextResponse.json({ error: "Internal Server Error", details: String(error) }, { status: 500 });
    }
}

// For testing purposes - simulate a meeting ended event
export async function GET(req: Request) {
    const url = new URL(req.url);
    const testMeetingId = url.searchParams.get('testMeetingId');
    
    if (!testMeetingId) {
        return NextResponse.json({ error: "Missing testMeetingId parameter" }, { status: 400 });
    }
    
    try {
        console.log(`Simulating meeting.ended for meeting ID: ${testMeetingId}`);
        
        // Find the pool associated with this meeting ID
        const poolAttendees = await prisma.poolAttendee.findMany({
            where: {
                meetLink: {
                    contains: testMeetingId
                }
            },
            include: {
                user: true,
                pool: {
                    include: {
                        event: true
                    }
                }
            }
        });

        if (poolAttendees.length === 0) {
            return NextResponse.json({ 
                error: "No pool attendees found for the provided meeting ID",
                testMeetingId
            }, { status: 404 });
        }

        // Get event details from the first attendee
        const eventTitle = poolAttendees[0].pool.event.title;
        const eventId = poolAttendees[0].pool.eventId;

        console.log(`Found ${poolAttendees.length} attendees for event: ${eventTitle} (ID: ${eventId})`);

        // Process all attendees
        const results = await Promise.allSettled(
            poolAttendees.map(async (attendee) => {
                const mobileNumber = attendee.user.mobileNumber;
                
                try {
                    // Create or update review record
                    const review = await prisma.eventReview.upsert({
                        where: {
                            userId_eventId: {
                                userId: attendee.userId,
                                eventId: eventId
                            }
                        },
                        update: {
                            status: 'pending',
                            rating: null,
                            feedback: null,
                            updatedAt: new Date()
                        },
                        create: {
                            userId: attendee.userId,
                            eventId: eventId,
                            status: 'pending',
                        },
                        select: {
                            id: true,
                            userId: true
                        }
                    });
                    
                    // Send review request
                    const messageSent = await sendReviewRequestMessage(mobileNumber, eventTitle);
                    
                    return { 
                        userId: attendee.userId, 
                        userName: attendee.user.name,
                        mobileNumber,
                        reviewId: review.id,
                        success: true, 
                        messageSent 
                    };
                } catch (error) {
                    console.error(`Error processing test review for user ${attendee.userId}:`, error);
                    return { 
                        userId: attendee.userId, 
                        userName: attendee.user.name,
                        mobileNumber,
                        success: false, 
                        error: String(error) 
                    };
                }
            })
        );

        // Prepare response
        const processedAttendees = results.map(result => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                return { success: false, error: String(result.reason) };
            }
        });

        return NextResponse.json({
            message: "Test review requests processed",
            meetingId: testMeetingId,
            eventTitle,
            eventId,
            attendeesProcessed: processedAttendees
        }, { status: 200 });
    } catch (error) {
        console.error("Error processing test review requests:", error);
        return NextResponse.json({ 
            error: "Failed to process test review requests", 
            details: String(error),
            testMeetingId
        }, { status: 500 });
    }
}