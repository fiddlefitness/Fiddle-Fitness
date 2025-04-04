import { prisma } from '@/lib/prisma';
import axios from 'axios';
import { NextResponse } from "next/server";

// Constants for WhatsApp messaging
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_API_URL = `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

// Function to send a review request message to a user using list message
async function sendReviewRequestMessage(phoneNumber: string, eventTitle: string) {
    try {
        const listMessage = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'list',
                header: {
                    type: 'text',
                    text: 'Event Feedback',
                },
                body: {
                    text: `Thank you for attending "${eventTitle}"! Please rate your satisfaction with the event on a scale of 1 (Very Unsatisfied) to 5 (Very Satisfied). Your feedback is important to us.`,
                },
                footer: {
                    text: 'Select your rating below',
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

        await axios({
            method: 'POST',
            url: WHATSAPP_API_URL,
            headers: {
                Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json',
            },
            data: listMessage,
        });

        return true;
    } catch (error) {
        console.error('Error sending review request message:', error);
        return false;
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const event = body.event;

        if (event === "meeting.ended") {
            const meetingId = body.payload.object.id;
            console.log(`✅ Meeting ${meetingId} ended at ${new Date().toISOString()}`);

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

            console.log(`Found ${poolAttendees.length} attendees for event: ${eventTitle}`);

            // Send review requests to all attendees
            for (const attendee of poolAttendees) {
                const mobileNumber = attendee.user.mobileNumber;
                
                try {
                    // Use upsert instead of create to handle existing reviews
                    await prisma.eventReview.upsert({
                        where: {
                            userId_eventId: {
                                userId: attendee.userId,
                                eventId: eventId
                            }
                        },
                        update: {
                            status: 'pending', // Reset to pending if already exists
                            rating: null,      // Clear any previous rating
                            feedback: null     // Clear any previous feedback
                        },
                        create: {
                            userId: attendee.userId,
                            eventId: eventId,
                            status: 'pending',
                        }
                    });
                    
                    // Send review request to the user
                    await sendReviewRequestMessage(mobileNumber, eventTitle);
                    console.log(`Review request sent to ${mobileNumber} for event: ${eventTitle}`);
                } catch (error) {
                    console.error(`Error processing review for user ${attendee.userId}:`, error);
                    // Continue with other users even if one fails
                }
            }

            return NextResponse.json({ 
                message: "Webhook processed successfully", 
                attendeesNotified: poolAttendees.length 
            }, { status: 200 });
        }

        return NextResponse.json({ message: "Webhook received" }, { status: 200 });
    } catch (error) {
        console.error("Error processing Zoom webhook:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}