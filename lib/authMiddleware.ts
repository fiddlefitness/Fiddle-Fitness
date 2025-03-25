// lib/authMiddleware.js
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Convert secret to Uint8Array for jose
const secretKey = new TextEncoder().encode(SECRET_KEY);

/**
 * Middleware to handle authentication for API routes
 * @param {Function} handler - The original API route handler
 * @param {Object} options - Options for the middleware
 * @param {boolean} options.requireAuth - Whether authentication is required (default: true)
 * @returns {Function} - The wrapped handler with authentication
 */
export function withAuth(handler, { requireAuth = true } = {}) {
  return async function authHandler(request, ...args) {
    // Skip auth for OPTIONS requests (CORS preflight)
    if (request.method === 'OPTIONS') {
      return handler(request, ...args);
    }

    // Skip auth if not required (public endpoints)
    if (!requireAuth) {
      return handler(request, ...args);
    }

    try {
      // Get the Authorization header
      const authHeader = request.headers.get('Authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Extract the token
      const token = authHeader.split(' ')[1];

      // Verify the token
      const { payload } = await jwtVerify(token, secretKey);

      // Add the user to the request for use in the handler
      request.user = payload;

      // Call the original handler
      return handler(request, ...args);
    } catch (error) {
      console.error('Authentication error:', error);
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }
  };
}

/**
 * Generate a JWT token for a user
 * @param {Object} user - User object to encode in the token
 * @param {Object} options - Options for the token
 * @param {string} options.expiresIn - Token expiry time (default: '24h')
 * @returns {Promise<string>} - JWT token
 */
export async function generateToken(user, { expiresIn = '24h' } = {}) {
  const { SignJWT } = await import('jose');
  
  // Create expiration date
  const expirationTime = expiresIn.endsWith('h') 
    ? parseInt(expiresIn) * 60 * 60 
    : expiresIn.endsWith('d') 
      ? parseInt(expiresIn) * 24 * 60 * 60 
      : 24 * 60 * 60; // Default 24 hours
  
  // Create token payload (avoid including sensitive info)
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email
  };

  // Sign the JWT
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expirationTime)
    .sign(secretKey);

  return token;
}




const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'your-secret-api-key-change-this-in-production';

/**
 * Middleware to handle API key authentication for API routes
 * @param {Function} handler - The original API route handler
 * @param {Object} options - Options for the middleware
 * @param {boolean} options.requireAuth - Whether authentication is required (default: true)
 * @returns {Function} - The wrapped handler with authentication
 */
export function withApiKey(handler, { requireAuth = true } = {}) {
  return async function authHandler(request, ...args) {
    // Skip auth for OPTIONS requests (CORS preflight)
    if (request.method === 'OPTIONS') {
      return handler(request, ...args);
    }

    // Skip auth if not required (public endpoints)
    if (!requireAuth) {
      return handler(request, ...args);
    }

    try {
      // Get the API key from header or query parameter
      const apiKeyHeader = request.headers.get('X-API-Key');
      
      // Allow API key in query string as fallback (not as secure but works for WhatsApp)
      const url = new URL(request.url);
      const apiKeyQuery = url.searchParams.get('apiKey');
      
      const providedApiKey = apiKeyHeader || apiKeyQuery;

      if (!providedApiKey) {
        return NextResponse.json(
          { error: 'API key required' },
          { status: 401 }
        );
      }

      // Verify the API key
      if (providedApiKey !== API_KEY) {
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        );
      }

      // Call the original handler
      return handler(request, ...args);
    } catch (error) {
      console.error('Authentication error:', error);
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
  };
}



/**
 * Generate a new random API key
 * This function is meant to be used in development or by an admin to generate a new key
 * @returns {string} - A new random API key
 */
export function generateApiKey() {
    // Generate a random string of 32 characters
    return Array.from(
      { length: 32 },
      () => Math.floor(Math.random() * 36).toString(36)
    ).join('');
  }
