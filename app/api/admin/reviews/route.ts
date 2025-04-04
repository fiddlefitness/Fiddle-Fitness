import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const reviews = await prisma.eventReview.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobileNumber: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            eventDate: true,
            category: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(reviews)
  } catch (error) {
    console.error('Error fetching event reviews:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event reviews' },
      { status: 500 }
    )
  }
} 