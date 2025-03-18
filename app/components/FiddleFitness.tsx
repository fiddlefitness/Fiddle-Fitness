interface AiSensyRequestParams {
    campaignName: string;
    destination: string;
    userName: string;
    templateParams?: any[];
    source?: string;
    media?: Record<string, any>;
    buttons?: any[];
    carouselCards?: any[];
    location?: Record<string, any>;
    attributes?: Record<string, any>;
    paramsFallbackValue?: Record<string, any>;
}

export async function sendAiSensyRequest(params: AiSensyRequestParams): Promise<any> {
    const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3YWJmYzAwMTRhNjhmMGMwOWFiNDE1YyIsIm5hbWUiOiJGaWRkbGUgRml0bmVzcyBMTFAiLCJhcHBOYW1lIjoiQWlTZW5zeSIsImNsaWVudElkIjoiNjdhYmZjMDAxNGE2OGYwYzA5YWI0MTU3IiwiYWN0aXZlUGxhbiI6IkZSRUVfRk9SRVZFUiIsImlhdCI6MTczOTMyNDQxNn0.OGdnUAG5MtZ-SnlDhnp8MTRDY2VW6IxNQNmO1hoxm5g";
    const API_URL = "https://backend.aisensy.com/campaign/t1/api/v2";
    
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                apiKey: API_KEY,
                ...params
            }),
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error("Error sending AiSensy request:", error);
        throw error;
    }
}