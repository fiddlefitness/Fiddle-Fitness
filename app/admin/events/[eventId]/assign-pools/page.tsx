// app/admin/events/[eventId]/assign-pools/page.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';


// @ts-expect-error
export default function AssignPoolsPage({ params }) {
  const router = useRouter();
  const { eventId } = params;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [event, setEvent] = useState(null);
  const [poolConfig, setPoolConfig] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEventDetails();
  }, [eventId]);

  const fetchEventDetails = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/events/${eventId}`);
      
      if (!res.ok) {
        throw new Error('Failed to fetch event details');
      }
      
      const eventData = await res.json();
      setEvent(eventData);
      
      // Initialize pool configuration based on trainers
      // If pools already exist, use them; otherwise create new ones
      if (eventData.poolsAssigned && eventData.pools && eventData.pools.length > 0) {
        setPoolConfig(eventData.pools);
      } else {
        // Create initial pool configuration based on trainers
        const initialPoolConfig = eventData.trainers.map((trainer, index) => ({
          id: `new-pool-${index + 1}`,
          name: `Pool ${String.fromCharCode(65 + index)}`, // Pool A, Pool B, etc.
          trainerId: trainer.id,
          trainerName: trainer.name,
          capacity: Math.ceil(eventData.registrations.length / eventData.trainers.length),
          meetLink: '',
          attendees: []
        }));
        
        setPoolConfig(initialPoolConfig);
      }
    } catch (error) {
      console.error('Error fetching event details:', error);
      setError('Failed to fetch event details. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handlePoolCapacityChange = (poolId, newCapacity) => {
    setPoolConfig(pools => 
      pools.map(pool => 
        pool.id === poolId 
          ? { ...pool, capacity: parseInt(newCapacity) || 0 } 
          : pool
      )
    );
  };

  const handleMeetLinkChange = (poolId, meetLink) => {
    setPoolConfig(pools => 
      pools.map(pool => 
        pool.id === poolId 
          ? { ...pool, meetLink } 
          : pool
      )
    );
  };

  const distributeUsers = () => {
    if (!event || !event.registrations) return;

    // Clone registrations to avoid mutating the original data
    const users = [...event.registrations];
    const totalCapacity = poolConfig.reduce((sum, pool) => sum + pool.capacity, 0);

    // Check if we have enough capacity for all users
    if (totalCapacity < users.length) {
      alert(`Warning: Total pool capacity (${totalCapacity}) is less than the number of registered users (${users.length})`);
    }

    // Create a new pool configuration with empty attendees arrays
    const newPoolConfig = poolConfig.map(pool => ({
      ...pool,
      attendees: []
    }));

    // Distribute users evenly across pools according to capacity
    let userIndex = 0;
    
    // First pass: distribute users according to pool capacity ratios
    for (const pool of newPoolConfig) {
      const poolShare = Math.min(
        pool.capacity,
        Math.floor((pool.capacity / totalCapacity) * users.length)
      );
      
      for (let i = 0; i < poolShare && userIndex < users.length; i++) {
        pool.attendees.push(users[userIndex]);
        userIndex++;
      }
    }
    
    // Second pass: distribute any remaining users
    while (userIndex < users.length) {
      for (const pool of newPoolConfig) {
        if (pool.attendees.length < pool.capacity && userIndex < users.length) {
          pool.attendees.push(users[userIndex]);
          userIndex++;
        }
      }
    }

    setPoolConfig(newPoolConfig);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    
    try {
      // Validate that meet links are provided
      const missingLinks = poolConfig.some(pool => !pool.meetLink);
      if (missingLinks) {
        if (!confirm('Some pools are missing meet links. Do you want to continue anyway?')) {
          setSubmitting(false);
          return;
        }
      }

      const response = await fetch(`/api/events/${eventId}/assign-pools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(poolConfig)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to assign pools');
      }
      
      console.log('Pools assigned:', data);
      router.push('/admin/events');
    } catch (error) {
      console.error('Error assigning pools:', error);
      setError(error.message || 'Error assigning pools. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <div className="text-center">
          <p>Loading event details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-6">
          <p>{error}</p>
          <button 
            onClick={fetchEventDetails}
            className="text-red-700 underline mt-2"
          >
            Try Again
          </button>
        </div>
        <div className="flex justify-center mt-4">
          <Link 
            href="/admin/events" 
            className="px-4 py-2 bg-indigo-600 text-white rounded-md"
          >
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <div className="text-center">
          <p className="text-red-500">Event not found</p>
          <Link 
            href="/admin/events" 
            className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded-md"
          >
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Assign Pools</h1>
          <p className="text-gray-600">{event.title}</p>
        </div>
        <Link 
          href="/admin/events" 
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
        >
          Cancel
        </Link>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Event Date</h3>
            <p className="mt-1 text-lg">{format(new Date(event.eventDate), 'MMMM dd, yyyy')}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Event Time</h3>
            <p className="mt-1 text-lg">{event.eventTime}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Location</h3>
            <p className="mt-1 text-lg">{event.location || 'No location specified'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Registered Users</h3>
            <p className="mt-1 text-lg">{event.registrations.length}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Max Capacity</h3>
            <p className="mt-1 text-lg">{event.maxCapacity}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Registration Deadline</h3>
            <p className="mt-1 text-lg">
              {event.registrationDeadline 
                ? format(new Date(event.registrationDeadline), 'MMMM dd, yyyy')
                : 'No deadline set'}
            </p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Pool Configuration</h2>
          <button
            type="button"
            onClick={distributeUsers}
            className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition-colors text-sm"
          >
            Auto-Distribute Users
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {poolConfig.map((pool, index) => (
              <div key={pool.id} className="border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pool Name
                    </label>
                    <input
                      type="text"
                      value={pool.name}
                      onChange={(e) => {
                        const newConfig = [...poolConfig];
                        newConfig[index].name = e.target.value;
                        setPoolConfig(newConfig);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Trainer
                    </label>
                    <select
                      value={pool.trainerId}
                      onChange={(e) => {
                        const selectedTrainer = event.trainers.find(t => t.id === e.target.value);
                        const newConfig = [...poolConfig];
                        newConfig[index].trainerId = e.target.value;
                        newConfig[index].trainerName = selectedTrainer.name;
                        setPoolConfig(newConfig);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {event.trainers.map(trainer => (
                        <option key={trainer.id} value={trainer.id}>
                          {trainer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Capacity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={pool.capacity}
                      onChange={(e) => handlePoolCapacityChange(pool.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Meet Link
                    </label>
                    <input
                      type="url"
                      value={pool.meetLink}
                      onChange={(e) => handleMeetLinkChange(pool.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="https://meet.google.com/..."
                    />
                  </div>
                </div>
                
                <div className="mt-3">
                  <h4 className="text-sm font-medium mb-2">
                    Attendees ({pool.attendees ? pool.attendees.length : 0}/{pool.capacity})
                  </h4>
                  {pool.attendees && pool.attendees.length > 0 ? (
                    <div className="bg-gray-50 p-3 rounded-md max-h-40 overflow-y-auto">
                      <ul className="divide-y divide-gray-200">
                        {pool.attendees.map(user => (
                          <li key={user.id} className="py-2 text-sm">
                            <div className="flex justify-between">
                              <div>
                                <span className="font-medium">{user.userName}</span>
                                <span className="text-gray-500 ml-2">{user.mobileNumber || user.email}</span>
                              </div>
                              {user.registrationDate && (
                                <span className="text-gray-500 text-xs">
                                  Registered: {format(new Date(user.registrationDate), 'MMM dd, yyyy')}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 italic">
                      No attendees assigned. Use "Auto-Distribute Users" to assign users.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className={`px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors ${
                submitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {submitting ? 'Saving...' : 'Save Pool Assignments'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}