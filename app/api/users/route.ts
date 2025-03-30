// app/api/users/route.js 
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractLast10Digits } from '@/lib/formatMobileNumber';
import { withApiKey } from '@/lib/authMiddleware';
import { EVENT_CATEGORIES } from '@/lib/constants/categoryIds';

// Get all users
async function getUsers(request) {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// Create a new user
export async function createUser(request) {
  try {
    const data = await request.json();
    const mobileNumber = extractLast10Digits(data.mobileNumber);
    console.log(mobileNumber)
    
    // Validate required fields
    if (!data.name || !mobileNumber) {
      return NextResponse.json(
        { error: 'Name and mobile number are required' },
        { status: 400 }
      );
    }
    
    // Check if user with same mobile number already exists
    const existingUser = await prisma.user.findUnique({
      where: {
        mobileNumber: mobileNumber
      }
    });
    
    let user;
    
    console.log(data.yearOfBirth)
    
    if (existingUser) {
      // Update existing user if needed
      user = await prisma.user.update({
        where: {
          id: existingUser.id
        },
        data: {
          name: data.name || existingUser.name,
          email: data.email || existingUser.email,
          city: data.city || existingUser.city,
          gender: data.gender || existingUser.gender,
          yearOfBirth: data.yearOfBirth || existingUser.yearOfBirth,
        }
      });
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          city: data.city,
          gender: data.gender,
          mobileNumber: mobileNumber,
          yearOfBirth: data.yearOfBirth,
        }
      });
    }
    
    // Get upcoming events
    
    
    // Return the user and upcoming event categories
    return NextResponse.json({
      user
    }, { status: existingUser ? 200 : 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

// Export the handlers with API key middleware
export const GET = withApiKey(getUsers);
export const POST = withApiKey(createUser, {requireAuth: false});


