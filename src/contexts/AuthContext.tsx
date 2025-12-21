import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase, User } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

type AuthContextType = {
  user: User | null
  loading: boolean
  signIn: (idStaff: string, password: string) => Promise<{ error: string | null }>
  signUp: (idStaff: string, password: string, fullName: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  isSubscriptionExpired: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Session storage key
const SESSION_KEY = 'rvcast_user_session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  // Fetch user profile from public.user table by ID
  const fetchUserProfile = async (userId: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('user')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        return null
      }

      return data as User
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return null
    }
  }

  // Refresh user profile
  const refreshUser = async () => {
    const storedSession = localStorage.getItem(SESSION_KEY)
    if (storedSession) {
      try {
        const { userId } = JSON.parse(storedSession)
        const profile = await fetchUserProfile(userId)
        setUser(profile)
      } catch {
        setUser(null)
      }
    } else {
      setUser(null)
    }
  }

  // Sign in with ID Staff and password
  const signIn = async (idStaff: string, password: string) => {
    try {
      // Look up user by email field (which now stores ID Staff)
      const { data, error } = await supabase
        .from('user')
        .select('*')
        .eq('email', idStaff)
        .single()

      if (error || !data) {
        return { error: 'Invalid ID Staff or password' }
      }

      // Check password
      if (data.password !== password) {
        return { error: 'Invalid ID Staff or password' }
      }

      // Check if user is active
      if (!data.is_active) {
        return { error: 'Your account has been deactivated' }
      }

      // Store session in localStorage
      localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: data.id }))

      // Update last login
      await supabase
        .from('user')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.id)

      setUser(data as User)
      return { error: null }
    } catch (error) {
      console.error('Sign in error:', error)
      return { error: 'Network error. Please try again.' }
    }
  }

  // Sign up with ID Staff
  const signUp = async (idStaff: string, password: string, fullName: string) => {
    try {
      // Check if ID Staff already exists
      const { data: existingUser } = await supabase
        .from('user')
        .select('id')
        .eq('email', idStaff)
        .single()

      if (existingUser) {
        return { error: 'ID Staff already exists' }
      }

      // Calculate subscription end date (1 year from now)
      const subscriptionEnd = new Date()
      subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1)

      // Create new user in public.user table
      const { error } = await supabase
        .from('user')
        .insert({
          email: idStaff, // Using email field to store ID Staff
          full_name: fullName,
          password: password,
          is_active: true,
          status: 'Trial',
          subscription_status: 'active',
          subscription_start: new Date().toISOString(),
          subscription_end: subscriptionEnd.toISOString(),
          max_devices: 10,
          role: 'user',
        })

      if (error) {
        console.error('Sign up error:', error)
        return { error: error.message }
      }

      return { error: null }
    } catch (error) {
      console.error('Sign up error:', error)
      return { error: 'Network error. Please try again.' }
    }
  }

  // Sign out
  const signOut = async () => {
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
    navigate('/')
  }

  // Check if subscription is expired
  const isSubscriptionExpired = (): boolean => {
    if (!user) return false

    // Admin users never expire
    if (user.role === 'admin') return false

    // If no subscription_end date, not expired (lifetime or trial)
    if (!user.subscription_end) return false

    // Check if today is past the subscription_end date
    const today = new Date()
    const endDate = new Date(user.subscription_end)

    // Set both dates to midnight for accurate date comparison
    today.setHours(0, 0, 0, 0)
    endDate.setHours(0, 0, 0, 0)

    return today >= endDate
  }

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const storedSession = localStorage.getItem(SESSION_KEY)
      if (storedSession) {
        try {
          const { userId } = JSON.parse(storedSession)
          const profile = await fetchUserProfile(userId)
          if (profile && profile.is_active) {
            setUser(profile)
          } else {
            // User not found or inactive, clear session
            localStorage.removeItem(SESSION_KEY)
            setUser(null)
          }
        } catch {
          localStorage.removeItem(SESSION_KEY)
          setUser(null)
        }
      }
      setLoading(false)
    }

    initAuth()
  }, [])

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    refreshUser,
    isSubscriptionExpired,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
