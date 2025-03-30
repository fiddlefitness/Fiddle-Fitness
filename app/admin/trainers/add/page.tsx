// app/admin/trainers/add/page.js
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AddTrainerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobileNumber: '',
  })

  const handleChange = e => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    // Clear error when user starts typing again
    if (error) {
      setError(null)
    }
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/trainers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || '',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) { 
        throw new Error(data.error || 'Failed to create trainer')
      }

      console.log('Trainer created:', data)
      router.push('/admin/trainers')
    } catch (error) {
      console.error('Error creating trainer:', error)
      setError(error.message || 'Error creating trainer. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='max-w-2xl mx-auto'>
      <div className='flex items-center justify-between mb-6'>
        <h1 className='text-2xl font-bold'>Add New Trainer</h1>
        <Link
          href='/admin/trainers'
          className='px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors'
        >
          Cancel
        </Link>
      </div>

      <div className='bg-white rounded-lg shadow-md p-6'>
        {error && (
          <div className='mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md'>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className='space-y-4'>
            <div>
              <label
                htmlFor='name'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Full Name*
              </label>
              <input
                type='text'
                id='name'
                name='name'
                required
                value={formData.name}
                onChange={handleChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
              />
            </div>

            <div>
              <label
                htmlFor='email'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Email Address
              </label>
              <input
                type='email'
                id='email'
                name='email'
                required
                value={formData.email}
                onChange={handleChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
              />
                <p className='mt-1 text-sm text-gray-500'>
                Please provide the Gmail address that will be used for meeting invites
                </p>
            </div>

            <div>
              <label
                htmlFor='mobileNumber'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Mobile Number*
              </label>
              <input
                type='tel'
                id='mobileNumber'
                name='mobileNumber'
                required
                placeholder='+1234567890'
                value={formData.mobileNumber}
                onChange={handleChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
              />
            </div>
          </div>

          <div className='mt-6 flex justify-end'>
            <button
              type='submit'
              disabled={loading}
              className={`px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Creating...' : 'Create Trainer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
