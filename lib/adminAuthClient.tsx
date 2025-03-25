// lib/adminAuthClient.js
'use client'

import { useState, useEffect, createContext, useContext } from 'react'

// Create a context for authentication state
const AdminAuthContext = createContext(null)

/**
 * Store the admin authentication token
 * @param {string} token - JWT token
 */
export function setAdminToken(token) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('adminToken', token)
  }
}

/**
 * Retrieve the admin authentication token
 * @returns {string|null} - JWT token or null if not found
 */
export function getAdminToken() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('adminToken')
  }
  return null
}

/**
 * Remove the admin authentication token (logout)
 */
export function clearAdminToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('adminToken')
  }
}

/**
 * Check if the admin is authenticated
 * @returns {boolean} - True if authenticated
 */
export function isAdminAuthenticated() {
  return !!getAdminToken()
}

/**
 * Make an authenticated admin API request
 * @param {string} url - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise} - Fetch response
 */
export async function fetchWithAdminAuth(url, options = {}) {
  const token = getAdminToken()

  // Add auth headers if token exists
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  }

  // Make the request
  const response = await fetch(url, {
    ...options,
    headers,
  })

  // Handle authentication errors
  if (response.status === 401) {
    // Token expired or invalid
    clearAdminToken()
    // If window is defined, redirect to admin login
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/login'
    }
  }

  return response
}

/**
 * Login the admin user
 * @param {string} username - Admin username
 * @param {string} password - Admin password
 * @returns {Promise<{success: boolean, error?: string}>} - Login result
 */
export async function loginAdmin(username, password) {
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Login failed',
      }
    }

    // Store the token
    setAdminToken(data.token)

    return {
      success: true,
    }
  } catch (error) {
    console.error('Login error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

/**
 * Logout the admin user
 */
export function logoutAdmin() {
  clearAdminToken()
  // Redirect to login page if in browser
  if (typeof window !== 'undefined') {
    window.location.href = '/admin/login'
  }
}

/**
 * Admin authentication provider component
 */
export function AdminAuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check authentication status
    setIsAuthenticated(isAdminAuthenticated())
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    const result = await loginAdmin(username, password)
    if (result.success) {
      setIsAuthenticated(true)
    }
    return result
  }

  const logout = () => {
    logoutAdmin()
    setIsAuthenticated(false)
  }

  return (
    <AdminAuthContext.Provider
      value={{ isAuthenticated, loading, login, logout }}
    >
      {children}
    </AdminAuthContext.Provider>
  )
}

/**
 * Hook to use admin authentication
 */
export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  }
  return context
}
