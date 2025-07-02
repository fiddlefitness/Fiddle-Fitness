//  /page.js
import { extractLast10Digits } from '@/lib/formatMobileNumber'
import PaymentForm from './PaymentForm'

async function getEventData(eventId: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/events/${eventId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || '',
        },
        cache: 'no-store',
      },
    )

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      console.error('Event API Error:', {
        status: res.status,
        statusText: res.statusText,
        errorData,
      })
      throw new Error(`Failed to fetch event data: ${res.status} ${res.statusText}`)
    }

    return res.json()
  } catch (error) {
    console.error('Event Data Fetch Error:', error)
    throw error
  }
}

async function getUserData(mobileNumber: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/users/${mobileNumber}`,
      {
        cache: 'no-store',
      },
    )

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      console.error('User API Error:', {
        status: res.status,
        statusText: res.statusText,
        errorData,
      })
      throw new Error(`Failed to fetch user data: ${res.status} ${res.statusText}`)
    }

    return res.json()
  } catch (error) {
    console.error('User Data Fetch Error:', error)
    throw error
  }
}

export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string; mobileNumber: string }>
  searchParams: Promise<{ ref?: string }>
}) {
  const { eventId, mobileNumber } = await params
  const { ref: paymentRef } = await searchParams
  const cleanMobileNumber = extractLast10Digits(mobileNumber)

  try {
    console.log('Fetching data for:', { eventId, cleanMobileNumber })
    const [eventData, userData] = await Promise.all([
      getEventData(eventId),
      getUserData(cleanMobileNumber),
    ])

    console.log('Event Data:', eventData)
    console.log('User Data:', userData)

    const isAlreadyRegistered = (eventData.registrations || []).some(
      (r: { mobileNumber: string }) => r.mobileNumber === userData.mobileNumber,
    )

    if (isAlreadyRegistered) {
      return (
        <div className='min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
          <div className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
            <div className='bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center'>
              <h2 className='text-xl font-semibold text-green-600 mb-2'>
                You have already registered for this event
              </h2>
            </div>
          </div>
        </div>
      )
    }

  if (eventData.isDeadlinePassed) {
    return (
      <div className='min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
        <div className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
          <div className='bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center'>
            <h2 className='text-xl font-semibold text-red-600 mb-2'>
              Registration Deadline Passed
            </h2>
            <p className='text-gray-700'>
              We're sorry, but the registration deadline for this event has
              passed. You cannot register for this event anymore.
            </p>
          </div>
        </div>
      </div>
    )
  }

    return (
      <PaymentForm
        event={eventData}
        user={userData}
        eventId={eventId}
        mobileNumber={cleanMobileNumber}
        paymentRef={paymentRef}
      />
    )
  } catch (error) {
    console.error('Payment Page Error:', error)
    return (
      <div className='min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
        <div className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
          <div className='bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10'>
            <div className='text-center'>
              <h2 className='text-xl font-semibold text-red-600 mb-2'>
                Error Loading Data
              </h2>
              <p className='text-gray-700'>
                We couldn't load the registration information. Please try again
                later.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
