// app/api/users/[id]/route.js
import { NextResponse } from 'next/server';
import {prisma} from '@/lib/prisma';
import { extractLast10Digits } from '@/lib/formatMobileNumber';

export async function GET(request, { params }) {
  const { mobileNumber } = await params;

  
  
  try {
    const user = await prisma.user.findUnique({
      where: { mobileNumber },
      select: {
        id: true,
        name: true,
        email: true,
        city: true,
        gender: true,
        mobileNumber: true,
        createdAt: true
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