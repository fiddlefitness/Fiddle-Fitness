'use client'
// app/admin/layout.js - Admin Panel Layout

import AdminNavbar from './adminNavbar'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { isAdminAuthenticated, clearAdminToken } from '@/lib/adminAuthClient'
import Link from 'next/link'

export default function AdminLayout({ children }) {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Skip auth check for login page
    if (pathname === '/admin/login') {
      setLoading(false)
      return
    }

    // Check if user is authenticated
    const checkAuth = () => {
      const isAuth = isAdminAuthenticated()
      setAuthenticated(isAuth)
      setLoading(false)

      // Redirect to login if not authenticated
      if (!isAuth) {
        router.push('/admin/login')
      }
    }

    checkAuth()
  }, [pathname, router])

  // Handle logout
  const handleLogout = () => {
    clearAdminToken()
    router.push('/admin/login')
  }

  // Show nothing while checking authentication
  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500'></div>
      </div>
    )
  }

  // Login page doesn't need the admin layout
  if (pathname === '/admin/login') {
    return children
  }

  // If not authenticated and not on login page, the useEffect will redirect
  if (!authenticated && pathname !== '/admin/login') {
    return null
  }

  return (
    <div className='min-h-screen bg-gray-100'>
      <AdminNavbar />
      <main className='container mx-auto py-8 px-4'>{children}</main>
    </div>
  )
}
