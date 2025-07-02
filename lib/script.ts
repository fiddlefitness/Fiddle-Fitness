// scripts/get-refresh-token.js
const { OAuth2Client } = require('google-auth-library');
const http = require('http');
const url = require('url');
const open = require('open');
const destroyer = require('server-destroy');

// Replace with your OAuth client credentials
const CLIENT_ID = 'your-client-id.apps.googleusercontent.com';
const CLIENT_SECRET = 'your-client-secret';
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

const oauth2Client = new OAuth2Client(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Generate a URL for consent
const scopes = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

const authorizeUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // This requests a refresh token
  scope: scopes,
  prompt: 'consent' // Force to get a refresh token
});

// Open browser to get user consent
console.log('Opening browser for consent...');
open(authorizeUrl, {wait: false});

// Start a web server to handle the callback
const server = http
  .createServer(async (req, res) => {
    try {
      // Get the code from the callback URL
      const queryParams = url.parse(req.url, true).query;
      const code = queryParams.code;
      
      if (code) {
        // Exchange code for tokens
        const {tokens} = await oauth2Client.getToken(code);
        console.log('\n\nRefresh Token:', tokens.refresh_token);
        console.log('\nAccess Token:', tokens.access_token);
        
        res.end('Authentication successful! You can close this window now.');
        server.destroy();
      }
    } catch (e) {
      res.end('Error: ' + e.message);
      server.destroy();
    }
  })
  .listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });

destroyer(server);