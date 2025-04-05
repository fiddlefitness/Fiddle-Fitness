// app/admin/users/[id]/page.js
'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

export default function UserDetailsPage({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = React.use(params as Promise<{ id: string }>);
  const { id } = unwrappedParams;
  
  const [user, setUser] = useState(null);
  const [registrations, setRegistrations] = useState({ upcoming: [], past: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('details');

  const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        
        // Fetch user details first
        const userResponse = await fetch(`/api/users/${id}`, {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
          },
        });
        
        if (!userResponse.ok) {
          const errorData = await userResponse.json();
          throw new Error(errorData.error || 'Failed to fetch user details');
        }
        
        const userData = await userResponse.json();
        setUser(userData);
        
        // Fetch user registrations
        const registrationsResponse = await fetch(`/api/users/${userData.mobileNumber}/registrations`, {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
          },
        });
        
        if (!registrationsResponse.ok) {
          const errorData = await registrationsResponse.json();
          throw new Error(errorData.error || 'Failed to fetch user registrations');
        }
        
        const registrationsData = await registrationsResponse.json();
        setRegistrations(registrationsData.registrations);
        
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      fetchUserData();
    }
  }, [id, API_KEY]);

  const handleEventClick = (eventId) => {
    router.push(`/admin/events/${eventId}`);
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

  if (!user) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold">User not found</h2>
        <button 
          onClick={() => router.push('/admin/users')}
          className="mt-4 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
        >
          Back to Users List
        </button>
      </div>
    );
  }

  const totalEvents = (registrations.upcoming?.length || 0) + (registrations.past?.length || 0);
  
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">User Details</h1>
        <button 
          onClick={() => router.push('/admin/users')}
          className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded"
        >
          Back to Users List
        </button>
      </div>
      
      {/* User profile header */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="p-6">
          <div className="flex flex-col md:flex-row justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{user.name}</h2>
              <p className="text-gray-600 mt-1">ID: {user.id}</p>
              
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Mobile Number</p>
                  <p className="font-medium">{user.mobileNumber}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{user.email || 'Not provided'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">City</p>
                  <p className="font-medium">{user.city || 'Not provided'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Gender</p>
                  <p className="font-medium">{user.gender || 'Not provided'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Registered Since</p>
                  <p className="font-medium">{new Date(user.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 md:mt-0 grid grid-cols-1 gap-4">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center">
                <p className="text-sm text-blue-700">Total Events</p>
                <p className="text-2xl font-bold text-blue-800">{totalEvents}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="border-t border-gray-200">
          <nav className="flex">
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
              onClick={() => setActiveTab('events')}
              className={`px-6 py-3 font-medium text-sm focus:outline-none ${
                activeTab === 'events'
                  ? 'text-blue-600 border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Events ({totalEvents})
            </button>
          </nav>
        </div>
      </div>
      
      {/* Tab contents */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden p-6">
        {activeTab === 'details' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">User Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Basic Information</h4>
                <table className="min-w-full">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 text-gray-500 w-1/3">Full Name</td>
                      <td className="py-2 font-medium">{user.name}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-500">Mobile Number</td>
                      <td className="py-2 font-medium">{user.mobileNumber}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-500">Email</td>
                      <td className="py-2 font-medium">{user.email || 'Not provided'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-500">City</td>
                      <td className="py-2 font-medium">{user.city || 'Not provided'}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-500">Gender</td>
                      <td className="py-2 font-medium">{user.gender || 'Not provided'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Activity Summary</h4>
                <table className="min-w-full">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 text-gray-500 w-1/2">Account Created</td>
                      <td className="py-2 font-medium">{new Date(user.createdAt).toLocaleDateString()}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-500">Upcoming Events</td>
                      <td className="py-2 font-medium">{registrations.upcoming?.length || 0}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-500">Past Events</td>
                      <td className="py-2 font-medium">{registrations.past?.length || 0}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-500">Total Events</td>
                      <td className="py-2 font-medium">{totalEvents}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'events' && (
          <div>
            {/* Upcoming Events */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4">Upcoming Events ({registrations.upcoming?.length || 0})</h3>
              
              {registrations.upcoming && registrations.upcoming.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pool Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {registrations.upcoming.map((event) => (
                        <tr key={event.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{event.eventTitle}</div>
                            <div className="text-sm text-gray-500">{event.trainers?.join(', ')}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{event.formattedDate}</div>
                            <div className="text-sm text-gray-500">{event.eventTime}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {event.poolAssigned ? (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                Assigned: {event.pool?.name || 'Pool'}
                              </span>
                            ) : (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                Not Assigned
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ₹{event.price.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleEventClick(event.eventId)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              View Event
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 italic">No upcoming events</p>
              )}
            </div>
            
            {/* Past Events */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Past Events ({registrations.past?.length || 0})</h3>
              
              {registrations.past && registrations.past.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pool</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {registrations.past.map((event) => (
                        <tr key={event.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{event.eventTitle}</div>
                            <div className="text-sm text-gray-500">{event.trainers?.join(', ')}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{event.formattedDate}</div>
                            <div className="text-sm text-gray-500">{event.eventTime}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {event.poolAssigned ? (
                              <div>
                                <div className="text-sm font-medium">{event.pool?.name || 'Pool'}</div>
                                {event.pool?.trainer && (
                                  <div className="text-xs text-gray-500">Trainer: {event.pool.trainer}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ₹{event.price.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleEventClick(event.eventId)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              View Event
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 italic">No past events</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}