// scripts/simple-refresh-token.js
const { OAuth2Client } = require('google-auth-library');
const http = require('http');
const url = require('url');

// Add your client ID and secret here directly
// (or copy them from your .env.local file)
const CLIENT_ID = '1055433227491-d735p7o1hs6c8qh4ggkebsjhnmue5d8u.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

async function getRefreshToken() {
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
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent', // Force to get a refresh token
  });

  console.log('\n----------------------------------------------------');
  console.log('Copy and open this URL in your browser:');
  console.log(authorizeUrl);
  console.log('----------------------------------------------------\n');

  // Start a web server to handle the callback
  return new Promise((resolve, reject) => {
    const server = http
      .createServer(async (req, res) => {
        try {
          const parsedUrl = url.parse(req.url, true);
          const code = parsedUrl.query.code;
          
          if (code) {
            // Exchange code for tokens
            const {tokens} = await oauth2Client.getToken(code);
            
            console.log('\n----------------------------------------------------');
            console.log('Your NEW refresh token:');
            console.log(tokens.refresh_token);
            console.log('----------------------------------------------------\n');
            
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end('<h1>Success!</h1><p>You can close this window and check your terminal for the refresh token.</p>');
            
            setTimeout(() => {
              server.close();
              resolve(tokens.refresh_token);
            }, 1000);
          }
        } catch (e) {
          console.error('Error getting tokens:', e);
          res.writeHead(500, {'Content-Type': 'text/html'});
          res.end('<h1>Error</h1><p>' + e.message + '</p>');
          server.close();
        }
      })
      .listen(3000, () => {
        console.log('Server running at http://localhost:3000');
        console.log('Waiting for authorization...');
      });
  });
}

getRefreshToken().catch(console.error);