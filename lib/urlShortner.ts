// lib/shortenLink.ts

/**
 * Shortens a URL using the TinyURL API.
 * 
 * This function takes a long URL (such as a Zoom meeting link) and returns
 * a shortened version using TinyURL's free API service. The shortened link
 * will redirect to the original URL with all parameters preserved.
 * 
 * @param originalUrl The original URL to shorten
 * @returns The shortened URL, or the original URL if shortening fails
 */
export async function shortenLink(originalUrl: string): Promise<string> {
    try {
      // Ensure the URL is properly encoded
      const encodedUrl = encodeURIComponent(originalUrl);
      
      // Call the TinyURL API
      const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodedUrl}`);
      
      // Check if the request was successful
      if (!response.ok) {
        throw new Error(`TinyURL API error: ${response.status} ${response.statusText}`);
      }
      
      // Get the shortened URL from the response
      const shortUrl = await response.text();
      
      // Log the successful shortening
      console.log(`URL shortened: ${originalUrl.substring(0, 30)}... → ${shortUrl}`);
      
      return shortUrl;
    } catch (error) {
      // Log the error
      console.error('Error shortening URL:', error);
      
      // Return the original URL if shortening fails
      return originalUrl;
    }
  }