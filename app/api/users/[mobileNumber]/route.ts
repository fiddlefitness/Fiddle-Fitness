// app/api/users/[id]/route.js
import { extractLast10Digits } from '@/lib/formatMobileNumber';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  const { mobileNumber } = await params; // This should be the raw mobile number from URL
  const formattedMobileNumber = extractLast10Digits(mobileNumber); // Format it for DB query

  try {
    const user = await prisma.user.findUnique({
      where: { mobileNumber: formattedMobileNumber }, // Use formatted number
      select: {
        id: true,
        name: true,
        email: true,
        city: true,
        gender: true,
        mobileNumber: true, // This will be the formatted one from DB
        createdAt: true,
        fiddleFitnessCoins: true, // Ensure this is selected
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}