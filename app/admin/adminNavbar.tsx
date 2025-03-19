// components/admin/AdminNavbar.jsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminNavbar() {
  const pathname = usePathname();
  
  const navItems = [
    { name: 'Dashboard', path: '/admin' },
    { name: 'Events', path: '/admin/events' },
    { name: 'Trainers', path: '/admin/trainers' },
    { name: 'Users', path: '/admin/users' },
  ];

  return (
    <nav className="bg-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex-shrink-0 flex items-center">
            <span className="text-xl font-bold text-indigo-600">Event Admin</span>
          </div>
          
          <div className="hidden md:block">
            <div className="flex items-center space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === item.path
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-700 hover:bg-indigo-100'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}