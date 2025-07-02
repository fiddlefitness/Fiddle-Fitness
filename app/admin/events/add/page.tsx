// app/admin/events/add/page.js
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { EVENT_CATEGORIES } from '@/lib/constants/categoryIds'

// Hardcoded list of fitness categories

export default function AddEventPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [trainers, setTrainers] = useState([])
  const [trainersLoading, setTrainersLoading] = useState(true)
  const [selectedTrainers, setSelectedTrainers] = useState([])
  const [error, setError] = useState<null | string>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '', // Added category field
    eventDate: '',
    startTime: '',
    startPeriod: 'AM',
    endTime: '',
    endPeriod: 'PM',
    maxCapacity: 100,
    poolCapacity: 50, // Default value for pool capacity
    price: 0,
    registrationDeadline: '',
  })

  useEffect(() => {
    // Fetch trainers from API
    fetchTrainers()
  }, [])

  const formatTimeForSubmission = () => {
    return `${formData.startTime} ${formData.startPeriod} - ${formData.endTime} ${formData.endPeriod}`;
  };

  const fetchTrainers = async () => {
    setTrainersLoading(true)
    try {
      const res = await fetch('/api/trainers', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || '',
        },
      })

      if (!res.ok) {
        throw new Error('Failed to fetch trainers')
      }

      const data = await res.json()
      setTrainers(data)
    } catch (error) {
      console.error('Error fetching trainers:', error)
      setError('Failed to load trainers. Please try again later.')
    } finally {
      setTrainersLoading(false)
    }
  }

  const handleChange = e => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    // Clear error when user starts typing again
    if (error) {
      setError(null)
    }
  }

  const handleTrainerSelect = trainerId => {
    // If trainer is already selected, remove them
    if (selectedTrainers.includes(trainerId)) {
      setSelectedTrainers(selectedTrainers.filter(id => id !== trainerId))
    } else {
      // Otherwise add them to selected trainers
      setSelectedTrainers([...selectedTrainers, trainerId])
    }
  }

  const handleSubmit = async e => {
    e.preventDefault()

    // Validate category is selected
    if (!formData.category) {
      setError('Please select an event category')
      return
    }

    // Check if max capacity to pool capacity ratio requires more trainers
    const capacityRatio = formData.maxCapacity / formData.poolCapacity
    // Calculate minimum required trainers based on the capacity ratio
    const minRequiredTrainers = Math.ceil(capacityRatio)

    if (selectedTrainers.length < minRequiredTrainers) {
      setError(
        `Based on your event setup (${
          formData.maxCapacity
        } total capacity with ${
          formData.poolCapacity
        } per pool), you need at least ${minRequiredTrainers} trainers. Please select ${
          minRequiredTrainers - selectedTrainers.length
        } more trainer(s).`,
      )
      return
    }

    if (selectedTrainers.length === 0) {
      setError('Please select at least one trainer for the event.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Combine form data with selected trainers
      const { startTime, endTime, startPeriod, endPeriod, ...rest } = formData;
      const eventData = {
        ...rest,
        eventTime: formatTimeForSubmission(),
        trainers: selectedTrainers,
      }

      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || '',
        },
        body: JSON.stringify(eventData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create event')
      }

      console.log('Event created:', data)
      router.push('/admin/events')
    } catch (error) {
      console.error('Error creating event:', error)
      setError(error.message || 'Error creating event. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='max-w-4xl mx-auto'>
      <div className='flex items-center justify-between mb-6'>
        <h1 className='text-2xl font-bold'>Add New Event</h1>
        <Link
          href='/admin/events'
          className='px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors'
        >
          Cancel
        </Link>
      </div>

      <div className='bg-white rounded-lg shadow-md p-6'>
        {error && (
          <div className='mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md'>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-6'>
            <div>
              <label
                htmlFor='title'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Event Title*
              </label>
              <input
                type='text'
                id='title'
                name='title'
                required
                value={formData.title}
                onChange={handleChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
              />
            </div>

            {/* Added Category Dropdown */}
            <div>
              <label
                htmlFor='category'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Event Category*
              </label>
              <select
                id='category'
                name='category'
                required
                value={formData.category}
                onChange={handleChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
              >
                <option value=''>-- Select Event Category --</option>
                {EVENT_CATEGORIES.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor='eventDate'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Event Date*
              </label>
              <input
                type='date'
                id='eventDate'
                name='eventDate'
                required
                value={formData.eventDate}
                onChange={handleChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
              />
            </div>

            <div>
              <label
                htmlFor='eventTime'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Event Time*
              </label>
              <div className='grid grid-cols-7 gap-2 items-center'>
                <div className='col-span-2'>
                  <input
                    type='text'
                    id='startTime'
                    name='startTime'
                    required
                    placeholder='Start time'
                    value={formData.startTime}
                    onChange={handleChange}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
                  />
                </div>
                <div className='col-span-1'>
                  <select
                    id='startPeriod'
                    name='startPeriod'
                    required
                    value={formData.startPeriod}
                    onChange={handleChange}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
                  >
                    <option value='AM'>AM</option>
                    <option value='PM'>PM</option>
                  </select>
                </div>
                <div className='col-span-1 text-center'>to</div>
                <div className='col-span-2'>
                  <input
                    type='text'
                    id='endTime'
                    name='endTime'
                    required
                    placeholder='End time'
                    value={formData.endTime}
                    onChange={handleChange}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
                  />
                </div>
                <div className='col-span-1'>
                  <select
                    id='endPeriod'
                    name='endPeriod'
                    required
                    value={formData.endPeriod}
                    onChange={handleChange}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
                  >
                    <option value='AM'>AM</option>
                    <option value='PM'>PM</option>
                  </select>
                </div>
              </div>
              <p className='mt-1 text-sm text-gray-500'>
                Format: HH:MM (e.g. 10:00 AM - 2:00 PM)
              </p>
            </div>

            <div>
              <label
                htmlFor='price'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Price
              </label>
              <div className='relative mt-1 rounded-md shadow-sm'>
                <div className='pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3'>
                  <span className='text-gray-500 sm:text-sm'>₹</span>
                </div>
                <input
                  type='number'
                  id='price'
                  name='price'
                  min='0'
                  step='0.01'
                  value={formData.price}
                  onChange={handleChange}
                  className='w-full pl-7 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
                />
              </div>
              <p className='mt-1 text-sm text-gray-500'>
                Price for the event (0 for free events)
              </p>
            </div>

            <div>
              <label
                htmlFor='maxCapacity'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Maximum Capacity*
              </label>
              <input
                type='number'
                id='maxCapacity'
                name='maxCapacity'
                required
                min='1'
                value={formData.maxCapacity}
                onChange={handleChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
              />
              <p className='mt-1 text-sm text-gray-500'>
                Maximum number of attendees for this event
              </p>
            </div>

            <div>
              <label
                htmlFor='poolCapacity'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Pool Capacity*
              </label>
              <input
                type='number'
                id='poolCapacity'
                name='poolCapacity'
                required
                min='1'
                value={formData.poolCapacity}
                onChange={handleChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
              />
              <p className='mt-1 text-sm text-gray-500'>
                Maximum number of attendees per pool
              </p>
            </div>

            <div>
              <label
                htmlFor='registrationDeadline'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Registration Deadline*
              </label>
              <input
                type='date'
                id='registrationDeadline'
                name='registrationDeadline'
                required
                value={formData.registrationDeadline}
                onChange={handleChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
              />
              <p className='mt-1 text-sm text-gray-500'>
                Last date for users to register for this event
              </p>
            </div>

            <div className='md:col-span-2'>
              <label
                htmlFor='description'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Description
              </label>
              <textarea
                id='description'
                name='description'
                rows='3'
                value={formData.description}
                onChange={handleChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
              ></textarea>
            </div>
          </div>

          <div className='border-t border-gray-200 pt-6 mb-6'>
            <h2 className='text-lg font-medium mb-4'>Select Trainers</h2>

            <div className='mb-2'>
              <p className='text-sm text-gray-600 mb-2'>
                Select trainers who will be available for this event. You can
                select multiple trainers.
              </p>
              {selectedTrainers.length === 0 && (
                <p className='text-red-500 text-sm mb-2'>
                  Please select at least one trainer
                </p>
              )}
            </div>

            {trainersLoading ? (
              <div className='text-center py-4'>
                <p>Loading trainers...</p>
              </div>
            ) : trainers.length === 0 ? (
              <div className='bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md mb-4'>
                <p>No trainers found. Please add trainers first.</p>
                <Link
                  href='/admin/trainers/add'
                  className='underline hover:text-yellow-800'
                >
                  Add a trainer
                </Link>
              </div>
            ) : (
              <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
                {trainers.map(trainer => (
                  <div
                    key={trainer.id}
                    onClick={() => handleTrainerSelect(trainer.id)}
                    className={`
                      p-3 border rounded-md cursor-pointer transition-colors
                      ${
                        selectedTrainers.includes(trainer.id)
                          ? 'bg-indigo-100 border-indigo-300'
                          : 'bg-white border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className='flex items-center'>
                      <div className='flex-shrink-0'>
                        <div className='h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center'>
                          <span className='text-indigo-600 font-medium'>
                            {trainer.name
                              .split(' ')
                              .map(n => n[0])
                              .join('')}
                          </span>
                        </div>
                      </div>
                      <div className='ml-3'>
                        <p className='text-sm font-medium text-gray-900'>
                          {trainer.name}
                        </p>
                      </div>
                      {selectedTrainers.includes(trainer.id) && (
                        <div className='ml-auto'>
                          <svg
                            xmlns='http://www.w3.org/2000/svg'
                            className='h-5 w-5 text-indigo-600'
                            viewBox='0 0 20 20'
                            fill='currentColor'
                          >
                            <path
                              fillRule='evenodd'
                              d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                              clipRule='evenodd'
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className='flex justify-end'>
            <button
              type='submit'
              disabled={loading || trainersLoading || trainers.length === 0}
              className={`px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors ${
                loading || trainersLoading || trainers.length === 0
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              {loading ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
