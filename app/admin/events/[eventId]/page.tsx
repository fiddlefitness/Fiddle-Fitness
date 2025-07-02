// app/admin/events/[id]/page.js
'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

export default function EventDetailPage({ params }: { params: { eventId: string } | Promise<{ eventId: string }> }) {
  const router = useRouter();
  const unwrappedParams = React.use(params as Promise<{ eventId: string }>);
  const { eventId } = unwrappedParams;
  
  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [pools, setPools] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  console.log(registrations)

  const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

  console.log(event?.trainers)

  useEffect(() => {
    const fetchEventData = async () => {
      try {
        setLoading(true);
        
        // Fetch event details
        const eventResponse = await fetch(`/api/events/${eventId}`, {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
          },
        });
        
        if (!eventResponse.ok) {
          const errorData = await eventResponse.json();
          throw new Error(errorData.error || 'Failed to fetch event details');
        }
        
        const eventData = await eventResponse.json();
        setEvent(eventData);
        
        // Fetch registrations if available
        if (eventData.registrations) {
          setRegistrations(eventData.registrations);
        }
        
        // Fetch pools if available
        if (eventData.pools) {
          setPools(eventData.pools);
        }
        
        // Fetch reviews for the event
        if (eventData.id) {
          try {
            const reviewsResponse = await fetch(`/api/events/${eventData.id}/reviews`, {
              headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY,
              },
            });
            
            if (reviewsResponse.ok) {
              const reviewsData = await reviewsResponse.json();
              setReviews(reviewsData.reviews || []);
              setAverageRating(reviewsData.averageRating || 0);
              setTotalReviews(reviewsData.totalReviews || 0);
            }
          } catch (reviewsError) {
            console.error('Error fetching event reviews:', reviewsError);
            // Don't set the main error state, just log it
          }
        }
        
      } catch (err) {
        console.error('Error fetching event data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    if (eventId) {
      fetchEventData();
    }
  }, [eventId, API_KEY]);

  const handleDeleteEvent = async () => {
    try {
      setIsDeleting(true);
      
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete event');
      }
      
      // Redirect to events list after successful deletion
      router.push('/admin/events');
      
    } catch (err) {
      console.error('Error deleting event:', err);
      setError(`Delete failed: ${err.message}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleEditEvent = () => {
    router.push(`/admin/events/${eventId}/edit`);
  };

  const handleViewUser = (userId) => {
    router.push(`/admin/users/${userId}`);
  };

  // Helper function to render stars for ratings
  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    // Add full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <svg key={`full-${i}`} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      );
    }
    
    // Add half star if needed
    if (hasHalfStar) {
      stars.push(
        <svg key="half" className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
          <defs>
            <linearGradient id="halfGradient">
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="50%" stopColor="#D1D5DB" />
            </linearGradient>
          </defs>
          <path fill="url(#halfGradient)" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      );
    }
    
    // Add empty stars to make 5 total
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <svg key={`empty-${i}`} className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      );
    }
    
    return (
      <div className="flex items-center">
        {stars}
        <span className="ml-1 text-sm text-gray-600">({rating.toFixed(1)})</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold">Event not found</h2>
        <button 
          onClick={() => router.push('/admin/events')}
          className="mt-4 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
        >
          Back to Events List
        </button>
      </div>
    );
  }

  // Calculate event statistics
  const totalRegistrations = registrations.length;
  const registrationsWithPayment = registrations.filter(reg => reg.payment && reg.payment.status === 'completed').length;
  const totalPools = pools.length;
  const totalCapacity = event.maxCapacity || 0;
  const registrationPercentage = totalCapacity > 0 ? (totalRegistrations / totalCapacity) * 100 : 0;
  
  const eventDate = new Date(event.eventDate);
  const isPastEvent = eventDate < new Date();
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  
  // Format deadline if exists
  let formattedDeadline = 'No deadline set';
  if (event.registrationDeadline) {
    formattedDeadline = new Date(event.registrationDeadline).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Event Details</h1>
        <div className="flex space-x-3">
          <button 
            onClick={handleEditEvent}
            className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
          >
            Edit Event
          </button>
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded"
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Event'}
          </button>
          <button 
            onClick={() => router.push('/admin/events')}
            className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded"
          >
            Back to Events
          </button>
        </div>
      </div>
      
      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Confirm Deletion</h3>
            <p className="mb-6">
              Are you sure you want to delete the event <span className="font-semibold">{event.title}</span>? 
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEvent}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Event'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Event header */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="relative">
          <div className="absolute top-0 right-0 mt-4 mr-4 flex flex-col items-end space-y-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              isPastEvent
                ? 'bg-gray-100 text-gray-800'
                : 'bg-green-100 text-green-800'
            }`}>
              {isPastEvent ? 'Past Event' : 'Upcoming Event'}
            </span>
            
            {isPastEvent && totalReviews > 0 && (
              <div className="bg-yellow-50 text-yellow-800 px-3 py-1 rounded-full flex items-center">
                {renderStars(averageRating)}
              </div>
            )}
          </div>
          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-800">{event.title}</h2>
            <p className="text-gray-600 mt-1">{event.description || 'No description provided'}</p>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-500">Date & Time</p>
                <p className="font-medium">{formattedDate}</p>
                <p className="text-gray-500">{event.eventTime}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Location</p>
                <p className="font-medium">{event.location || 'Not specified'}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Category</p>
                <p className="font-medium">{event.category}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Price</p>
                <p className="font-medium">₹{event.price?.toFixed(2) || '0.00'}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Capacity</p>
                <p className="font-medium">{event.maxCapacity || 'Unlimited'}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Registration Deadline</p>
                <p className="font-medium">{formattedDeadline}</p>
              </div>
            </div>
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center">
                <p className="text-sm text-blue-700">Registrations</p>
                <p className="text-2xl font-bold text-blue-800">{totalRegistrations}</p>
                <p className="text-xs text-blue-600">{registrationPercentage.toFixed(0)}% of capacity</p>
              </div>
              
              <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-center">
                <p className="text-sm text-green-700">Paid</p>
                <p className="text-2xl font-bold text-green-800">{registrationsWithPayment}</p>
                <p className="text-xs text-green-600">
                  {totalRegistrations > 0 
                    ? `${((registrationsWithPayment / totalRegistrations) * 100).toFixed(0)}% of registrations` 
                    : '0% of registrations'}
                </p>
              </div>
              
              <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 text-center">
                <p className="text-sm text-purple-700">Pools</p>
                <p className="text-2xl font-bold text-purple-800">{totalPools}</p>
              </div>
              
              <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 text-center">
                <p className="text-sm text-orange-700">Trainers</p>
                <p className="text-2xl font-bold text-orange-800">{event.trainers?.length || 0}</p>
              </div>
              
              {isPastEvent && (
                <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 text-center">
                  <p className="text-sm text-yellow-700">Reviews</p>
                  <p className="text-2xl font-bold text-yellow-800">{totalReviews}</p>
                  {totalReviews > 0 && (
                    <div className="flex justify-center mt-1">
                      {renderStars(averageRating)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="border-t border-gray-200">
          <nav className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-6 py-3 font-medium text-sm focus:outline-none ${
                activeTab === 'details'
                  ? 'text-blue-600 border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Details
            </button>
            
            <button
              onClick={() => setActiveTab('registrations')}
              className={`px-6 py-3 font-medium text-sm focus:outline-none ${
                activeTab === 'registrations'
                  ? 'text-blue-600 border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Registrations ({totalRegistrations})
            </button>
            
            <button
              onClick={() => setActiveTab('pools')}
              className={`px-6 py-3 font-medium text-sm focus:outline-none ${
                activeTab === 'pools'
                  ? 'text-blue-600 border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Pools ({totalPools})
            </button>
            
            <button
              onClick={() => setActiveTab('trainers')}
              className={`px-6 py-3 font-medium text-sm focus:outline-none ${
                activeTab === 'trainers'
                  ? 'text-blue-600 border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Trainers ({event.trainers?.length || 0})
            </button>
            
            {isPastEvent && (
              <button
                onClick={() => setActiveTab('reviews')}
                className={`px-6 py-3 font-medium text-sm focus:outline-none ${
                  activeTab === 'reviews'
                    ? 'text-blue-600 border-b-2 border-blue-500'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Reviews ({totalReviews})
              </button>
            )}
          </nav>
        </div>
      </div>
      
      {/* Tab contents */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden p-6">
        {activeTab === 'details' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Event Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Basic Information</h4>
                <table className="min-w-full">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 text-gray-500 w-1/3">Title</td>
                      <td className="py-2 font-medium">{event.title}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-500">Description</td>
                      <td className="py-2">{event.description || 'No description provided'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-500">Category</td>
                      <td className="py-2 font-medium">{event.category}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-500">Date</td>
                      <td className="py-2 font-medium">{formattedDate}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-500">Time</td>
                      <td className="py-2 font-medium">{event.eventTime}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-500">Location</td>
                      <td className="py-2 font-medium">{event.location || 'Not specified'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-500">Price</td>
                      <td className="py-2 font-medium">₹{event.price?.toFixed(2) || '0.00'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Event Settings</h4>
                <table className="min-w-full">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 text-gray-500 w-1/2">Maximum Capacity</td>
                      <td className="py-2 font-medium">{event.maxCapacity || 'Unlimited'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-500">Pool Capacity</td>
                      <td className="py-2 font-medium">{event.poolCapacity || 'Not specified'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-500">Registration Deadline</td>
                      <td className="py-2 font-medium">{formattedDeadline}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-500">Pools Assigned</td>
                      <td className="py-2 font-medium">{event.poolsAssigned ? 'Yes' : 'No'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-500">Notification Sent</td>
                      <td className="py-2 font-medium">{event.notificationSent ? 'Yes' : 'No'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-500">Created At</td>
                      <td className="py-2 font-medium">{new Date(event.createdAt).toLocaleDateString()}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-500">Last Updated</td>
                      <td className="py-2 font-medium">{new Date(event.updatedAt).toLocaleDateString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'registrations' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Registered Participants ({totalRegistrations})</h3>
              
            </div>
            
            {registrations && registrations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participant</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registration Date</th>
                      {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Status</th> */}
                      {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pool</th> */}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {registrations.map((registration) => (
                      <tr key={registration.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{registration.name}</div>
                          <div className="text-sm text-gray-500">ID: {registration.id.slice(0, 8)}...</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{registration.mobileNumber}</div>
                          <div className="text-sm text-gray-500">{registration.email || 'No email'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(registration.registrationDate).toLocaleDateString()}
                        </td>
                        {/* <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            registration.payment?.status === 'completed' 
                              ? 'bg-green-100 text-green-800' 
                              : registration.payment?.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : registration.payment?.status === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                          }`}>
                            {registration.payment?.status === 'completed' ? 'Paid' : 
                             registration.payment?.status === 'pending' ? 'Pending' :
                             registration.payment?.status === 'failed' ? 'Failed' :
                             'Not Paid'}
                          </span>
                        </td> */}
                        {/* <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {registration.poolAttendee ? registration.poolAttendee.pool.name : 'Not assigned'}
                        </td> */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleViewUser(registration.user.id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View User
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 italic">No registrations for this event</p>
            )}
          </div>
        )}
        
        {activeTab === 'pools' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Pools ({totalPools})</h3>
              <div className="flex space-x-2">
               
                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white text-sm py-1 px-3 rounded"
                  onClick={() => {/* Add auto-assign function here */}}
                  disabled={event.poolsAssigned}
                >
                  Auto-Assign Pools
                </button>
              </div>
            </div>
            
            {pools && pools.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pools.map((pool) => (
                  <div key={pool.id} className="border rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                      <h4 className="font-medium">{pool.name || `Pool ${pool.id.slice(0, 6)}`}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        pool.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {pool.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="mb-3">
                        <div className="text-sm text-gray-500">Trainer</div>
                        <div className="font-medium">{pool.trainer?.name || 'No trainer assigned'}</div>
                      </div>
                      
                      <div className="mb-3">
                        <div className="text-sm text-gray-500">Meet Link</div>
                        <div className="font-medium">
                          {pool.meetLink ? (
                            <a href={pool.meetLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {pool.meetLink}
                            </a>
                          ) : (
                            'No link provided'
                          )}
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <div className="text-sm text-gray-500">Capacity</div>
                        <div className="font-medium">{pool.capacity || 'Not specified'}</div>
                      </div>
                      
                      <div className="mb-3">
                        <div className="text-sm text-gray-500">Attendees</div>
                        <div className="font-medium">{pool.attendees?.length || 0} participants</div>
                      </div>
                      
                      <div className="mt-4 flex space-x-2">
                        <button
                          className="text-sm text-blue-600 hover:text-blue-900"
                          onClick={() => {/* Add view pool details function here */}}
                        >
                          View Details
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          className="text-sm text-blue-600 hover:text-blue-900"
                          onClick={() => {/* Add edit pool function here */}}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No pools have been created for this event</p>
            )}
          </div>
        )}
        
        {activeTab === 'trainers' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Trainers ({event.trainers?.length || 0})</h3>
              
            </div>
            
            {event.trainers && event.trainers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {event.trainers.map((trainer) => (
                  <div key={trainer.id} className="border rounded-lg overflow-hidden shadow-sm">
                    <div className="p-4">
                      <h4 className="font-medium text-lg mb-2">{trainer.name}</h4>
                      
                      <div className="mb-2">
                        <div className="text-sm text-gray-500">Contact</div>
                        <div className="font-medium">{trainer.mobileNumber}</div>
                        {trainer.email && (
                          <div className="text-sm text-gray-500">{trainer.email}</div>
                        )}
                      </div>
                      
                      <div className="mb-2">
                        <div className="text-sm text-gray-500">Assigned Pools</div>
                        <div className="font-medium">
                          {pools.filter(pool => pool.trainerId === trainer.id).length || 0} pools
                        </div>
                      </div>
                      
                     
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No trainers assigned to this event</p>
            )}
          </div>
        )}
        
        {activeTab === 'reviews' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Event Reviews ({totalReviews})</h3>
              
              {totalReviews > 0 && (
                <div className="flex items-center bg-yellow-50 text-yellow-800 px-4 py-2 rounded-lg">
                  <span className="mr-2 font-medium">Average Rating:</span>
                  {renderStars(averageRating)}
                </div>
              )}
            </div>
            
            {reviews.length > 0 ? (
              <div className="space-y-6">
                {reviews.map((review) => (
                  <div key={review.id} className="border rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                      <div>
                        <h4 className="font-medium">{review.user.name}</h4>
                        <p className="text-sm text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center">
                        {renderStars(review.rating || 0)}
                      </div>
                    </div>
                    
                    <div className="p-4">
                      <div className="mb-3">
                        <div className="text-sm text-gray-500">Feedback</div>
                        <div className="font-medium">
                          {review.feedback ? (
                            <div className="mt-2">
                              {review.feedback === 'audio_video' && 'Audio & Video Quality Issues'}
                              {review.feedback === 'trainer' && 'Trainer Effectiveness Issues'}
                              {review.feedback === 'content' && 'Choice of Songs Issues'}
                              {review.feedback === 'payment' && 'Payment/Registration Issues'}
                              {!['audio_video', 'trainer', 'content', 'payment'].includes(review.feedback) && review.feedback}
                            </div>
                          ) : (
                            <span className="text-gray-400">No detailed feedback provided</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <div className="text-sm text-gray-500">Contact</div>
                        <div className="font-medium">{review.user.mobileNumber}</div>
                        {review.user.email && (
                          <div className="text-sm text-gray-500">{review.user.email}</div>
                        )}
                      </div>
                      
                      <div className="mt-4 flex space-x-2">
                        <button
                          className="text-sm text-blue-600 hover:text-blue-900"
                          onClick={() => handleViewUser(review.user.mobileNumber)}
                        >
                          View User Profile
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12.5h.01M12 20h.01M16 6a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No reviews yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  This event doesn't have any reviews yet.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}