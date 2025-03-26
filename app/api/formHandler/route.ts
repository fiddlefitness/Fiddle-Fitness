// pages/api/formHandler.js or app/api/formHandler/route.js (depending on your Next.js version)

import { NextResponse } from 'next/server';

import { createUser } from '../users/route';

export async function POST(request) {
  try {
    // Get form data from chatbot
    const formData = await request.json();
    
    // Map form data to the format expected by your existing createUser function
    const userData = {
      name: formData.name,
      mobileNumber: formData.mobileNumber, // Will be processed by extractLast10Digits in createUser
      email: formData.email,
      gender: formData.gender,
      city: formData.city
    };
    
    // Call your existing endpoint or function directly
    // Option 1: Call function directly if in same codebase
    const result = await createUser({ json: () => userData });
    
    // Option 2: Call your API endpoint
    // const apiUrl = process.env.API_BASE_URL + '/api/users'; // Update with your actual API path
    // const response = await fetch(apiUrl, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(userData),
    // });
    
    // const result = await response.json();
    
    // Return the result to the chatbot
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error handling form submission:', error);
    return NextResponse.json(
      { error: 'Failed to process form submission' },
      { status: 500 }
    );
  }
}

