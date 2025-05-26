// app/api/users/route.js 
import { withApiKey } from '@/lib/authMiddleware';
import { extractLast10Digits } from '@/lib/formatMobileNumber';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Function to generate a random 5-digit alphanumeric (lowercase) referral code
function generateReferralCode(): string {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Function to validate referral code and get referrer details
async function validateReferralCode(referralCode: string) {
  if (!referralCode) return null;
  
  const referrer = await prisma.user.findUnique({
    where: { referralCode },
    select: { id: true, name: true, referralCode: true }
  });
  
  return referrer;
}

// Get all users
async function getUsers(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const isExport = searchParams.get('export') === 'true';
    const includeEvents = searchParams.get('includeEvents') === 'true';
    const limit = 50;
    const skip = (page - 1) * limit;

    // If it's an export request, return all users
    if (isExport) {
      // Prepare include object based on whether to include events
      const includeObj: any = {
        _count: {
          select: {
            registeredEvents: true,
            completedEvents: true
          }
        }
      };

      // If detailed events are requested, include them with event data
      if (includeEvents) {
        includeObj.registeredEvents = {
          include: {
            event: {
              select: {
                title: true
              }
            }
          }
        };
        includeObj.completedEvents = {
          include: {
            event: {
              select: {
                title: true
              }
            }
          }
        };
      }

      const users = await prisma.user.findMany({
        orderBy: {
          createdAt: 'desc'
        },
        include: includeObj
      });
      
      return NextResponse.json({ users });
    }

    // Get total count for pagination
    const totalUsers = await prisma.user.count();

    // Get paginated users with their registrations
    const users = await prisma.user.findMany({
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        registeredEvents: true,
        _count: {
          select: {
            registeredEvents: true,
            completedEvents: true
          }
        }
      }
    });
    
    return NextResponse.json({
      users,
      pagination: {
        total: totalUsers,
        pages: Math.ceil(totalUsers / limit),
        currentPage: page
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// Create a new user
export async function createUser(request: Request) {
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
    
    // If this is a form validation request with a referral code
    if (data.isFormValidation && data.referralCode) {
      const referrer = await validateReferralCode(data.referralCode);
      
      if (!referrer) {
        // Return with invalid code message
        return NextResponse.json({
          ...data,
          referralCode: "INVALID CODE!"
        });
      }
      
      // Return with formatted referral code that includes referrer's name
      return NextResponse.json({
        ...data,
        referralCode: `${referrer.referralCode} - ${referrer.name}`
      });
    }
    
    let user;
    
    // Process referral code if provided in the confirmation step
    let referrerId = null;
    if (data.referralCode && !data.isFormValidation) {
      // Extract the actual referral code from the formatted string if needed
      // Format: "XYZAB - Kapil Bamotriya"
      const referralCodeOnly = data.referralCode.split(' - ')[0];
      const referrer = await validateReferralCode(referralCodeOnly);
      if (referrer) {
        referrerId = referrer.id;
      }
    }
    
    if (existingUser) {
      // Update existing user if needed
      user = await prisma.user.update({
        where: {
          id: existingUser.id
        },
        data: {
          name: data.name || existingUser.name,
          email: data.email || existingUser.email,
          city: data.state || existingUser.city,
          gender: data.gender || existingUser.gender,
          yearOfBirth: data.yearOfBirth || existingUser.yearOfBirth,
          // Don't update referral relationships for existing users in this implementation
        }
      });
    } else {
      // Generate a unique referral code
      let referralCode = generateReferralCode();
      let isUniqueCode = false;
      
      // Ensure the referral code is unique
      while (!isUniqueCode) {
        const existingCode = await prisma.user.findUnique({
          where: { referralCode }
        });
        
        if (!existingCode) {
          isUniqueCode = true;
        } else {
          referralCode = generateReferralCode();
        }
      }
      
      // Create new user with referral code and referrer if applicable
      user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email || '',
          city: data.state,
          gender: data.gender,
          mobileNumber: mobileNumber,
          yearOfBirth: data.yearOfBirth,
          referralCode: referralCode,
          referredById: referrerId,
        }
      });
    }
    
    // Return the user
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


