// app/admin/events/page.js
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('upcoming'); // 'upcoming' or 'all'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEvents();
  }, [filter]);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/events?filter=${filter}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || ''
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch events');
      }
      
      const data = await res.json();
      setEvents(data);
    } catch (error) {
      console.error('Error fetching events:', error);
      setError('Failed to load events. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Events Management</h1>
        <Link 
          href="/admin/events/add" 
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          Add New Event
        </Link>
      </div>
      
      <div className="mb-6">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium border border-r-0 rounded-l-lg ${
              filter === 'upcoming' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => setFilter('upcoming')}
          >
            Upcoming Events
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium border rounded-r-lg ${
              filter === 'all' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => setFilter('all')}
          >
            All Events
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center py-8">
          <p>Loading events...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-6">
          <p>{error}</p>
          <button 
            onClick={fetchEvents}
            className="text-red-700 underline mt-2"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
          
          {events.length === 0 && (
            <div className="col-span-full text-center py-8">
              <p className="text-gray-500">No events found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EventCard({ event }) {
  const isPast = event.isPast;
  const isDeadlinePassed = event.isDeadlinePassed;
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-5">
        <div className="flex justify-between items-start">
          <h3 className="text-xl font-semibold mb-2">{event.title}</h3>
          {isPast && (
            <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded">
              Past Event
            </span>
          )}
          {!isPast && (
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
              Upcoming
            </span>
          )}
        </div>
        
        <p className="text-gray-600 mb-4">{event.description}</p>
        
        <div className="mb-4">
          <div className="flex items-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-gray-700">{format(new Date(event.eventDate), 'MMMM dd, yyyy')}</span>
          </div>
          
          <div className="flex items-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-gray-700">{event.eventTime}</span>
          </div>
          <div className="flex items-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span className="text-gray-700">{event.category}</span>
          </div>
          
          
          <div className="flex items-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="text-gray-700">
              Capacity: {event.registeredUsers}/{event.maxCapacity}
            </span>
          </div>
          
          {event.registrationDeadline && (
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className={`${isDeadlinePassed ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                Registration Deadline: {format(new Date(event.registrationDeadline), 'MMMM dd, yyyy')}
              </span>
            </div>
          )}
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-gray-600 mb-1">Trainers:</h4>
            <div className="flex flex-wrap gap-1">
              {event.trainers.map(trainer => (
                <span key={trainer.id} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                  {trainer.name}
                </span>
              ))}
            </div>
          </div>
          
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-gray-600 mb-1">Pool Assignment Status:</h4>
            {event.poolsAssigned ? (
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                Pools Assigned
              </span>
            ) : isDeadlinePassed ? (
              <div className="flex space-x-2 items-center">
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                  Pending Assignment
                </span>
                <Link 
                  href={`/admin/events/${event.id}/assign-pools`}
                  className="text-indigo-600 text-xs hover:text-indigo-800"
                >
                  Assign Pools
                </Link>
              </div>
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                Registration Open
              </span>
            )}
          </div>
          
          {event.poolsAssigned && event.pools && event.pools.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-600 mb-1">Pools:</h4>
              <div className="space-y-1">
                {event.pools.map(pool => (
                  <div key={pool.id} className="px-2 py-1 bg-purple-50 rounded text-xs">
                    <span className="font-medium">{pool.name}</span>: {pool.attendees}/{pool.capacity} attendees
                    {pool.trainer && (
                      <span className="ml-1 text-purple-800">
                        (Trainer: {pool.trainer.name})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="mt-4 flex justify-end">
            <Link 
              href={`/admin/events/${event.id}`}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              View Details
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}