// app/admin/users/page.js
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';

interface User {
  id: string;
  name: string;
  email: string;
  city?: string;
  gender?: string;
  mobileNumber: string;
  createdAt: string;
  _count: {
    registeredEvents: number;
    completedEvents: number;
  };
  registeredEvents?: { event?: { title?: string } }[];
  completedEvents?: { event?: { title?: string } }[];
  yearOfBirth?: string;
}

interface PaginationData {
  total: number;
  pages: number;
  currentPage: number;
}

export default function UsersListPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    pages: 0,
    currentPage: 1
  });

  const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        
        const response = await fetch(`/api/users?page=${pagination.currentPage}`, {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
          },
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch users');
        }
        
        const data = await response.json();
        setUsers(data.users);
        setPagination(data.pagination);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, [API_KEY, pagination.currentPage]);

  // Filter users based on search term
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.mobileNumber.includes(searchTerm) ||
    (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.city && user.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Handle view user details
  const handleViewUser = (userId: string) => {
    router.push(`/admin/users/${userId}`);
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      setPagination(prev => ({ ...prev, currentPage: newPage }));
    }
  };

  // Fetch all users for export
  const fetchAllUsers = async (): Promise<User[]> => {
    try {
      // If we've already fetched all users, return them
      if (allUsers.length > 0) {
        return allUsers;
      }

      const response = await fetch('/api/users?export=true&includeEvents=true', {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users for export');
      }
      
      const data = await response.json();
      setAllUsers(data.users);
      return data.users;
    } catch (error) {
      console.error('Error fetching all users:', error);
      throw error;
    }
  };

  // Handle export to Excel
  const handleExport = async () => {
    try {
      setExportLoading(true);
      
      // Fetch all users for export
      const usersToExport = await fetchAllUsers();
      
      // Format data for Excel
      const workbookData = usersToExport.map(user => {
        // Get registered event names
        const registeredEvents = user.registeredEvents || [];
        const registeredEventNames = registeredEvents.map(reg => 
          reg.event?.title || 'Unknown Event'
        ).join(', ');
        
        // Get completed event names
        // const completedEvents = user.completedEvents || [];
        // const completedEventNames = completedEvents.map(comp => 
        //   comp.event?.title || 'Unknown Event'
        // ).join(', ');
        
        return {
          ID: user.id,
          Name: user.name,
          Email: user.email || 'Not provided',
          Mobile: user.mobileNumber,
          State: user.city || 'Not provided',
          Gender: user.gender || 'Not provided',
          'Year of Birth': user.yearOfBirth || 'Not provided',
          'Registration Date': new Date(user.createdAt).toLocaleDateString(),
          'Number of Registrations': user._count.registeredEvents,
          'Registered Events': registeredEventNames || 'None',
        };
      });
      
      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(workbookData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
      
      // Generate Excel file
      XLSX.writeFile(workbook, `users_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Error exporting users:', error);
      alert('Failed to export users. Please try again.');
    } finally {
      setExportLoading(false);
    }
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

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="flex space-x-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            )}
          </div>
          <button
            onClick={handleExport}
            disabled={exportLoading}
            className={`px-4 py-2 rounded-lg ${
              exportLoading 
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {exportLoading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </span>
            ) : 'Export to Excel'}
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registrations
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registered
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">ID: {user.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.mobileNumber}</div>
                      <div className="text-sm text-gray-500">{user.email || 'No email'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.city || 'Not specified'}</div>
                      <div className="text-sm text-gray-500">{user.gender || 'Not specified'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {user._count.registeredEvents} events
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleViewUser(user.mobileNumber)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    {searchTerm ? 'No users found matching your search.' : 'No users available.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{filteredUsers.length}</span> of{' '}
              <span className="font-medium">{pagination.total}</span> users
            </p>
            
            <div className="flex space-x-2">
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                className={`px-3 py-1 rounded ${
                  pagination.currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                Previous
              </button>
              
              <span className="px-3 py-1 text-sm">
                Page {pagination.currentPage} of {pagination.pages}
              </span>
              
              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.pages}
                className={`px-3 py-1 rounded ${
                  pagination.currentPage === pagination.pages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}