// lib/adminAuthMiddleware.js
import { NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';

// This should be set in your .env file (different from the API key)
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'admin-secret-key-change-this-in-production';

// Convert secret to Uint8Array for jose
const secretKey = new TextEncoder().encode(ADMIN_JWT_SECRET);

// Hard-coded admin credentials - in production, store these in a database
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

/**
 * Middleware to protect admin API routes
 * @param {Function} handler - The original API route handler
 * @returns {Function} - The wrapped handler with authentication
 */
export function withAdminAuth(handler) {
  return async function authHandler(request, ...args) {
    try {
      // Skip auth for OPTIONS requests (CORS preflight)
      if (request.method === 'OPTIONS') {
        return handler(request, ...args);
      }
      
      // Get the Authorization header
      const authHeader = request.headers.get('Authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Admin authentication required' },
          { status: 401 }
        );
      }

      // Extract the token
      const token = authHeader.split(' ')[1];

      // Verify the token
      const { payload } = await jwtVerify(token, secretKey);

      // Check if the payload has admin role
      if (payload.role !== 'admin') {
        return NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        );
      }

      // Add the admin user to the request for use in the handler
      request.admin = payload;

      // Call the original handler
      return handler(request, ...args);
    } catch (error) {
      console.error('Admin authentication error:', error);
      return NextResponse.json(
        { error: 'Invalid or expired admin token' },
        { status: 401 }
      );
    }
  };
}

/**
 * Verify admin credentials and generate token
 * @param {string} username - Admin username
 * @param {string} password - Admin password
 * @returns {Promise<string|null>} - JWT token or null if credentials are invalid
 */
export async function verifyAdminCredentials(username, password) {
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return generateAdminToken();
  }
  return null;
}

/**
 * Generate an admin JWT token
 * @returns {Promise<string>} - JWT token
 */
export async function generateAdminToken() {
  // Create token payload
  const payload = {
    role: 'admin',
    username: ADMIN_USERNAME
  };

  // Sign the JWT - expires in 24 hours
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secretKey);

  return token;
}