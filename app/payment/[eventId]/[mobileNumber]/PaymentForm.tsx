'use client'

import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface PaymentFormProps {
  event: {
    title: string
    eventDate: string
    eventTime: string
    location?: string
    trainers?: Array<{ name: string }>
    price: number
  }
  user: {
    name: string
    mobileNumber: string
    email?: string
    city?: string
    fiddleFitnessCoins?: number
  }
  eventId: string
  mobileNumber: string
  paymentRef?: string
}

export default function PaymentForm({
  event,
  user,
  eventId,
  mobileNumber,
  paymentRef,
}: PaymentFormProps) {
  const router = useRouter()
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useCoins, setUseCoins] = useState(false)
  const [coinsToApply, setCoinsToApply] = useState(0)
  const [finalAmount, setFinalAmount] = useState(event.price || 0)

  const availableCoins = user.fiddleFitnessCoins || 0
  const eventPrice = event.price || 0

  useEffect(() => {
    let applicableCoins = 0
    if (useCoins && availableCoins > 0 && eventPrice > 0) {
      applicableCoins = Math.min(availableCoins, eventPrice)
    }
    setCoinsToApply(applicableCoins)
    setFinalAmount(Math.max(0, eventPrice - applicableCoins))
  }, [useCoins, availableCoins, eventPrice])

  const createOrderId = async () => {
    try {
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || '',
        },
        body: JSON.stringify({
          originalAmount: eventPrice * 100,
          finalAmount: finalAmount * 100,
          coinsUsed: coinsToApply,
          eventId: eventId,
          mobileNumber: mobileNumber,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Network response was not ok')
      }

      const data = await response.json()
      return data.orderId
    } catch (error) {
      console.error('There was a problem with your fetch operation:', error)
      setError(`Failed to create payment order: ${error.message}. Please try again.`)
      return null
    }
  }

  const handlePayment = async () => {
    setPaymentLoading(true)
    setError(null)

    try {
      if (finalAmount === 0) {
        const registrationRes = await fetch('/api/users/register-event', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || '',
          },
          body: JSON.stringify({
            eventId: eventId,
            mobileNumber: mobileNumber,
            freeEvent: true,
            coinsUsed: coinsToApply,
          }),
        })

        if (!registrationRes.ok) {
          const errorData = await registrationRes.json()
          throw new Error(errorData.error || 'Failed to register for event')
        }

        const registrationData = await registrationRes.json()
        router.push(
          `/registration-success?eventId=${eventId}&regId=${registrationData.registration.id}&coinsUsed=${coinsToApply}`,
        )
        return
      }

      const orderId = await createOrderId()
      if (!orderId) {
        setPaymentLoading(false)
        return
      }

      const options = {
        key: process.env.RAZORPAY_KEY_ID,
        amount: finalAmount * 100,
        currency: 'INR',
        name: event.title,
        description: `Registration for ${event.title}`,
        order_id: orderId,
        handler: async function (response: any) {
          try {
            const verificationData = {
              orderCreationId: orderId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
              eventId: eventId,
              mobileNumber: mobileNumber,
              amountPaid: finalAmount * 100,
              coinsUsed: coinsToApply,
            }

            const result = await fetch('/api/verify', {
              method: 'POST',
              body: JSON.stringify(verificationData),
              headers: { 'Content-Type': 'application/json' },
            })

            const res = await result.json()

            if (res.isOk) {
              router.push(
                `/registration-success?eventId=${eventId}&paymentId=${response.razorpay_payment_id}&coinsUsed=${coinsToApply}`,
              )
            } else {
              setError(res.message || 'Payment verification failed')
              setPaymentLoading(false)
            }
          } catch (error) {
            console.error('Payment verification error:', error)
            setError(
              'An error occurred during payment verification. Please contact support.',
            )
            setPaymentLoading(false)
          }
        },
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.mobileNumber,
        },
        theme: {
          color: '#3399cc',
        },
        modal: {
          ondismiss: function () {
            setPaymentLoading(false)
          },
        },
      }

      const paymentObject = new (window as any).Razorpay(options)
      paymentObject.on('payment.failed', function (response: any) {
        setError(
          `${response.error.description || 'Payment failed'}${response.error.reason ? ` (Reason: ${response.error.reason})` : ''}`
        )
        setPaymentLoading(false)
      })

      paymentObject.open()
    } catch (error) {
      console.error('Payment initiation error:', error)
      setError(`Failed to initiate payment: ${error.message}. Please try again.`)
      setPaymentLoading(false)
    }
  }

  return (
    <div className='min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
      <div className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
        <div className='bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10'>
          <div className='text-center mb-6'>
            <h1 className='text-2xl font-bold text-gray-900'>
              Complete Your Registration
            </h1>
            {paymentRef && (
              <p className='text-gray-600 mt-2'>
                Payment reference: {paymentRef}
              </p>
            )}
          </div>

          <div className='border-t border-b border-gray-200 py-4 mb-6'>
            <h2 className='text-lg font-semibold text-gray-900 mb-3'>
              Event Details
            </h2>
            <div className='space-y-2'>
              <p className='text-gray-900 font-medium'>{event.title}</p>
              <p className='text-gray-600'>
                {format(new Date(event.eventDate), 'MMMM dd, yyyy')} •{' '}
                {event.eventTime}
              </p>

              {event.location && (
                <p className='text-gray-600'>
                  <span className='font-medium'>Location:</span>{' '}
                  {event.location}
                </p>
              )}

              <div className='mt-3'>
                <p className='text-gray-700 font-medium'>Trainers:</p>
                <p className='text-gray-600'>
                  {event.trainers && event.trainers.length > 0
                    ? event.trainers.map(t => t.name).join(', ')
                    : 'To be announced'}
                </p>
              </div>
            </div>
          </div>

          <div className='border-b border-gray-200 py-4 mb-6'>
            <h2 className='text-lg font-semibold text-gray-900 mb-3'>
              Your Details
            </h2>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <p className='text-sm text-gray-500'>Name</p>
                <p className='text-gray-900 truncate'>{user.name}</p>
              </div>
              <div>
                <p className='text-sm text-gray-500'>Mobile</p>
                <p className='text-gray-900'>{user.mobileNumber}</p>
              </div>
              <div className="overflow-hidden">
                <p className='text-sm text-gray-500'>Email</p>
                <p className='text-gray-900 truncate' title={user.email || 'Not provided'}>
                  {user.email || 'Not provided'}
                </p>
              </div>
              {user.city && (
                <div>
                  <p className='text-sm text-gray-500'>City</p>
                  <p className='text-gray-900 truncate'>{user.city}</p>
                </div>
              )}
              <div>
                <p className='text-sm text-gray-500'>Fiddle Coins</p>
                <p className='text-gray-900'>{availableCoins}</p>
              </div>
            </div>
          </div>

          {eventPrice > 0 && (
            <div className='mb-6'>
              <label htmlFor='useCoinsCheckbox' className='flex items-center'>
                <input
                  id='useCoinsCheckbox'
                  type='checkbox'
                  className='h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500'
                  checked={useCoins}
                  onChange={(e) => setUseCoins(e.target.checked)}
                  disabled={availableCoins === 0}
                />
                <span className={`ml-2 text-sm ${availableCoins === 0 ? 'text-gray-400' : 'text-gray-700'}`}>
                  Use your {availableCoins} Fiddle Coins
                  {useCoins && coinsToApply > 0 && ` (Save ₹${coinsToApply.toFixed(2)})`}
                </span>
              </label>
              {availableCoins === 0 && <p className="text-xs text-gray-500 ml-6">You have no Fiddle Coins available.</p>}
            </div>
          )}

          <div className='mb-6'>
            <h2 className='text-lg font-semibold text-gray-900 mb-3'>
              Payment Summary
            </h2>
            <div className='flex justify-between items-center'>
              <span className='text-gray-600'>Event Fee</span>
              <span className='text-gray-900'>₹{eventPrice.toFixed(2)}</span>
            </div>
            {useCoins && coinsToApply > 0 && (
              <div className='flex justify-between items-center text-green-600'>
                <span className='text-sm'>Fiddle Coins Discount</span>
                <span className='text-sm'>- ₹{coinsToApply.toFixed(2)}</span>
              </div>
            )}
            <div className='flex justify-between items-center font-medium mt-3 pt-3 border-t border-gray-200'>
              <span className='text-gray-900'>Total Payable</span>
              <span className='text-gray-900'>₹{finalAmount.toFixed(2)}</span>
            </div>
          </div>

          {finalAmount === 0 ? (
            <div>
              <button
                onClick={handlePayment}
                disabled={paymentLoading}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                  paymentLoading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {paymentLoading ? 'Processing...' : 'Complete Registration'}
              </button>
            </div>
          ) : (
            <div>
              <button
                onClick={handlePayment}
                disabled={paymentLoading}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                  paymentLoading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {paymentLoading
                  ? 'Processing Payment...'
                  : `Pay ₹${finalAmount.toFixed(2)}`}
              </button>
              <p className='text-xs text-gray-500 mt-2 text-center'>
                By clicking this button, you agree to our Terms of Service and
                Privacy Policy.
              </p>
            </div>
          )}

          {error && (
            <div className='mt-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md'>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}