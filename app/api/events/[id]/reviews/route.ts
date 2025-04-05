
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

type RequestParams = {
  id: string;
};

export async function GET(request: Request, { params }: { params: RequestParams }) {
  // Validate API key for admin access

  const { id } = params;
  
  try {
    // Fetch reviews for the specific event
    const reviews = await prisma.eventReview.findMany({
      where: { 
        eventId: id,
        status: 'completed' // Only include completed reviews
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobileNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate average rating
    const ratings = reviews.map(review => review.rating || 0).filter(rating => rating > 0);
    const averageRating = ratings.length > 0 
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length 
      : 0;

    return NextResponse.json({
      reviews,
      averageRating,
      totalReviews: reviews.length
    });
  } catch (error) {
    console.error('Error fetching event reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event reviews' },
      { status: 500 }
    );
  }
} 