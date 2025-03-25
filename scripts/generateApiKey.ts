/**
 * Generate a new random API key
 * @returns {string} - A new random API key
 */
function generateApiKey() {
    // Generate a random string of 32 characters
    return Array.from(
      { length: 32 },
      () => Math.floor(Math.random() * 36).toString(36)
    ).join('');
  }
  
  const apiKey = generateApiKey();
  console.log('Generated API key:');
  console.log(apiKey);
  console.log('\nAdd this to your .env file:');
  console.log(`API_KEY=${apiKey}`);