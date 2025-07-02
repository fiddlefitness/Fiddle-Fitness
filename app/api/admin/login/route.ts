// app/api/admin/login/route.js
import { NextResponse } from 'next/server';
import { verifyAdminCredentials } from '@/lib/adminAuthMiddleware';

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    // Validate request body
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Verify admin credentials
    const token = await verifyAdminCredentials(username, password);

    if (!token) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Return the token
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}