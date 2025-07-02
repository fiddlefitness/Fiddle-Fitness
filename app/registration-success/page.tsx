'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';

function RegistrationSuccessContent() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('eventId');
  const paymentId = searchParams.get('paymentId');
  const regId = searchParams.get('regId');
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!eventId) {
        setError('Event information not found');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/events/${eventId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || '',
          },
        });
        if (!response.ok) {
          throw new Error('Failed to fetch event details');
        }
        
        const eventData = await response.json();
        setEvent(eventData);
      } catch (error) {
        console.error('Error fetching event details:', error);
        setError('Failed to load event details');
      } finally {
        setLoading(false);
      }
    };

    fetchEventDetails();
  }, [eventId]);

  if (loading) {
    return (
      <div className="text-center">
        <p>Loading registration details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
        <p className="text-gray-700">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="text-center mb-6">
        <svg 
          className="mx-auto h-12 w-12 text-green-500" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth="2" 
            d="M5 13l4 4L19 7"
          ></path>
        </svg>
        <h1 className="text-2xl font-bold text-gray-900 mt-4">Registration Successful!</h1>
        <p className="text-gray-600 mt-2">
          Your spot for {event?.title} has been reserved
        </p>
      </div>
      
      {event && (
        <div className="border-t border-b border-gray-200 py-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Event Details</h2>
          <div className="space-y-2">
            <p className="text-gray-900 font-medium">{event.title}</p>
            <p className="text-gray-600">
              {format(new Date(event.eventDate), 'MMMM dd, yyyy')} • {event.eventTime}
            </p>
            
            {paymentId && (
              <p className="text-gray-600 mt-2">
                <span className="font-medium">Payment ID:</span> {paymentId}
              </p>
            )}
            
            {regId && (
              <p className="text-gray-600 mt-2">
                <span className="font-medium">Registration ID:</span> {regId}
              </p>
            )}
          </div>
        </div>
      )}
      
      <div className="text-center">
        <p className="text-gray-600 mb-4">
          We've sent a confirmation message with all the details on WhatsApp. Please check your notifications.
        </p>
      </div>
    </>
  );
}

export default function RegistrationSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <Suspense fallback={
            <div className="text-center">
              <p>Loading registration details...</p>
            </div>
          }>
            <RegistrationSuccessContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
