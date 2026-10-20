import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowDownToLine, ArrowRight, ArrowUp, ArrowUpRight, Bell, CalendarDays,
  Check, CheckCircle2, ChevronDown, ChevronLeft, Clock, CreditCard, FileText,
  Filter, Heart, LayoutDashboard, LogOut, MapPin, Menu, Plus, QrCode, Search,
  Settings2, ShieldCheck, Sparkles, TrendingUp, Users, X, Upload,
  CircleDollarSign, GraduationCap, ChartNoAxesCombined, ClipboardList, Building2,
  ScanLine, BookOpen, Handshake, UserPlus, Globe, Eye, Trash2,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { completeEsewaEventPayment, hasEsewaConfig, submitEsewaPayment } from './lib/esewa'
import { clubRepository, mockClubRepository } from './services/clubRepository'
import type { ActivityLogEntry, AttendanceRecord, ClubEvent, ClubFile, ClubSnapshot, Donation, EventStatus, Member, Notification, Registration, Role } from './types'
import ImageAccordion from "./components/ImageAccordion/ImageAccordion";
import './App.css'

type Page = 'home' | 'about' | 'events' | 'event-detail' | 'login' | 'register' | 'dashboard' | 'manage-events' | 'registrations' | 'attendance' | 'files' | 'donations' | 'users' | 'reports' | 'leaderboard' | 'notifications' | 'activity' | 'profile'
type EventForm = Omit<ClubEvent, 'id'>
type AuthFeedback = { kind: 'success' | 'error'; message: string } | null
type AuthProfile = { id: string; full_name: string; email: string | null; role: string; created_at: string; photo_path: string | null; photoUrl: string | null }
type SpreadsheetSheet = { name: string; rows: string[][]; truncated: boolean }
const privatePages = new Set<Page>(['dashboard', 'manage-events', 'registrations', 'attendance', 'files', 'donations', 'users', 'reports', 'leaderboard', 'notifications', 'activity', 'profile'])

const todayDate = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

const blankEvent: EventForm = {
  title: '', description: '', date: todayDate(), startTime: '10:00', endTime: '13:00',
  location: 'KIST College of Management', category: 'Workshop', image: '',
  maxParticipants: 50, registrationDeadline: todayDate(), status: 'Draft',
  isPaid: false, price: undefined,
}
const pageTitles: Record<Page, string> = {
  home: 'Welcome to BIM Club', about: 'About the club', events: 'Events', 'event-detail': 'Event details',
  login: 'Welcome back', register: 'Join the club', dashboard: 'Overview', 'manage-events': 'Manage events',
  registrations: 'Registrations', attendance: 'Attendance', files: 'Club files', donations: 'Donations',
  users: 'Members & users', reports: 'Reports', leaderboard: 'Leaderboard', notifications: 'Notifications', activity: 'Activity log', profile: 'My profile',
}
const bodMembers: { name: string; position: string; image: string }[] = []
const homeHeroCards = [
  { title: 'Technology', image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=640&q=85', alt: 'Laptop and technology workspace' },
  { title: 'Innovation', image: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=640&q=85', alt: 'Creative design work in progress' },
  { title: 'Workshops', image: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=640&q=85', alt: 'Students learning together' },
  { title: 'Events', image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=640&q=85', alt: 'People collaborating at a technology event' },
  { title: 'Community', image: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=640&q=85', alt: 'Students sharing ideas around a table' },
]
const navigation: Record<Role, { label: string; page: Page; icon: typeof LayoutDashboard }[]> = {
  Admin: [
    { label: 'Overview', page: 'dashboard', icon: LayoutDashboard }, { label: 'Events', page: 'manage-events', icon: CalendarDays },
    { label: 'Members', page: 'users', icon: Users }, { label: 'Attendance', page: 'attendance', icon: CheckCircle2 },
    { label: 'Donations', page: 'donations', icon: Heart }, { label: 'Club files', page: 'files', icon: FileText },
    { label: 'Reports', page: 'reports', icon: ChartNoAxesCombined }, { label: 'Activity log', page: 'activity', icon: Activity },
  ],
  BOD: [
    { label: 'Overview', page: 'dashboard', icon: LayoutDashboard }, { label: 'Manage events', page: 'manage-events', icon: CalendarDays },
    { label: 'Registrations', page: 'registrations', icon: ClipboardList }, { label: 'Attendance', page: 'attendance', icon: CheckCircle2 },
    { label: 'Scan QR', page: 'attendance', icon: ScanLine }, { label: 'Club files', page: 'files', icon: FileText },
  ],
  Participant: [
    { label: 'Overview', page: 'dashboard', icon: LayoutDashboard }, { label: 'Explore events', page: 'events', icon: CalendarDays },
    { label: 'My attendance', page: 'attendance', icon: CheckCircle2 }, { label: 'Donations', page: 'donations', icon: Heart },
    { label: 'Leaderboard', page: 'leaderboard', icon: TrendingUp }, { label: 'Notifications', page: 'notifications', icon: Bell },
  ],
}

const formatDate = (value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) =>
  new Intl.DateTimeFormat('en-US', options).format(new Date(`${value}T12:00:00`))
const formatMoney = (value: number) => `NPR ${value.toLocaleString('en-NP')}`
const describeError = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message
  if (typeof error !== 'object' || error === null) return fallback

  const details = error as Record<string, unknown>
  const message = typeof details.message === 'string' ? details.message : ''
  const code = typeof details.code === 'string' ? ` (${details.code})` : ''
  const detail = typeof details.details === 'string' ? ` ${details.details}` : ''
  const hint = typeof details.hint === 'string' ? ` ${details.hint}` : ''
  return message ? `${message}${code}${detail}${hint}` : fallback
}

function App() {
  const [snapshot, setSnapshot] = useState<ClubSnapshot>(() => mockClubRepository.loadSnapshot() as ClubSnapshot)
  const [page, setPage] = useState<Page>('home')
  const pageHistory = useRef<Page[]>([])
  const [canGoBack, setCanGoBack] = useState(false)
  const [role, setRole] = useState<Role | null>(null)
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [authProfile, setAuthProfile] = useState<AuthProfile | null>(null)
  const [authLoading, setAuthLoading] = useState(Boolean(supabase))
  const [authBusy, setAuthBusy] = useState(false)
  const [authFeedback, setAuthFeedback] = useState<AuthFeedback>(null)
  const profileRequest = useRef(0)
  const eventsRequest = useRef(0)
  const notificationRequest = useRef(0)
  const [events, setEvents] = useState(snapshot.events)
  const [eventsLoading, setEventsLoading] = useState(Boolean(supabase))
  const [eventsError, setEventsError] = useState('')
  const [eventMutationError, setEventMutationError] = useState('')
  const [eventSaving, setEventSaving] = useState(false)
  const [registrations, setRegistrations] = useState(snapshot.registrations)
  const [donations, setDonations] = useState(snapshot.donations)
  const [members, setMembers] = useState(snapshot.members)
  const [attendance, setAttendance] = useState(snapshot.attendance)
  const [files, setFiles] = useState(snapshot.files)
  const [notifications, setNotifications] = useState(snapshot.notifications)
  const [notificationError, setNotificationError] = useState('')
  const [notificationLiveError, setNotificationLiveError] = useState('')
  const [liveDataError, setLiveDataError] = useState('')
  const [profilePhotoBusy, setProfilePhotoBusy] = useState(false)
  const [profilePhotoError, setProfilePhotoError] = useState('')
  const [activityLog, setActivityLog] = useState(snapshot.activityLog)

  const applySnapshot = (nextSnapshot: ClubSnapshot) => {
    setSnapshot(nextSnapshot)
    setEvents(nextSnapshot.events)
    setRegistrations(nextSnapshot.registrations)
    setDonations(nextSnapshot.donations)
    setMembers(nextSnapshot.members)
    setAttendance(nextSnapshot.attendance)
    setFiles(nextSnapshot.files)
    setNotifications(nextSnapshot.notifications)
    setActivityLog(nextSnapshot.activityLog)
  }
  const refreshSnapshot = async () => {
    const nextSnapshot = await clubRepository.loadSnapshot()
    eventsRequest.current += 1
    applySnapshot(nextSnapshot)
    setEventsError('')
    setEventsLoading(false)
    setLiveDataError('')
  }

  const loadEvents = useCallback(async () => {
    const requestId = ++eventsRequest.current
    try {
      const nextEvents = await clubRepository.loadEvents()
      if (requestId === eventsRequest.current) {
        setEvents(nextEvents)
        setEventsError('')
      }
    } catch (error) {
      if (requestId === eventsRequest.current) {
        setEvents([])
        setEventsError(error instanceof Error ? error.message : 'Unable to load events.')
      }
    } finally {
      if (requestId === eventsRequest.current) setEventsLoading(false)
    }
  }, [])
  const retryEvents = () => {
    setEventsLoading(true)
    setEventsError('')
    void loadEvents()
  }

  useEffect(() => {
    if (supabase) return
    let isMounted = true
    void Promise.resolve(clubRepository.loadSnapshot()).then((nextSnapshot) => {
      if (isMounted) applySnapshot(nextSnapshot)
    }).catch((error: unknown) => {
      if (isMounted) setAuthFeedback({
        kind: 'error',
        message: error instanceof Error ? `Unable to load club data: ${error.message}` : 'Unable to load club data.',
      })
    })
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    void Promise.resolve().then(loadEvents)
  }, [loadEvents])
  useEffect(() => {
    const client = supabase
    if (!client) return

    let refreshTimer: number | undefined
    const channel = client
      .channel('public-events-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
        refreshTimer = window.setTimeout(() => { void loadEvents() }, 150)
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setLiveDataError('Live event updates are unavailable. Check the Supabase Realtime setup.')
        }
      })

    return () => {
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
      void client.removeChannel(channel)
    }
  }, [loadEvents])
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All categories')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [eventModal, setEventModal] = useState(false)
  const [donationModal, setDonationModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<ClubEvent | null>(null)
  const [eventForm, setEventForm] = useState<EventForm>(blankEvent)
  const [scannerOpen, setScannerOpen] = useState(false)
  const handledEventPayment = useRef(false)
  const donationRole = role ?? 'Participant'

  const fallbackMember = snapshot.members[0]
  const currentMember: Member = authProfile
    ? {
        id: authProfile.id,
        name: authProfile.full_name,
        email: authUser?.email ?? authProfile.email ?? '',
        role: role ?? 'Participant',
        joined: authProfile.created_at.slice(0, 10),
        points: members.find((member) => member.id === authProfile.id)?.points ?? 0,
      }
    : fallbackMember
  const myRegistrations = registrations.filter((registration) => registration.memberId === currentMember.id && registration.status !== 'Cancelled')
  const selectedEvent = events.find((event) => event.id === selectedId)
  const filteredEvents = useMemo(() => events.filter((event) => {
    const textMatch = `${event.title} ${event.location} ${event.category}`.toLowerCase().includes(search.toLowerCase())
    return textMatch && (category === 'All categories' || category === event.category) && (statusFilter === 'All statuses' || statusFilter === event.status)
  }), [events, search, category, statusFilter])

  const syncAuthSession = async (session: Session | null): Promise<boolean> => {
    const requestId = ++profileRequest.current
    if (!session) {
      setAuthUser(null)
      setAuthProfile(null)
      setRole(null)
      setAuthLoading(false)
      setPage((currentPage) => privatePages.has(currentPage) ? 'login' : currentPage)
      return true
    }

    setAuthUser(session.user)
    setAuthLoading(true)
    const { data, error } = await supabase!
      .from('profiles')
      .select('id, full_name, email, role, created_at, photo_path')
      .eq('id', session.user.id)
      .single()

    if (requestId !== profileRequest.current) return false
    if (error) {
      setAuthProfile(null)
      setRole(null)
      setAuthLoading(false)
      setAuthFeedback({ kind: 'error', message: `Signed in, but your profile could not be loaded: ${error.message}` })
      setPage((currentPage) => privatePages.has(currentPage) ? 'login' : currentPage)
      return false
    }

    let photoUrl: string | null = null
    try {
      photoUrl = await clubRepository.loadProfilePhoto(data.photo_path)
    } catch (photoError) {
      const message = photoError instanceof Error ? `Your profile loaded, but its photo could not be loaded: ${photoError.message}` : 'Your profile photo could not be loaded.'
      setToast(message)
      window.setTimeout(() => setToast(''), 3000)
    }
    if (requestId !== profileRequest.current) return false
    const profile = { ...data, photoUrl } as AuthProfile
    setAuthProfile(profile)
    setRole(profile.role === 'admin' ? 'Admin' : profile.role === 'bod' ? 'BOD' : 'Participant')
    setAuthLoading(false)
    try {
      await refreshSnapshot()
    } catch (refreshError) {
      const message = refreshError instanceof Error ? `Signed in, but club data could not be loaded: ${refreshError.message}` : 'Signed in, but club data could not be loaded.'
      setAuthFeedback({
        kind: 'error',
        message,
      })
      setToast(message)
      window.setTimeout(() => setToast(''), 3000)
    }
    return true
  }

  useEffect(() => {
    if (!supabase) return

    let isMounted = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') return
      window.setTimeout(() => {
        if (!isMounted) return
        void syncAuthSession(session).catch((error: unknown) => {
          if (!isMounted) return
          setAuthLoading(false)
          setAuthFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Unable to restore your session.' })
        })
      }, 0)
    })

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return
      if (error) {
        setAuthLoading(false)
        setAuthFeedback({ kind: 'error', message: `Unable to restore your session: ${error.message}` })
        return
      }
      return syncAuthSession(data.session)
    }).catch((error: unknown) => {
      if (!isMounted) return
      setAuthLoading(false)
      setAuthFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Unable to restore your session.' })
    })

    return () => {
      isMounted = false
      profileRequest.current += 1
      subscription.unsubscribe()
    }
  }, [])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3000)
  }
  const addActivity = (user: string, action: string) => setActivityLog((items) => [{ id: `log-${Date.now()}`, user, action, timestamp: 'Just now' }, ...items])
  const addNotification = (item: Omit<Notification, 'id' | 'read'>) => setNotifications((items) => [{ ...item, id: `note-${Date.now()}`, read: false }, ...items])
  const refreshNotifications = useCallback(async () => {
    const profileId = authProfile?.id
    if (!profileId || !role) return
    const requestId = ++notificationRequest.current
    try {
      const nextNotifications = await clubRepository.loadNotifications(profileId, role)
      if (requestId === notificationRequest.current) {
        setNotifications(nextNotifications)
        setNotificationError('')
      }
    } catch (error) {
      if (requestId === notificationRequest.current) {
        setNotificationError(error instanceof Error ? error.message : 'Unable to load notifications.')
      }
    }
  }, [authProfile?.id, role])
  const markNotificationsRead = async () => {
    const visible = notifications.filter((item) => item.recipient === 'All' || item.recipient === role)
    try {
      await Promise.all(visible.filter((item) => !item.read).map((item) => clubRepository.markNotificationRead(item.id, currentMember.id)))
      setNotifications((items) => items.map((item) => visible.includes(item) ? { ...item, read: true } : item))
      setNotificationError('')
    } catch (error) {
      const message = error instanceof Error ? `Could not mark notifications as read: ${error.message}` : 'Could not mark notifications as read.'
      setNotificationError(message)
    }
  }
  const uploadProfilePhoto = async (file: File) => {
    setProfilePhotoBusy(true)
    setProfilePhotoError('')
    try {
      const photo = await clubRepository.uploadProfilePhoto(currentMember.id, file)
      setAuthProfile((profile) => profile ? { ...profile, photo_path: photo.path, photoUrl: photo.url } : profile)
      notify('Profile photo updated')
    } catch (error) {
      setProfilePhotoError(error instanceof Error ? error.message : 'Could not upload profile photo.')
    } finally {
      setProfilePhotoBusy(false)
    }
  }
  const openNotification = async (item: Notification) => {
    if (!item.read) {
      try {
        await clubRepository.markNotificationRead(item.id, currentMember.id)
        setNotifications((items) => items.map((notification) => notification.id === item.id ? { ...notification, read: true } : notification))
        setNotificationError('')
      } catch (error) {
        setNotificationError(error instanceof Error ? `Could not mark notification as read: ${error.message}` : 'Could not mark notification as read.')
      }
    }
    setNotificationOpen(false)
    navigate('notifications')
  }
  const notificationMemberId = authProfile?.id
  useEffect(() => {
    const client = supabase
    if (!client || !notificationMemberId || !role) return

    let refreshTimer: number | undefined
    const refreshLiveData = () => {
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        void refreshSnapshot().catch((error: unknown) => {
          setLiveDataError(error instanceof Error ? error.message : 'Unable to refresh club data.')
        })
        void refreshNotifications()
      }, 150)
    }
    const initialLoad = window.setTimeout(() => {
      void refreshSnapshot().catch((error: unknown) => {
        setLiveDataError(error instanceof Error ? error.message : 'Unable to load club data.')
      })
      void refreshNotifications()
    }, 0)
    const channel = client
      .channel(`member-notifications-${notificationMemberId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
      }, () => { void refreshNotifications() })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notification_reads',
        filter: `member_id=eq.${notificationMemberId}`,
      }, () => { void refreshNotifications() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, refreshLiveData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, refreshLiveData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_registrations' }, refreshLiveData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, refreshLiveData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, refreshLiveData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, refreshLiveData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, refreshLiveData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'point_transactions' }, refreshLiveData)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setNotificationLiveError('Live club updates are unavailable. Check the Supabase Realtime setup.')
        } else if (status === 'SUBSCRIBED') {
          setNotificationLiveError('')
        }
      })

    return () => {
      window.clearTimeout(initialLoad)
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
      notificationRequest.current += 1
      void client.removeChannel(channel)
    }
  }, [notificationMemberId, role, refreshNotifications])

  const profilePhotoPath = authProfile?.photo_path
  useEffect(() => {
    if (!profilePhotoPath) return
    const refreshPhotoUrl = () => {
      void clubRepository.loadProfilePhoto(profilePhotoPath).then((photoUrl) => {
        setAuthProfile((profile) => profile ? { ...profile, photoUrl } : profile)
      }).catch((error: unknown) => {
        const message = error instanceof Error ? `Could not refresh profile photo: ${error.message}` : 'Could not refresh profile photo.'
        setToast(message)
        window.setTimeout(() => setToast(''), 3000)
      })
    }
    const interval = window.setInterval(refreshPhotoUrl, 50 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [profilePhotoPath])
  const navigate = (target: Page) => {
    let nextPage = target
    if (privatePages.has(target) && (!authUser || !role)) {
      if (authLoading) {
        nextPage = target
      } else {
        nextPage = 'login'
        setAuthFeedback({ kind: 'error', message: 'Please sign in to access your BIM Club workspace.' })
      }
    }
    if (nextPage !== page) {
      pageHistory.current.push(page)
      setCanGoBack(true)
      setPage(nextPage)
    }
    setMenuOpen(false)
    setNotificationOpen(false)
    setProfileOpen(false)
  }
  const goBack = () => {
    let previousPage = pageHistory.current.pop()
    while (previousPage && privatePages.has(previousPage) && (!authUser || !role)) {
      previousPage = pageHistory.current.pop()
    }
    setCanGoBack(pageHistory.current.length > 0)
    setPage(previousPage ?? (role ? 'dashboard' : 'home'))
    setMenuOpen(false)
    setNotificationOpen(false)
    setProfileOpen(false)
  }

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !password.trim()) {
      setAuthFeedback({ kind: 'error', message: 'Enter your email and password to sign in.' })
      return
    }

    if (!supabase) {
      setAuthFeedback({ kind: 'error', message: 'Supabase is not configured. Add the project environment variables to sign in.' })
      return
    }

    setAuthBusy(true)
    setAuthFeedback(null)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
      if (error) {
        setAuthFeedback({ kind: 'error', message: error.message })
        return
      }
      const profileReady = await syncAuthSession(data.session)
      if (profileReady) {
        setAuthFeedback({ kind: 'success', message: 'You are signed in.' })
        notify('You are signed in.')
        setPage('dashboard')
      }
    } catch (error) {
      setAuthFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Sign in failed. Please try again.' })
    } finally {
      setAuthBusy(false)
    }
  }

  const signUp = async (fullName: string, email: string, password: string) => {
    if (!fullName.trim()) {
      setAuthFeedback({ kind: 'error', message: 'Enter your full name to create an account.' })
      return
    }

    if (!supabase) {
      setAuthFeedback({ kind: 'error', message: 'Supabase is not configured. Add the project environment variables to create an account.' })
      return
    }

    setAuthBusy(true)
    setAuthFeedback(null)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      })
      if (error) {
        setAuthFeedback({ kind: 'error', message: error.message })
        return
      }
      if (data.session) {
        const profileReady = await syncAuthSession(data.session)
        if (profileReady) {
          setAuthFeedback({ kind: 'success', message: 'Your account is ready and you are signed in.' })
          notify('Your account is ready.')
          setPage('dashboard')
        }
      } else {
        setAuthFeedback({ kind: 'success', message: 'Your account was created. Check your email for a confirmation link, then sign in.' })
        navigate('login')
      }
    } catch (error) {
      setAuthFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Registration failed. Please try again.' })
    } finally {
      setAuthBusy(false)
    }
  }

  const signOut = async () => {
    if (!supabase) {
      setAuthUser(null)
      setAuthProfile(null)
      setRole(null)
      setAuthFeedback({ kind: 'success', message: 'You have been signed out.' })
      notify('You have been signed out.')
      setPage('home')
      return
    }
    setAuthBusy(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        setAuthFeedback({ kind: 'error', message: error.message })
        notify(error.message)
        return
      }
      await syncAuthSession(null)
      setAuthFeedback({ kind: 'success', message: 'You have been signed out.' })
      notify('You have been signed out.')
      navigate('home')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed. Please try again.'
      setAuthFeedback({ kind: 'error', message })
      notify(message)
    } finally {
      setAuthBusy(false)
    }
  }
  const openEvent = (id: string) => {
    setSelectedId(id)
    navigate('event-detail')
  }
  const previewClubFile = (file: ClubFile) => clubRepository.downloadClubFile(file)
  const downloadClubFile = async (file: ClubFile) => {
    const blob = await clubRepository.downloadClubFile(file)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const startEventEditor = (event?: ClubEvent) => {
    setEventMutationError('')
    setEditingEvent(event ?? null)
    setEventForm(event ? { ...event } : blankEvent)
    setEventModal(true)
  }
  const announcePublishedEvent = async (event: ClubEvent): Promise<string | null> => {
    try {
      const notification = await clubRepository.createNotification({
        title: `New event: ${event.title}`,
        detail: `${formatDate(event.date)} · ${event.location}`,
        recipient: 'All',
      }, currentMember.id)
      setNotifications((items) => [notification, ...items])
      return null
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Notification could not be created.'
      setNotificationError(message)
      return message
    }
  }
  const saveEvent = async (form: EventForm) => {
    if (!form.title.trim()) return notify('Add an event title before saving')
    if (!form.date || !form.registrationDeadline || form.registrationDeadline > form.date) {
      const message = 'The registration deadline must be on or before the event date.'
      setEventMutationError(message)
      notify(message)
      return
    }
    if (!form.startTime || !form.endTime || form.endTime <= form.startTime) {
      const message = 'The event end time must be later than its start time.'
      setEventMutationError(message)
      notify(message)
      return
    }
    if (!form.location.trim() || !Number.isInteger(form.maxParticipants) || form.maxParticipants < 1) {
      const message = 'Enter a location and a whole-number participant capacity greater than zero.'
      setEventMutationError(message)
      notify(message)
      return
    }
    if (form.isPaid && (!Number.isFinite(form.price) || Number(form.price) <= 0)) {
      const message = 'Enter a valid positive registration fee for this paid event.'
      setEventMutationError(message)
      notify(message)
      return
    }
    setEventSaving(true)
    setEventMutationError('')
    try {
      let savedEvent: ClubEvent
      let created = false
      if (editingEvent) {
        savedEvent = await clubRepository.updateEvent(editingEvent.id, {
          ...form,
          image: form.image || editingEvent.image,
        })
        setEvents((items) => items.map((item) => item.id === savedEvent.id ? savedEvent : item))
      } else {
        created = true
        savedEvent = await clubRepository.createEvent({
          ...form,
          image: form.image || snapshot.events[0]?.image || '',
        })
        setEvents((items) => [savedEvent, ...items])
      }
      const notificationIssue = savedEvent.status === 'Published' && (created || editingEvent?.status !== 'Published')
        ? await announcePublishedEvent(savedEvent)
        : null
      setEventModal(false)
      setEditingEvent(null)
      notify(notificationIssue
        ? `Event saved, but its notification failed: ${notificationIssue}`
        : created ? 'Event created' : 'Event changes saved')
    } catch (error) {
      const message = describeError(error, 'Could not save the event.')
      setEventMutationError(message)
      notify(`Event was not saved: ${message}`)
    } finally {
      setEventSaving(false)
    }
  }
  const setEventStatus = async (id: string, status: EventStatus) => {
    const event = events.find((item) => item.id === id)
    if (!event) {
      notify('The event could not be found. Refresh the events list and try again.')
      return
    }
    try {
      const savedEvent = await clubRepository.updateEventStatus(event, status)
      setEvents((items) => items.map((item) => item.id === savedEvent.id ? savedEvent : item))
      setEventMutationError('')
      if (status === 'Published' && event.status !== 'Published') {
        const notificationIssue = await announcePublishedEvent(savedEvent)
        notify(notificationIssue
          ? `Event published, but its notification failed: ${notificationIssue}`
          : 'Event published and members notified')
      } else {
        notify(`Event marked ${status.toLowerCase()}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update the event status.'
      setEventMutationError(message)
      notify(`Event status was not saved: ${message}`)
    }
  }
  const deleteEvent = async (event: ClubEvent) => {
    if (role !== 'Admin') return
    try {
      await clubRepository.deleteEvent(event.id, role)
      setEvents((items) => items.filter((item) => item.id !== event.id))
      setSnapshot((current) => ({ ...current, events: current.events.filter((item) => item.id !== event.id) }))
      try {
        await refreshSnapshot()
      } catch (error) {
        notify(`Event deleted, but club data could not be refreshed: ${describeError(error, 'Unknown refresh error.')}`)
        return
      }
      notify('Event deleted')
    } catch (error) {
      const message = describeError(error, 'Could not delete the event.')
      setEventMutationError(message)
      notify(`Event was not deleted: ${message}`)
    }
  }
  const register = async (event: ClubEvent) => {
    if (!authUser) {
      navigate('login')
      setAuthFeedback({ kind: 'error', message: 'Sign in to register for an event.' })
      return
    }
    const count = registrations.filter((item) => item.eventId === event.id && item.status !== 'Cancelled').length
    if (event.status !== 'Registration Open' || count >= event.maxParticipants || event.registrationDeadline < todayDate() || event.date < todayDate()) return notify('Registration is closed or this event is full')
    if (myRegistrations.some((item) => item.eventId === event.id)) return notify('You are already registered for this event')
    try {
      if (event.isPaid) {
        if (!event.price || event.price <= 0) throw new Error('This paid event does not have a valid registration price. Contact the event organizer.')
        if (!supabase || !hasEsewaConfig) throw new Error('eSewa payments are not configured. Please contact the event organizer.')
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        if (!session?.access_token) throw new Error('Your session expired. Sign in again before paying for this event.')
        const callbackBase = `${window.location.origin}/?event_payment=`
        await submitEsewaPayment({
          amount: event.price,
          purpose: `Event registration: ${event.title}`,
          donorName: currentMember.name,
          eventId: event.id,
          accessToken: session.access_token,
          successUrl: `${callbackBase}success&event_id=${encodeURIComponent(event.id)}`,
          failureUrl: `${callbackBase}failed&event_id=${encodeURIComponent(event.id)}`,
        })
        return
      }
      const registration = await clubRepository.registerForEvent(event, currentMember)
      setRegistrations((items) => [registration, ...items])
      if (supabase) {
        try {
          await refreshSnapshot()
        } catch (error) {
          notify(`Registration saved, but club data could not be refreshed: ${error instanceof Error ? error.message : 'unknown error'}`)
          return
        }
      } else {
        addNotification({ title: 'Event registration successful', detail: `You are registered for ${event.title}.`, timestamp: 'Just now', recipient: 'Participant' })
        addActivity(currentMember.name, `Participant registered for ${event.title}`)
      }
      notify(`You're registered for ${event.title}`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Event registration failed. Please try again.')
    }
  }
  useEffect(() => {
    const rawSearch = window.location.search
    if (!rawSearch || authLoading || handledEventPayment.current) return

    const parameters = new URLSearchParams(rawSearch)
    const paymentState = (parameters.get('event_payment') ?? parameters.get('payment') ?? rawSearch.match(/[?&](?:event_payment|payment)=([^?&]+)/)?.[1] ?? '').trim().toLowerCase()
    const eventId = (parameters.get('event_id') ?? rawSearch.match(/[?&]event_id=([^?&]+)/)?.[1] ?? '').trim()
    const encodedData = parameters.get('data') ?? ''
    const paymentData = encodedData.replace(/ /g, '+')

    if (!paymentState && !encodedData) return

    if (paymentState && paymentState !== 'success') {
      handledEventPayment.current = true
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
      window.setTimeout(() => notify('eSewa payment was cancelled or not completed. You have not been registered.'), 0)
      return
    }
    if (!authUser || !supabase) {
      window.setTimeout(() => notify('Sign in with the same account to confirm your event payment. Your payment confirmation is being kept for after sign-in.'), 0)
      return
    }
    handledEventPayment.current = true
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
    if (!paymentData) {
      window.setTimeout(() => notify('eSewa returned without payment confirmation. Your registration was not completed.'), 0)
      return
    }

    void (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        if (!session?.access_token) throw new Error('Your session expired. Sign in again to confirm this payment.')
        const result = await completeEsewaEventPayment(paymentData, session.access_token)
        if (eventId && result.eventId !== eventId) throw new Error('The payment confirmation did not match the selected event.')
        await refreshSnapshot()
        setSelectedId(result.eventId)
        setPage('event-detail')
        notify('Payment confirmed and your event registration is complete.')
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Unable to confirm the eSewa payment.')
      }
    })()
  }, [authLoading, authUser])
  const cancelRegistration = async (registrationId: string) => {
    const registration = myRegistrations.find((item) => item.id === registrationId)
    if (!registration || registration.status !== 'Confirmed') {
      notify('Only confirmed registrations can be cancelled')
      return
    }
    try {
      await clubRepository.cancelRegistration(registrationId)
      setRegistrations((items) => items.map((item) => item.id === registrationId ? { ...item, status: 'Cancelled' } : item))
      if (supabase) {
        try {
          await refreshSnapshot()
        } catch (error) {
          notify(`Cancellation saved, but club data could not be refreshed: ${error instanceof Error ? error.message : 'unknown error'}`)
          return
        }
      }
      notify('Registration cancelled')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not cancel this registration.')
    }
  }

  const publicMode = !role
  return <div className="app-shell">
    {publicMode ? <PublicHeader page={page} onNavigate={navigate} onSignIn={() => navigate('login')} /> : <>
      {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <button className="brand brand-sidebar" onClick={() => navigate('dashboard')}><span className="brand-mark"><GraduationCap size={21} /></span><span className="brand-copy"><strong>BIM<span>club</span></strong><small>KIST COLLEGE OF MANAGEMENT</small></span></button>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Dashboard navigation">{navigation[role].map(({ label, page: target, icon: Icon }) => <button key={label} className={`side-link ${page === target ? 'side-link-active' : ''}`} onClick={() => navigate(target)}><Icon size={17} /><span>{label}</span>{label === 'Registrations' && <i className="nav-count">{registrations.filter((item) => item.status !== 'Cancelled').length}</i>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="semester-card"><span className="semester-icon"><Building2 size={15} /></span><div><b>KIST BIM Club</b><small>Live workspace</small></div><ChevronDown size={14} /></div><div className="sidebar-user"><Avatar name={currentMember.name} imageUrl={authProfile?.photoUrl} /><div><b>{currentMember.name}</b><small>{role} account</small></div><button className="icon-button" aria-label="Open profile" onClick={() => navigate('profile')}><Settings2 size={16} /></button></div></div>
      </aside>
      <div className="main-column">
        <header className="app-header"><button className="icon-button mobile-menu-button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={20} /></button><div className="breadcrumb"><button className="icon-button back-button" aria-label="Go back" title="Go back" disabled={!canGoBack} onClick={goBack}><ChevronLeft size={16} /></button><span>Workspace</span><ChevronLeft size={14} /><b>{pageTitles[page]}</b></div><div className="header-actions"><button className="icon-button header-search" aria-label="Search events" onClick={() => { navigate(role === 'Participant' ? 'events' : 'manage-events'); setSearch('') }}><Search size={18} /></button><div className="popover-anchor"><button className="icon-button notification-button" aria-label={`Notifications, ${notifications.filter((item) => !item.read && (item.recipient === 'All' || item.recipient === role)).length} unread`} onClick={() => setNotificationOpen(!notificationOpen)}><Bell size={18} />{notifications.some((item) => !item.read && (item.recipient === 'All' || item.recipient === role)) && <i />}</button>{notificationOpen && <div className="popover notification-popover"><div className="popover-title">Notifications <span>{notifications.filter((item) => !item.read && (item.recipient === 'All' || item.recipient === role)).length} unread</span></div>{notificationError && <p className="notification-error" role="alert">{notificationError}</p>}{notifications.filter((item) => item.recipient === 'All' || item.recipient === role).slice(0, 5).map((item) => <button className={`notification-popover-item ${item.read ? '' : 'notification-popover-unread'}`} key={item.id} onClick={() => void openNotification(item)}><b>{item.title}</b><small>{item.detail} · {item.timestamp}</small></button>)}{notifications.filter((item) => item.recipient === 'All' || item.recipient === role).length === 0 && !notificationError && <p className="notification-empty">No notifications yet.</p>}<button className="notification-view-all" onClick={() => { setNotificationOpen(false); navigate('notifications') }}>View all notifications</button></div>}</div><div className="popover-anchor"><button className="header-profile" onClick={() => setProfileOpen(!profileOpen)}><Avatar name={currentMember.name} imageUrl={authProfile?.photoUrl} /><span>{shortName(role, currentMember)}</span><ChevronDown size={14} /></button>{profileOpen && <div className="popover profile-popover"><div className="popover-title">{role} account</div><button className="signout-option" onClick={() => void signOut()}><LogOut size={14} /> Sign out</button></div>}</div></div></header>
        <main className="page-content">{liveDataError && <div className="event-data-error" role="alert"><span><b>Live club data could not be refreshed.</b><small>{liveDataError}</small></span></div>}<PageHeading page={page} role={role} onCreate={() => startEventEditor()} onNavigate={navigate} />{renderContent()}</main>
      </div>
    </>}
    {publicMode && <main className="public-main">{page !== 'home' && <div className="public-back-row"><button className="icon-button back-button" aria-label="Go back" title="Go back" disabled={!canGoBack} onClick={goBack}><ChevronLeft size={16} /></button></div>}{renderContent()}</main>}
    {eventModal && <EventEditor event={editingEvent} form={eventForm} setForm={setEventForm} saving={eventSaving} error={eventMutationError} onClose={() => setEventModal(false)} onSave={saveEvent} />}
    {donationModal && <DonationEditor
      role={donationRole}
      memberName={currentMember.name}
      onClose={() => setDonationModal(false)}
      onSave={async (donation) => {
        try {
          await clubRepository.createDonation({
            ...donation,
            name: role === 'Participant' ? currentMember.name : donation.name,
          }, currentMember.id, donationRole)
          await refreshSnapshot()
          setDonationModal(false)
          notify(role === 'Participant' ? 'Contribution recorded for confirmation' : 'Donation recorded')
        } catch (error) {
          notify(`Donation was not saved: ${error instanceof Error ? error.message : 'Unable to save donation.'}`)
          throw error
        }
      }}
    />}
    {scannerOpen && <AttendanceScanner
      events={events}
      registrations={registrations.filter((item) => item.status !== 'Cancelled')}
      attendance={attendance}
      onClose={() => setScannerOpen(false)}
      onConfirm={async (registration) => {
        try {
          const record = await clubRepository.recordAttendance(registration, currentMember.name)
          setAttendance((items) => [record, ...items])
          setRegistrations((items) => items.map((item) => item.id === registration.id ? { ...item, status: 'Attended' } : item))
          if (supabase) {
            try {
              await refreshSnapshot()
            } catch (error) {
              setScannerOpen(false)
              notify(`Attendance recorded, but club data could not be refreshed: ${error instanceof Error ? error.message : 'unknown error'}`)
              return
            }
          } else {
            setMembers((items) => items.map((item) => item.id === registration.memberId ? { ...item, points: item.points + 100 } : item))
            addActivity(currentMember.name, `Recorded attendance for ${registration.name}`)
            addNotification({ title: 'Attendance recorded', detail: `${registration.name} was checked in for an event.`, timestamp: 'Just now', recipient: 'All' })
          }
          setScannerOpen(false)
          notify('Attendance recorded')
        } catch (error) {
          notify(error instanceof Error ? error.message : 'Could not record attendance.')
        }
      }}
    />}
    {toast && <div className="toast"><span><Check size={15} /></span>{toast}</div>}
  </div>

  function renderContent() {
    if (privatePages.has(page) && authLoading) return <div className="auth-loading" role="status">Restoring your session…</div>
    if (privatePages.has(page) && (!authUser || !role)) {
      return <AuthPage mode="login" busy={authBusy} feedback={authFeedback} onSignIn={signIn} onSignUp={signUp} onNavigate={navigate} />
    }
    if (!role) {
      if (page === 'about') return <AboutPage events={events} members={members} registrations={registrations} onNavigate={navigate} />
      if (page === 'events') return <><EventsPage events={filteredEvents} loading={eventsLoading} error={eventsError} mutationError={eventMutationError} onRetry={retryEvents} search={search} setSearch={setSearch} category={category} setCategory={setCategory} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onEvent={openEvent} /><PublicFooter onNavigate={navigate} /></>
      if (page === 'event-detail') return <EventDetails event={selectedEvent} registrations={registrations} onRegister={() => navigate('login')} />
      if (page === 'login' || page === 'register') return <AuthPage mode={page} busy={authBusy} feedback={authFeedback} onSignIn={signIn} onSignUp={signUp} onNavigate={navigate} />
      return <LandingPage events={events} onNavigate={navigate} onEvent={openEvent} />
    }
    const countFor = (id: string) => registrations.filter((item) => item.eventId === id && item.status !== 'Cancelled').length
    if (page === 'dashboard') return <Dashboard role={role} currentMember={currentMember} events={events} registrations={registrations} donations={donations} attendance={attendance} members={members} activityLog={activityLog} myRegistrations={myRegistrations} onNavigate={navigate} onCreate={() => startEventEditor()} onEvent={openEvent} />
    if (page === 'events') return <EventsPage events={filteredEvents} loading={eventsLoading} error={eventsError} mutationError={eventMutationError} onRetry={retryEvents} search={search} setSearch={setSearch} category={category} setCategory={setCategory} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onEvent={openEvent} />
    if (page === 'event-detail') {
      const registration = myRegistrations.find((item) => item.eventId === selectedEvent?.id)
      return <EventDetails
        event={selectedEvent}
        registrations={registrations}
        isRegistered={Boolean(registration)}
        registrationStatus={registration?.status}
        onRegister={() => { if (selectedEvent) void register(selectedEvent) }}
        onCancel={registration?.status === 'Confirmed' ? () => void cancelRegistration(registration.id) : undefined}
      />
    }
    if (page === 'manage-events') return <ManageEvents role={role} events={filteredEvents} loading={eventsLoading} error={eventsError} mutationError={eventMutationError} onRetry={retryEvents} countFor={countFor} search={search} setSearch={setSearch} category={category} setCategory={setCategory} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onEdit={startEventEditor} onCreate={() => startEventEditor()} onEvent={openEvent} onStatus={setEventStatus} onDelete={deleteEvent} />
    if (page === 'registrations') return <RegistrationsPage events={events} registrations={registrations} query={query} setQuery={setQuery} />
    if (page === 'attendance') return <AttendancePage role={role} currentMember={currentMember} registrations={registrations} attendance={attendance} events={events} onScan={() => setScannerOpen(true)} />
    if (page === 'files') return <FilesPage
      role={role}
      files={files}
      onUpload={async (file) => {
        try {
          await clubRepository.uploadClubFile(file, currentMember.id)
          await refreshSnapshot()
          notify('File uploaded')
        } catch (error) {
          notify(`File was not uploaded: ${error instanceof Error ? error.message : 'Unable to upload file.'}`)
          throw error
        }
      }}
      onPreview={previewClubFile}
      onDownload={downloadClubFile}
      onDelete={async (file) => {
        try {
          await clubRepository.deleteClubFile(file, role)
          await refreshSnapshot()
          notify('File deleted')
        } catch (error) {
          notify(`File was not deleted: ${error instanceof Error ? error.message : 'Unable to delete file.'}`)
          throw error
        }
      }}
    />
    if (page === 'donations' && role === 'Participant') return <ParticipantDonationsPage donations={donations} member={currentMember} onContribute={() => setDonationModal(true)} />
    if (page === 'donations') return <DonationsPage role={role} donations={donations} onAdd={() => setDonationModal(true)} />
    if (page === 'users') return <UsersPage members={members} />
    if (page === 'reports') return <ReportsPage events={events} registrations={registrations} donations={donations} attendance={attendance} />
    if (page === 'leaderboard') return <LeaderboardPage members={members} currentMember={currentMember} />
    if (page === 'notifications') return <NotificationsPage notifications={notifications.filter((item) => item.recipient === 'All' || item.recipient === role)} error={notificationLiveError || notificationError} onRead={markNotificationsRead} />
    if (page === 'activity') return <ActivityLogPage entries={activityLog} />
    if (page === 'profile') return <ProfilePage member={currentMember} role={role} photoUrl={authProfile?.photoUrl ?? null} photoBusy={profilePhotoBusy} photoError={profilePhotoError} onPhotoUpload={uploadProfilePhoto} busy={authBusy} onSignOut={signOut} />
    if (page === 'about') return <AboutPage events={events} members={members} registrations={registrations} onNavigate={navigate} />
    return <LandingPage events={events} onNavigate={navigate} onEvent={openEvent} />
  }
}

function displayName(_role: Role | null, member: Member) { return member.name }
function shortName(_role: Role | null, member: Member) {
  const [firstName, ...lastNames] = member.name.trim().split(/\s+/)
  return `${firstName}${lastNames[0] ? ` ${lastNames[0][0]}.` : ''}`
}
function Avatar({ name, size = false, imageUrl }: { name: string; size?: boolean; imageUrl?: string | null }) { const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2); return <span className={`avatar avatar-${initials.toLowerCase()} ${size ? 'avatar-large' : ''}`}>{imageUrl ? <img src={imageUrl} alt="" /> : initials}</span> }
function PublicHeader({ page, onNavigate, onSignIn }: { page: Page; onNavigate: (page: Page) => void; onSignIn: () => void }) {
  return <header className={`public-header ${page === 'home' ? 'public-header-home' : ''}`}><button className="brand" onClick={() => onNavigate('home')}><span className="brand-mark"><GraduationCap size={21} /></span><span className="brand-copy"><strong>BIM<span>club</span></strong><small>KIST COLLEGE OF MANAGEMENT</small></span></button><nav className="public-nav"><button className={page === 'home' ? 'public-active' : ''} onClick={() => onNavigate('home')}>Home</button><button className={page === 'about' ? 'public-active' : ''} onClick={() => onNavigate('about')}>About</button><button className={page === 'events' || page === 'event-detail' ? 'public-active' : ''} onClick={() => onNavigate('events')}>Events</button></nav><button className="button button-dark public-login" onClick={onSignIn}>Member sign in <ArrowRight size={15} /></button></header>
}
function PageHeading({ page, role, onCreate, onNavigate }: { page: Page; role: Role; onCreate: () => void; onNavigate: (page: Page) => void }) {
  const descriptions: Partial<Record<Page, string>> = { dashboard: role === 'Admin' ? 'A clear view of what’s happening across your club.' : role === 'BOD' ? 'Your team’s events, people, and activity at a glance.' : 'Your place to keep up with the BIM Club community.', 'manage-events': 'Plan, publish, and track every club event.', registrations: 'Keep track of everyone joining your events.', attendance: 'Check in members and keep attendance up to date.', files: 'Resources and documents shared by the club.', donations: 'A transparent record of community support.', users: 'The people who make the club what it is.', reports: 'A snapshot of club participation and activity.', leaderboard: 'Celebrating the members who show up.', profile: 'Your account and membership details.' }
  return <div className="page-heading"><div><div className="eyebrow">{role} workspace <span>/</span> KIST BIM Club</div><h1>{pageTitles[page]}</h1><p>{descriptions[page]}</p></div>{(page === 'manage-events' || page === 'dashboard' && role !== 'Participant') && <button className="button button-primary" onClick={onCreate}><Plus size={16} /> Create event</button>}{page === 'events' && <button className="button button-quiet" onClick={() => onNavigate('dashboard')}><LayoutDashboard size={16} /> Dashboard</button>}</div>
}
function SocialBrandIcon({ brand }: { brand: 'linkedin' | 'instagram' | 'facebook' }) {
  if (brand === 'linkedin') return <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M5.2 3.8a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2ZM3.5 9.5h3.4v11H3.5v-11Zm5.5 0h3.3V11h.1a3.6 3.6 0 0 1 3.2-1.8c3.5 0 4.2 2.3 4.2 5.2v6.1h-3.4v-5.4c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.5H9v-11Z" /></svg>
  if (brand === 'instagram') return <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.7" r="1" fill="currentColor" stroke="none" /></svg>
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M13.4 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.5 1.6-1.5h1.7V3.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.2v3.2H10V21h3.4Z" /></svg>
}

function PublicFooter({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <footer className="public-footer">
    <div className="footer-main">
      <section className="footer-club">
        <div className="footer-section-title">BIM CLUB</div>
        <div className="footer-brand"><span className="brand-mark"><GraduationCap size={20} /></span><div><b>BIM Club</b><small>KIST College of Management</small></div></div>
        <p>A platform for managing BIM Club events, activities, members, and community engagement.</p>
      </section>
      <nav className="footer-column" aria-label="Quick links">
        <div className="footer-section-title">QUICK LINKS</div>
        <button onClick={() => onNavigate('home')}>Home</button>
        <button onClick={() => onNavigate('about')}>About BIM Club</button>
        <button onClick={() => onNavigate('events')}>Events</button>
        <a href="#footer-connect">Contact</a>
        <button onClick={() => onNavigate('login')}>Login</button>
      </nav>
      <section className="footer-column" id="footer-connect">
        <div className="footer-section-title">CONNECT WITH US</div>
        <a className="footer-social-link" href="https://www.linkedin.com/company/bim-club-kist-college/posts/?feedView=all" target="_blank" rel="noopener noreferrer"><SocialBrandIcon brand="linkedin" /> LinkedIn <ArrowUpRight size={13} /></a>
        <a className="footer-social-link" href="https://www.instagram.com/bimclub_kist?stkn=MWVrYXRqYzUxaDYzaw==" target="_blank" rel="noopener noreferrer"><SocialBrandIcon brand="instagram" /> Instagram <ArrowUpRight size={13} /></a>
        <a className="footer-social-link" href="https://www.facebook.com/share/1EgQnBmaLf/" target="_blank" rel="noopener noreferrer"><SocialBrandIcon brand="facebook" /> Facebook <ArrowUpRight size={13} /></a>
      </section>
      <section className="footer-column footer-college">
        <div className="footer-section-title">KIST COLLEGE OF MANAGEMENT</div>
        <span>KIST College of Management</span>
        <span>Kamalpokhari, Kathmandu</span>
        <a className="footer-website-link" href="https://kist.edu.np/" target="_blank" rel="noopener noreferrer"><Globe size={15} /> Official Website <ArrowUpRight size={13} /></a>
      </section>
    </div>
    <div className="footer-bottom"><span>© BIM Club, KIST College of Management. All rights reserved.</span><button className="footer-back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><ArrowUp size={14} /> Back to top</button></div>
  </footer>
}
function LandingPage({ events, onNavigate, onEvent }: { events: ClubEvent[]; onNavigate: (page: Page) => void; onEvent: (id: string) => void }) {
  const upcoming = events.filter((event) => event.date >= todayDate() && event.status !== 'Cancelled').slice(0, 3)
  return <div className="landing-page">
    <section className="landing-hero home-hero">
      <div className="home-hero-copy">
        <div className="home-hero-badge"><span /> BIM CLUB <i>•</i> KIST COLLEGE</div>
        <h1>Building Ideas.<br /><em>Shaping Tomorrow.</em></h1>
        <p>Technology <span>·</span> Innovation <span>·</span> Community</p>
        <button className="button button-lime" onClick={() => onNavigate('events')}>Explore Events <ArrowRight size={16} /></button>
      </div>
      <div className="hero-accordion">
        <ImageAccordion label="BIM Club highlights" />
      </div>
    </section>
    <section className="landing-marquee"><span>LEARN BY MAKING</span><i /><span>FIND YOUR PEOPLE</span><i /><span>BUILD WHAT MATTERS</span><i /><span>LEARN BY MAKING</span></section>
    <section className="public-section"><div className="section-heading"><div><div className="eyebrow">ON THE CALENDAR</div><h2>Come be part of it.</h2></div><button className="text-link" onClick={() => onNavigate('events')}>All events <ArrowRight size={15} /></button></div><div className="public-event-grid">{upcoming.map((event, index) => <PublicEventCard key={event.id} event={event} index={index} onClick={() => onEvent(event.id)} />)}</div></section>
    <BodCarousel />
    <section className="join-band"><div><span className="eyebrow">THE BIM CLUB AT KIST</span><h2>Good things happen<br />when we make them.</h2><p>Find your next project, your next collaborator, or just a reason to stay curious.</p></div><button className="button button-dark" onClick={() => onNavigate('register')}>Find your people <ArrowRight size={15} /></button></section>
    <PublicFooter onNavigate={onNavigate} />
  </div>
}
function PublicEventCard({ event, index, onClick }: { event: ClubEvent; index: number; onClick: () => void }) { return <button className="public-event-card" onClick={onClick}><div className="public-event-image"><img src={event.image} alt="" /><span className="category-pill">{event.category}</span><span className="event-number">0{index + 1}</span></div><div className="public-event-info"><div className="event-date-line"><CalendarDays size={14} /> {formatDate(event.date, { month: 'long', day: 'numeric' })} <span>·</span> {event.startTime}</div><h3>{event.title}</h3><div className="public-event-location"><MapPin size={13} />{event.location}</div></div></button> }
function BodCarousel() {
  const [visibleCards, setVisibleCards] = useState(() => window.innerWidth <= 700 ? 1 : window.innerWidth <= 1000 ? 2 : 3)
  const [activeGroup, setActiveGroup] = useState(0)
  const [trackPosition, setTrackPosition] = useState(1)
  const [transitioning, setTransitioning] = useState(true)
  const [hovered, setHovered] = useState(false)
  const [paused, setPaused] = useState(false)
  const visibleCardsRef = useRef(visibleCards)
  const resumeTimeout = useRef<number | undefined>(undefined)
  const dragStart = useRef<number | null>(null)
  const groups = useMemo(() => {
    const result: typeof bodMembers[] = []
    for (let index = 0; index < bodMembers.length; index += visibleCards) {
      result.push(bodMembers.slice(index, index + visibleCards))
    }
    return result
  }, [visibleCards])

  useEffect(() => {
    const updateVisibleCards = () => {
      const nextVisibleCards = window.innerWidth <= 700 ? 1 : window.innerWidth <= 1000 ? 2 : 3
      if (nextVisibleCards === visibleCardsRef.current) return
      visibleCardsRef.current = nextVisibleCards
      setVisibleCards(nextVisibleCards)
      setActiveGroup(0)
      setTrackPosition(1)
      setTransitioning(false)
      window.requestAnimationFrame(() => setTransitioning(true))
    }
    window.addEventListener('resize', updateVisibleCards)
    return () => window.removeEventListener('resize', updateVisibleCards)
  }, [])

  useEffect(() => () => {
    if (resumeTimeout.current !== undefined) window.clearTimeout(resumeTimeout.current)
  }, [])

  useEffect(() => {
    if (hovered || paused || groups.length < 2) return
    const interval = window.setInterval(() => {
      setTransitioning(true)
      setTrackPosition((position) => position + 1)
      setActiveGroup((group) => (group + 1) % groups.length)
    }, 4500)
    return () => window.clearInterval(interval)
  }, [groups.length, hovered, paused])

  const pauseAutoplay = () => {
    setPaused(true)
    if (resumeTimeout.current !== undefined) window.clearTimeout(resumeTimeout.current)
    resumeTimeout.current = window.setTimeout(() => setPaused(false), 8000)
  }
  const moveCarousel = (direction: number) => {
    pauseAutoplay()
    setTransitioning(true)
    if (direction > 0) {
      setTrackPosition((position) => position + 1)
      setActiveGroup((group) => (group + 1) % groups.length)
    } else {
      setTrackPosition((position) => position - 1)
      setActiveGroup((group) => (group - 1 + groups.length) % groups.length)
    }
  }
  const goToGroup = (group: number) => {
    pauseAutoplay()
    setTransitioning(true)
    setTrackPosition(group + 1)
    setActiveGroup(group)
  }
  const finishTransition = () => {
    if (trackPosition === 0) {
      setTransitioning(false)
      setTrackPosition(groups.length)
      setActiveGroup(groups.length - 1)
    } else if (trackPosition === groups.length + 1) {
      setTransitioning(false)
      setTrackPosition(1)
      setActiveGroup(0)
    }
  }
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStart.current = event.clientX
    event.currentTarget.setPointerCapture(event.pointerId)
    pauseAutoplay()
  }
  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return
    const distance = event.clientX - dragStart.current
    dragStart.current = null
    if (Math.abs(distance) > 45) {
      setTransitioning(true)
      if (distance < 0) {
        setTrackPosition((position) => position + 1)
        setActiveGroup((group) => (group + 1) % groups.length)
      } else {
        setTrackPosition((position) => position - 1)
        setActiveGroup((group) => (group - 1 + groups.length) % groups.length)
      }
    }
  }
  const handleTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) finishTransition()
  }
  const renderGroup = (members: typeof bodMembers, clone = false) => <div className="bod-carousel-group" aria-hidden={clone || undefined} key={`${clone ? 'clone' : 'group'}-${members[0]?.name}`}>
    {members.map((member) => <article className="bod-card" key={member.name} draggable={false}>
      {member.image ? <img className="bod-card-photo" src={member.image} alt={member.name} draggable={false} /> : <div className="bod-card-photo bod-card-photo-placeholder" role="img" aria-label={`Photo placeholder for ${member.name}`}><span>{member.name.split(' ').map((part) => part[0]).join('')}</span></div>}
      <div className="bod-card-copy"><h3>{member.name}</h3><p>{member.position}</p></div>
    </article>)}
  </div>

  if (groups.length === 0) return null

  return <section className="public-section bod-section" aria-label="BIM Club board of directors" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={pauseAutoplay}>
    <div className="section-heading bod-heading"><div><div className="eyebrow">MEET THE TEAM</div><h2>Meet Our BOD</h2></div><div className="bod-controls"><button className="bod-arrow" onClick={() => moveCarousel(-1)} aria-label="Previous board members"><ChevronLeft size={18} /></button><button className="bod-arrow" onClick={() => moveCarousel(1)} aria-label="Next board members"><ChevronLeft className="bod-next-icon" size={18} /></button></div></div>
    <div className="bod-carousel-viewport" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerCancel={() => { dragStart.current = null }}>
      <div className={`bod-carousel-track ${transitioning ? 'bod-carousel-transition' : ''}`} style={{ transform: `translateX(-${trackPosition * 100}%)` }} onTransitionEnd={handleTransitionEnd}>
        {renderGroup(groups[groups.length - 1], true)}
        {groups.map((group) => renderGroup(group))}
        {renderGroup(groups[0], true)}
      </div>
    </div>
    <div className="bod-dots" role="group" aria-label="Choose board member group">{groups.map((group, index) => <button key={group[0].name} className={`bod-dot ${activeGroup === index ? 'bod-dot-active' : ''}`} aria-label={`Show board member group ${index + 1}`} aria-current={activeGroup === index ? 'true' : undefined} onClick={() => goToGroup(index)} />)}</div>
  </section>
}
function AboutPage({ events, members, registrations, onNavigate }: { events: ClubEvent[]; members: Member[]; registrations: Registration[]; onNavigate: (page: Page) => void }) {
  const [activeFeature, setActiveFeature] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState(0)
  const completedEvents = events.filter((event) => event.status === 'Completed').length
  const activeParticipants = new Set(registrations.filter((registration) => registration.status !== 'Cancelled').map((registration) => registration.memberId)).size
  const features = [
    { title: 'Events & Activities', description: 'Explore gatherings, events, and hands-on activities from the club calendar.', icon: CalendarDays },
    { title: 'Student Community', description: 'Meet fellow BIM students and find people to learn and create alongside.', icon: Users },
    { title: 'Learning & Workshops', description: 'Build practical skills through workshops, talks, and shared learning.', icon: BookOpen },
    { title: 'Collaboration', description: 'Bring ideas together, contribute your perspective, and make things as a team.', icon: Handshake },
  ]
  const steps = [
    { title: 'Join', description: 'Create a club profile to get connected with the BIM Club community and its activities.', icon: UserPlus },
    { title: 'Participate', description: 'Browse the Events page and take part in activities that match your interests.', icon: CalendarDays },
    { title: 'Contribute', description: 'Share your ideas, skills, and energy to help make club activities better for everyone.', icon: Heart },
  ]
  const stats = [
    { label: 'Total Members', value: members.length, icon: Users },
    { label: 'Total Events', value: events.length, icon: CalendarDays },
    { label: 'Completed Events', value: completedEvents, icon: CheckCircle2 },
    { label: 'Active Participants', value: activeParticipants, icon: Activity },
  ]
  const ActiveStepIcon = steps[activeStep].icon

  return <div className="about-page">
    <section className="about-modern-hero">
      <div className="about-modern-hero-inner">
        <div className="about-modern-copy">
          <div className="about-hero-badge"><span className="eyebrow-dot" /> BIM CLUB <i>•</i> KIST COLLEGE</div>
          <h1>BIM Club</h1>
          <h2>KIST College of Management</h2>
          <p>Student-led community focused on technology, innovation, collaboration, and professional growth.</p>
          <div className="hero-actions">
            <button className="button button-lime" onClick={() => onNavigate('events')}>Explore Events <ArrowRight size={16} /></button>
            <button className="button button-outline-light" onClick={() => onNavigate('register')}>Join the Club</button>
          </div>
        </div>
        <div className="about-modern-gallery" aria-label="BIM Club activities">
          {homeHeroCards.slice(0, 4).map((card) => <article className="about-modern-card" key={card.title}>
            <img src={card.image} alt={card.alt} />
            <h3>{card.title}</h3>
          </article>)}
        </div>
      </div>
    </section>

    <section className="about-modern-section about-features">
      <div className="about-section-heading"><div><div className="eyebrow">WHAT YOU’LL FIND HERE</div><h2>Make space for what interests you.</h2></div><p>Explore different ways to connect, learn, and get involved.</p></div>
      <div className="about-feature-grid">{features.map(({ title, description, icon: Icon }) => {
        const expanded = activeFeature === title
        return <button key={title} className={`about-feature-card ${expanded ? 'about-feature-open' : ''}`} aria-expanded={expanded} onClick={() => setActiveFeature(expanded ? null : title)}>
          <span className="about-feature-icon"><Icon size={20} /></span><span className="about-feature-title">{title}</span><span className="about-feature-description">{expanded ? description : 'Discover more'} <ArrowRight size={14} /></span>
        </button>
      })}</div>
    </section>

    <section className="about-engage-section">
      <div className="about-modern-section about-engage-layout">
        <div className="about-engage-heading"><div className="eyebrow">GET INVOLVED</div><h2>How We Engage</h2><p>There’s more than one way to be part of the club. Start where you are, and take the next step when you’re ready.</p></div>
        <div className="about-engage-interaction">
          <div className="about-step-list" role="group" aria-label="How we engage">
            {steps.map(({ title, icon: Icon }, index) => <button key={title} className={`about-step ${activeStep === index ? 'about-step-active' : ''}`} aria-pressed={activeStep === index} aria-controls="about-step-detail" onClick={() => setActiveStep(index)}>
              <span className="about-step-icon"><Icon size={18} /></span><span className="about-step-title">{title}</span><span className="about-step-number">0{index + 1}</span>
            </button>)}
          </div>
          <div className="about-step-detail" id="about-step-detail" role="status"><span className="about-detail-icon"><ActiveStepIcon size={20} /></span><div><span className="eyebrow">STEP 0{activeStep + 1}</span><h3>{steps[activeStep].title}</h3><p>{steps[activeStep].description}</p></div></div>
        </div>
      </div>
    </section>

    <section className="about-modern-section about-stats-section">
      <div className="about-section-heading"><div><div className="eyebrow">THE CLUB AT A GLANCE</div><h2>Built around participation.</h2></div><p>Current figures from the club’s available records.</p></div>
      <div className="about-stat-grid">{stats.map(({ label, value, icon: Icon }) => <div className="about-stat-card" key={label}><span className="about-stat-icon"><Icon size={18} /></span><b>{value.toLocaleString()}</b><span>{label}</span></div>)}</div>
    </section>

    <section className="about-final-cta"><div><div className="eyebrow hero-eyebrow">FIND YOUR NEXT STEP</div><h2>Explore BIM Club Events</h2><p>See what’s on the calendar and find an activity to join.</p></div><button className="button button-lime" onClick={() => onNavigate('events')}>Explore Events <ArrowRight size={16} /></button></section>
    <PublicFooter onNavigate={onNavigate} />
  </div>
}
function EventsPage({ events, loading, error, mutationError, onRetry, search, setSearch, category, setCategory, statusFilter, setStatusFilter, onEvent }: { events: ClubEvent[]; loading: boolean; error: string; mutationError: string; onRetry: () => void; search: string; setSearch: (value: string) => void; category: string; setCategory: (value: string) => void; statusFilter: string; setStatusFilter: (value: string) => void; onEvent: (id: string) => void }) {
  return <div className="events-page">
    <div className="events-content">
      <div className="events-intro">
        <div className="eyebrow">BIM CLUB ACTIVITIES</div>
        <h1>Explore <em>Events.</em></h1>
        <p>Workshops, talks, and activities for the BIM community.</p>
      </div>
      <div className="filter-bar">
        <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search events" /></label>
        <label className="select-field"><Filter size={15} /><select value={category} onChange={(event) => setCategory(event.target.value)}><option>All categories</option><option>Workshop</option><option>Design</option><option>Competition</option><option>Seminar</option><option>Community</option></select><ChevronDown size={14} /></label>
        <label className="select-field"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option><option>Draft</option><option>Published</option><option>Registration Open</option><option>Registration Closed</option><option>Completed</option><option>Cancelled</option></select><ChevronDown size={14} /></label>
        <span className="result-count">{events.length} events</span>
      </div>
      <EventDataState loading={loading} error={error} mutationError={mutationError} onRetry={onRetry} />
      {!loading && !error && events.length > 0 && <div className="public-event-grid events-grid-list">{events.map((event, index) => <PublicEventCard key={event.id} event={event} index={index} onClick={() => onEvent(event.id)} />)}</div>}
      {!loading && !error && events.length === 0 && <EmptyState title="No events match those filters" detail="Try changing your search or category, or check back later." />}
    </div>
  </div>
}
function EventDetails({ event, registrations, isRegistered = false, registrationStatus, onRegister, onCancel }: { event?: ClubEvent; registrations: Registration[]; isRegistered?: boolean; registrationStatus?: Registration['status']; onRegister: () => void; onCancel?: () => void }) {
  if (!event) return <EmptyState title="Event not found" detail="This event may have been removed." />
  const count = registrations.filter((item) => item.eventId === event.id && item.status !== 'Cancelled').length
  const available = Math.max(0, event.maxParticipants - count)
  const open = event.status === 'Registration Open' && available > 0 && event.registrationDeadline >= todayDate() && event.date >= todayDate()
  return <div className="detail-page"><div className="detail-layout"><div className="detail-main"><div className="detail-image"><img src={event.image} alt="" /><span className="category-pill">{event.category}</span></div><div className="detail-kicker"><StatusBadge status={event.status} /> <span>·</span> {formatDate(event.date, { month: 'long', day: 'numeric', year: 'numeric' })}</div><h1>{event.title}</h1><p className="detail-description">{event.description}</p><div className="detail-facts"><div><CalendarDays size={18} /><span><small>DATE & TIME</small><b>{formatDate(event.date, { weekday: 'long', month: 'long', day: 'numeric' })}</b><span>{event.startTime} – {event.endTime}</span></span></div><div><MapPin size={18} /><span><small>LOCATION</small><b>{event.location}</b><span>Kathmandu, Nepal</span></span></div><div><Users size={18} /><span><small>CAPACITY</small><b>{event.maxParticipants} seats</b><span>Registration closes {formatDate(event.registrationDeadline, { month: 'long', day: 'numeric' })}</span></span></div></div><div className="detail-about"><h2>About this event</h2><p>{event.description} Bring your laptop, your questions, and an open mind. All BIM students are welcome; no prior experience is needed.</p></div></div><aside className="registration-card"><div className="eyebrow">{event.isPaid ? 'PAID REGISTRATION' : 'SAVE YOUR SEAT'}</div><h3>{event.isPaid ? formatMoney(event.price ?? 0) : 'Free event'}</h3><p>{formatDate(event.date, { month: 'long', day: 'numeric' })} · {event.startTime} – {event.endTime}</p><div className="capacity-line"><div><b>{event.maxParticipants}</b><span> seats</span></div><small>{count} registered</small></div><div className="capacity-track"><span style={{ width: `${Math.min(100, count / event.maxParticipants * 100)}%` }} /></div><div className="seat-count"><span><i />{available} seats available</span><b>{Math.round(count / event.maxParticipants * 100)}%</b></div>{isRegistered ? <><div className="registered-note"><CheckCircle2 size={17} /><span><b>You’re on the list</b><small>{registrationStatus === 'Attended' ? 'Attendance verified' : 'Registration confirmed'}</small></span></div>{onCancel && <button className="button button-cancel" onClick={onCancel}>Cancel registration</button>}</> : <button className={`button ${open ? 'button-primary' : 'button-disabled'}`} disabled={!open} onClick={onRegister}>{open ? event.isPaid ? `Pay ${formatMoney(event.price ?? 0)} with eSewa` : 'Register for free' : available === 0 ? 'Event is full' : 'Registration closed'} {open && <ArrowRight size={15} />}</button>}<small className="registration-note">{event.isPaid ? 'Secure payment by eSewa is required to confirm your seat.' : 'No fee · Open to KIST students'}</small></aside></div></div>
}
function AuthPage({ mode, busy, feedback, onSignIn, onSignUp, onNavigate }: {
  mode: 'login' | 'register'
  busy: boolean
  feedback: AuthFeedback
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (fullName: string, email: string, password: string) => Promise<void>
  onNavigate: (page: Page) => void
}) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (mode === 'register') void onSignUp(fullName, email, password)
    else void onSignIn(email, password)
  }

  return <div className="auth-page">
    <div className="auth-art"><div className="auth-art-inner"><span className="eyebrow"><span className="eyebrow-dot" /> KIST BIM CLUB</span><h2>Make your<br />next thing<br /><em>together.</em></h2><p>A community for curious people and practical ideas.</p><img src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1000&q=85" alt="A team working together" /><span className="auth-caption">BIM CLUB · KIST COLLEGE OF MANAGEMENT</span></div></div>
    <div className="auth-form-wrap">
      <form className="auth-form" onSubmit={submit}>
        <div className="eyebrow">{mode === 'login' ? 'MEMBER ACCESS' : 'BECOME A MEMBER'}</div>
        <h1>{mode === 'login' ? 'Welcome back.' : 'Make yourself at home.'}</h1>
        <p>{mode === 'login' ? 'Sign in to your BIM Club workspace.' : 'Create a member profile to join events and club activities.'}</p>
        {feedback && <div className={`auth-feedback auth-feedback-${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.message}</div>}
        {mode === 'register' && <label className="form-label">Full name<input autoComplete="name" maxLength={120} required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>}
        <label className="form-label">Email<input autoComplete="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className="form-label">Password<input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type="password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in to workspace' : 'Create account'} {!busy && <ArrowRight size={15} />}</button>
        <div className="auth-switch">{mode === 'login' ? 'New to the club?' : 'Already a member?'} <button type="button" onClick={() => onNavigate(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create a profile' : 'Sign in'}</button></div>
      </form>
    </div>
  </div>
}
function Dashboard({ role, currentMember, events, registrations, donations, attendance, members, activityLog, myRegistrations, onNavigate, onCreate, onEvent }: {
  role: Role
  currentMember: Member
  events: ClubEvent[]
  registrations: Registration[]
  donations: Donation[]
  attendance: AttendanceRecord[]
  members: Member[]
  activityLog: ActivityLogEntry[]
  myRegistrations: Registration[]
  onNavigate: (page: Page) => void
  onCreate: () => void
  onEvent: (id: string) => void
}) {
  const upcoming = events.filter((event) => event.date >= todayDate() && event.status !== 'Cancelled').sort((a, b) => a.date.localeCompare(b.date))
  const completed = events.filter((event) => event.status === 'Completed').length
  const raised = donations.filter((donation) => donation.status === 'Received').reduce((sum, donation) => sum + donation.amount, 0)
  const activeRegistrations = registrations.filter((registration) => registration.status !== 'Cancelled')
  const attendanceRate = activeRegistrations.length ? Math.round(attendance.length / activeRegistrations.length * 100) : 0
  const thisMonth = todayDate().slice(0, 7)
  const newMembersThisMonth = members.filter((member) => member.joined.startsWith(thisMonth)).length
  if (role === 'Participant') {
    const registeredEvents = myRegistrations
      .map((registration) => events.find((event) => event.id === registration.eventId))
      .filter((event): event is ClubEvent => Boolean(event && event.date >= todayDate() && event.status !== 'Cancelled'))
      .sort((a, b) => a.date.localeCompare(b.date))
    const attendedCount = myRegistrations.filter((registration) => registration.status === 'Attended').length

    return <div className="dashboard-page participant-dashboard">
      <section className="participant-welcome">
        <div>
          <span className="eyebrow">YOUR BIM CLUB</span>
          <h2>Welcome back, <em>{currentMember.name.split(' ')[0]}.</em></h2>
          <p>Here’s what’s happening with your club activity.</p>
        </div>
        <button className="button button-primary" onClick={() => onNavigate('events')}>Explore events <ArrowRight size={15} /></button>
      </section>
      <div className="metric-grid participant-metrics">
        <Metric icon={CalendarDays} label="Upcoming registrations" value={String(registeredEvents.length)} detail="Events on your calendar" tone="blue" />
        <Metric icon={CheckCircle2} label="Events attended" value={String(attendedCount)} detail="Verified check-ins" tone="green" />
        <Metric icon={TrendingUp} label="Club points" value={currentMember.points.toLocaleString()} detail="View the leaderboard" tone="yellow" />
      </div>
      <section className="panel participant-events-panel">
        <PanelHeading title="Your upcoming events" action="Browse all" onAction={() => onNavigate('events')} />
        <div className="compact-event-list">
          {registeredEvents.map((event) => <CompactEvent key={event.id} event={event} onClick={() => onEvent(event.id)} />)}
          {registeredEvents.length === 0 && <EmptyState title="Nothing scheduled yet" detail="Browse events and register to add one here." action="Explore events" onAction={() => onNavigate('events')} />}
        </div>
      </section>
    </div>
  }
  if (role === 'BOD') return <div className="dashboard-page">
    <WelcomeBanner variant="bod" onCreate={onCreate} upcomingCount={upcoming.length} registrationCount={activeRegistrations.length} />
    <div className="metric-grid metric-grid-4">
      <Metric icon={CalendarDays} label="Upcoming events" value={String(upcoming.length)} detail="Scheduled from the live calendar" tone="green" />
      <Metric icon={Clock} label="Today's events" value={String(events.filter((event) => event.date === todayDate()).length)} detail="On the calendar" tone="blue" />
      <Metric icon={Users} label="Registrations" value={String(activeRegistrations.length)} detail="Active event registrations" tone="peach" />
      <Metric icon={CheckCircle2} label="Attendance statistics" value={`${attendanceRate}%`} detail={`${attendance.length} verified check-ins`} tone="yellow" />
    </div>
    <div className="content-grid dashboard-lower">
      <section className="panel"><PanelHeading title="Upcoming events" action="Manage events" onAction={() => onNavigate('manage-events')} /><div className="compact-event-list">{upcoming.slice(0, 3).map((event) => <CompactEvent key={event.id} event={event} onClick={() => onEvent(event.id)} />)}{upcoming.length === 0 && <EmptyState title="No upcoming events" detail="Published events will appear here." />}</div></section>
      <section className="panel"><PanelHeading title="Recent activity" action="View registrations" onAction={() => onNavigate('registrations')} /><div className="timeline">{activityLog.slice(0, 3).map((entry) => <ActivityItem key={entry.id} icon={Activity} title={entry.user} detail={`${entry.action} · ${entry.timestamp}`} tone="blue" />)}{activityLog.length === 0 && <EmptyState title="No recent activity" detail="Club changes will appear here." />}</div><div className="quick-actions"><button onClick={() => onNavigate('registrations')}><ClipboardList size={15} /> Registrations</button><button onClick={() => onNavigate('attendance')}><QrCode size={15} /> Scan QR</button><button onClick={() => onNavigate('files')}><Upload size={15} /> Upload file</button></div></section>
    </div>
  </div>
  return <div className="dashboard-page">
    <WelcomeBanner variant="admin" memberName={currentMember.name.split(' ')[0]} memberCount={members.length} eventCount={events.length} onCreate={onCreate} />
    <div className="metric-grid metric-grid-4">
      <Metric icon={Users} label="Total members" value={String(members.length)} detail={`${newMembersThisMonth} joined this month`} tone="green" />
      <Metric icon={CalendarDays} label="Total events" value={String(events.length)} detail="Live club calendar" tone="blue" />
      <Metric icon={Clock} label="Upcoming events" value={String(upcoming.length)} detail="Scheduled from the live calendar" tone="peach" />
      <Metric icon={CheckCircle2} label="Completed events" value={String(completed)} detail="From the live club calendar" tone="yellow" />
      <Metric icon={Activity} label="Total attendance" value={String(attendance.length)} detail="Verified check-ins" tone="blue" />
      <Metric icon={CircleDollarSign} label="Total donations" value={formatMoney(raised)} detail="Confirmed donations" tone="green" />
    </div>
    <div className="content-grid admin-content-grid">
      <section className="panel chart-panel"><PanelHeading title="Attendance overview" action="Full report" onAction={() => onNavigate('reports')} /><div className="chart-legend"><span><i /> Event attendance</span><span className="chart-period">Last 6 months <ChevronDown size={13} /></span></div><div className="chart-wrap"><AttendanceChart attendance={attendance} /></div></section>
      <section className="panel"><PanelHeading title="Upcoming events" action="All events" onAction={() => onNavigate('manage-events')} /><div className="compact-event-list">{upcoming.slice(0, 3).map((event) => <CompactEvent key={event.id} event={event} onClick={() => onEvent(event.id)} />)}{upcoming.length === 0 && <EmptyState title="No upcoming events" detail="Published events will appear here." />}</div></section>
    </div>
    <div className="content-grid admin-bottom-grid">
      <section className="panel table-panel"><PanelHeading title="Recent registrations" action="View all" onAction={() => onNavigate('registrations')} /><RegistrationTable registrations={registrations.slice(0, 4)} events={events} compact />{registrations.length === 0 && <EmptyState title="No registrations yet" detail="Event signups will appear here." />}</section>
      <section className="panel"><PanelHeading title="Recent donations" action="Ledger" onAction={() => onNavigate('donations')} /><div className="donation-mini-list">{donations.slice(0, 3).map((donation) => <DonationRow key={donation.id} donation={donation} />)}{donations.length === 0 && <EmptyState title="No donations yet" detail="Recorded contributions will appear here." />}</div></section>
      <div className="panel quick-panel"><PanelHeading title="Quick actions" />{[['Create event', CalendarDays, onCreate], ['Manage members', Users, () => onNavigate('users')], ['Upload file', Upload, () => onNavigate('files')], ['View reports', ChartNoAxesCombined, () => onNavigate('reports')]].map(([label, Icon, action]) => { const ItemIcon = Icon as typeof Users; return <button key={label as string} onClick={action as () => void}><span><ItemIcon size={15} /></span>{label as string}<ArrowRight size={14} /></button> })}</div>
    </div>
  </div>
}
function WelcomeBanner({ variant, memberName, memberCount = 0, eventCount = 0, upcomingCount = 0, registrationCount = 0, onCreate }: {
  variant: 'admin' | 'bod'
  memberName?: string
  memberCount?: number
  eventCount?: number
  upcomingCount?: number
  registrationCount?: number
  onCreate: () => void
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23' }).format(now))
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return <div className={`welcome-banner ${variant}-banner`}>
    <div><span className="eyebrow">{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(now).toUpperCase()}</span>
      <h2>{variant === 'admin' ? <>{greeting},<br /><em>{memberName}.</em></> : <>Let’s make this<br />week <em>count.</em></>}</h2>
      <p>{variant === 'admin' ? 'Here is your club at a glance.' : 'Your club activity and upcoming work at a glance.'}</p>
      <button className="button button-lime" onClick={onCreate}><Plus size={15} /> Create an event</button>
    </div>
    {variant === 'admin'
      ? <div className="admin-banner-art"><div className="banner-stat banner-stat-top"><span>MEMBERS</span><b>{memberCount}</b></div><div className="banner-stat banner-stat-bottom"><span>CLUB EVENTS</span><b>{eventCount}</b></div><div className="banner-orbit orbit-one" /><div className="banner-orbit orbit-two" /><span className="banner-sparkle">✳</span></div>
      : <div className="bod-banner-art"><span className="art-tag art-tag-one"><CalendarDays size={17} /> {upcomingCount} upcoming events</span><span className="art-tag art-tag-two"><Users size={17} /> {registrationCount} registrations</span><div className="art-big-icon"><Activity size={74} strokeWidth={1.15} /></div><span className="art-grid" /></div>}
  </div>
}
function AttendanceChart({ attendance }: { attendance: AttendanceRecord[] }) {
  const [currentMonth] = useState(() => {
    const now = new Date()
    return now.getFullYear() * 12 + now.getMonth()
  })
  const chartData = Array.from({ length: 6 }, (_, index) => {
    const monthIndex = currentMonth - 5 + index
    const month = new Date(Math.floor(monthIndex / 12), monthIndex % 12, 1)
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
    return {
      month: month.toLocaleDateString('en-US', { month: 'short' }),
      attendees: attendance.filter((record) => record.date.startsWith(key)).length,
    }
  })
  return <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}><defs><linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#245d9d" stopOpacity={0.18} /><stop offset="100%" stopColor="#245d9d" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e4e9ef" strokeDasharray="4 6" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#78889b', fontSize: 11 }} dy={9} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#78889b', fontSize: 11 }} /><Tooltip contentStyle={{ border: '1px solid #e1e7ee', borderRadius: 4, fontSize: 12 }} /><Area type="monotone" dataKey="attendees" stroke="#245d9d" strokeWidth={2.5} fill="url(#attendanceFill)" /></AreaChart></ResponsiveContainer>
}
function AttendanceScanner({ events, registrations, attendance, onClose, onConfirm }: {
  events: ClubEvent[]
  registrations: Registration[]
  attendance: AttendanceRecord[]
  onClose: () => void
  onConfirm: (registration: Registration) => Promise<void>
}) {
  const [eventId, setEventId] = useState(events[0]?.id ?? '')
  const [registrationId, setRegistrationId] = useState('')
  const [scanMessage, setScanMessage] = useState('Starting camera…')
  const selected = registrations.find((item) => item.id === registrationId)
  const duplicate = Boolean(selected && attendance.some((item) => item.registrationId === selected.id))

  useEffect(() => {
    let scanner: import('html5-qrcode').Html5Qrcode | undefined
    let active = true
    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (!active) return
        scanner = new Html5Qrcode('attendance-qr-reader')
        await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 220 }, (decodedText) => {
          const decodedId = decodedText.startsWith('BIMCLUB:') ? decodedText.slice(8) : decodedText
          const match = registrations.find((item) => item.id === decodedId && item.status === 'Confirmed')
          if (!match) return setScanMessage('QR code does not belong to an active event registration.')
          setEventId(match.eventId)
          setRegistrationId(match.id)
          setScanMessage('Participant QR scanned. Review the details below.')
        }, () => undefined)
      } catch {
        if (active) setScanMessage('Camera unavailable. Enter the registration QR payload below.')
      }
    }
    void startScanner()
    return () => {
      active = false
      void scanner?.stop().catch(() => undefined)
    }
  }, [registrations])

  const submitPayload = (value: string) => {
    const decodedId = value.startsWith('BIMCLUB:') ? value.slice(8) : value
    const match = registrations.find((item) => item.id === decodedId && item.status === 'Confirmed')
    if (!match) {
      setRegistrationId('')
      setScanMessage('QR payload not recognized. Use an active event registration QR.')
      return
    }
    setEventId(match.eventId)
    setRegistrationId(match.id)
    setScanMessage('Participant QR verified. Review the details below.')
  }

  return <div className="modal-backdrop" role="presentation">
    <div className="modal donation-editor-modal" role="dialog" aria-modal="true">
      <div className="modal-heading"><div><span className="eyebrow">QR-BASED ATTENDANCE VERIFICATION</span><h2>Verify participant check-in</h2></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={19} /></button></div>
      <div className="modal-body">
        <label className="form-label">Event<select value={eventId} onChange={(event) => { setEventId(event.target.value); setRegistrationId('') }}>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
        <div id="attendance-qr-reader" className="qr-reader" />
        <div className="scan-preview"><QrCode size={42} /><b>{scanMessage}</b><small>Allow camera access, or enter an active registration QR payload.</small></div>
        <label className="form-label">QR payload<input placeholder="BIMCLUB:registration-id" onChange={(event) => submitPayload(event.target.value)} /></label>
        {selected && <div className="registered-note"><CheckCircle2 size={17} /><span><b>{selected.name}</b><small>{selected.email} · {duplicate ? 'Already checked in for this event.' : 'Registration confirmed.'}</small></span></div>}
      </div>
      <div className="modal-footer"><button className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={!selected || duplicate || selected.status !== 'Confirmed'} onClick={() => { if (selected) void onConfirm(selected) }}>{duplicate ? 'Already recorded' : 'Confirm attendance'} <Check size={15} /></button></div>
    </div>
  </div>
}
function NotificationsPage({ notifications, error, onRead }: { notifications: Notification[]; error: string; onRead: () => void | Promise<void> }) { return <div className="section-page"><div className="list-toolbar"><span className="result-count">{notifications.filter((item) => !item.read).length} unread notifications</span><button className="button button-quiet" disabled={!notifications.some((item) => !item.read)} onClick={() => void onRead()}><Check size={15} /> Mark all read</button></div>{error && <div className="event-data-error" role="alert"><span><b>Notifications need attention</b><small>{error}</small></span></div>}<div className="panel notification-list-panel">{notifications.map((item) => <div className={`notification-row ${item.read ? '' : 'notification-unread'}`} key={item.id}><span className="notification-icon"><Bell size={15} /></span><div><b>{item.title}</b><small>{item.detail}</small></div><time>{item.timestamp}</time></div>)}{notifications.length === 0 && !error && <EmptyState title="You are all caught up" detail="New club updates will appear here." />}</div></div> }
function ActivityLogPage({ entries }: { entries: ActivityLogEntry[] }) { return <div className="section-page"><div className="panel event-table-panel"><div className="panel-heading panel-heading-padded"><h3>Admin activity log</h3><span className="result-count">{entries.length} entries</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>USER</th><th>ACTION</th><th>DATE / TIME</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td><MemberCell name={entry.user} email="club workspace" /></td><td>{entry.action}</td><td>{entry.timestamp}</td></tr>)}</tbody></table></div></div></div> }
function Metric({ icon: Icon, label, value, detail, tone, trend }: { icon: typeof Users; label: string; value: string; detail: string; tone: string; trend?: string }) { return <div className="metric-card"><div className="metric-top"><span className={`metric-icon tone-${tone}`}><Icon size={17} /></span>{trend && <span className="metric-trend"><ArrowUpRight size={13} />{trend}</span>}</div><div className="metric-value">{value}</div><div className="metric-label">{label}</div><div className="metric-detail">{detail}</div></div> }
function PanelHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) { return <div className="panel-heading"><h3>{title}</h3>{action && <button className="text-link text-link-small" onClick={onAction}>{action}<ArrowRight size={13} /></button>}</div> }
function CompactEvent({ event, onClick }: { event: ClubEvent; onClick: () => void }) { const date = new Date(`${event.date}T12:00:00`); return <button className="compact-event" onClick={onClick}><span className="compact-date"><b>{date.getDate()}</b><small>{date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</small></span><span className="compact-event-body"><b>{event.title}</b><small><Clock size={12} /> {event.startTime} <span>·</span> <MapPin size={12} /> {event.location}</small></span><StatusBadge status={event.status} /></button> }
function ActivityItem({ icon: Icon, title, detail, tone }: { icon: typeof Activity; title: string; detail: string; tone: string }) { return <div className="activity-item"><span className={`activity-icon tone-${tone}`}><Icon size={15} /></span><div><b>{title}</b><small>{detail}</small></div></div> }
function StatusBadge({ status }: { status: EventStatus | Registration['status'] | Donation['status'] | AttendanceRecord['status'] | `${number}%` }) { return <span className={`status-badge badge-${String(status).toLowerCase().replaceAll(' ', '-')}`}><i />{status}</span> }
function ManageEvents({ role, events, loading, error, mutationError, onRetry, countFor, search, setSearch, category, setCategory, statusFilter, setStatusFilter, onEdit, onCreate, onEvent, onStatus, onDelete }: { role: Role; events: ClubEvent[]; loading: boolean; error: string; mutationError: string; onRetry: () => void; countFor: (id: string) => number; search: string; setSearch: (value: string) => void; category: string; setCategory: (value: string) => void; statusFilter: string; setStatusFilter: (value: string) => void; onEdit: (event: ClubEvent) => void; onCreate: () => void; onEvent: (id: string) => void; onStatus: (id: string, status: EventStatus) => Promise<void>; onDelete: (event: ClubEvent) => Promise<void> }) {
  const confirmDelete = async (event: ClubEvent) => {
    if (role !== 'Admin' || !window.confirm(`Permanently delete "${event.title}"? Its registrations and attendance records will also be removed.`)) return
    await onDelete(event)
  }
  return <div className="section-page">
    <div className="list-toolbar"><SearchField value={search} onChange={setSearch} placeholder="Search events" /><SelectField value={category} onChange={setCategory} options={['All categories', 'Workshop', 'Design', 'Competition', 'Seminar', 'Community']} icon={<Filter size={15} />} /><SelectField value={statusFilter} onChange={setStatusFilter} options={['All statuses', 'Draft', 'Published', 'Registration Open', 'Registration Closed', 'Completed', 'Cancelled']} /><span className="result-count">{events.length} events</span><button className="button button-primary toolbar-create" onClick={onCreate}><Plus size={15} /> New event</button></div>
    <EventDataState loading={loading} error={error} mutationError={mutationError} onRetry={onRetry} />
    {!loading && !error && <div className="panel event-table-panel">
      <div className="table-scroll"><table className="data-table"><thead><tr><th>EVENT</th><th>DATE & LOCATION</th><th>REGISTRATIONS</th><th>STATUS</th><th /></tr></thead><tbody>{events.map((event) => { const count = countFor(event.id); return <tr key={event.id}><td><button className="event-table-name" onClick={() => onEvent(event.id)}><img src={event.image} alt="" /><span><b>{event.title}</b><small>{event.category}</small></span></button></td><td><b>{formatDate(event.date, { month: 'short', day: 'numeric', year: 'numeric' })}</b><small className="table-secondary"><MapPin size={12} /> {event.location}</small></td><td><div className="registration-progress"><span>{count} / {event.maxParticipants}</span><i><b style={{ width: `${Math.min(100, count / event.maxParticipants * 100)}%` }} /></i></div></td><td><StatusBadge status={event.status} /></td><td><div className="table-actions"><button className="icon-button" aria-label={`Edit ${event.title}`} onClick={() => onEdit(event)}><Settings2 size={15} /></button><button className="icon-button" aria-label={`Toggle registration for ${event.title}`} onClick={() => void onStatus(event.id, event.status === 'Registration Open' ? 'Registration Closed' : 'Registration Open')}><ArrowUpRight size={15} /></button>{role === 'Admin' && <button className="icon-button file-delete-button" aria-label={`Delete ${event.title}`} title="Delete event" onClick={() => void confirmDelete(event)}><Trash2 size={15} /></button>}</div></td></tr> })}</tbody></table></div>
      {events.length === 0 && <EmptyState title="No events found" detail="Try another search or create a new event." action="Create event" onAction={onCreate} />}
    </div>}
  </div>
}

function EventDataState({ loading, error, mutationError, onRetry }: { loading: boolean; error: string; mutationError: string; onRetry: () => void }) {
  return <>
    {loading && <div className="event-data-state" role="status">Loading events…</div>}
    {error && <div className="event-data-error" role="alert"><span><b>Events could not be loaded.</b><small>{error}</small></span><button className="button button-quiet button-xs" onClick={onRetry}>Retry</button></div>}
    {mutationError && <div className="event-data-error" role="alert"><span><b>Event changes were not saved.</b><small>{mutationError}</small></span></div>}
  </>
}
function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="search-field"><Search size={16} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label> }
function SelectField({ value, onChange, options, icon }: { value: string; onChange: (value: string) => void; options: string[]; icon?: React.ReactNode }) { return <label className="select-field">{icon}<select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={14} /></label> }
function RegistrationsPage({ events, registrations, query, setQuery }: { events: ClubEvent[]; registrations: Registration[]; query: string; setQuery: (value: string) => void }) {
  const filtered = registrations.filter((item) => `${item.name} ${item.email} ${events.find((event) => event.id === item.eventId)?.title ?? ''} ${item.paymentMethod ?? ''} ${item.paymentRef ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="section-page">
    <div className="list-toolbar">
      <SearchField value={query} onChange={setQuery} placeholder="Search name, email, event, or ref" />
      <span className="result-count">{filtered.length} registrations</span>
      <button className="button button-quiet" onClick={() => window.print()}><ArrowDownToLine size={15} /> Export</button>
    </div>
    <div className="panel event-table-panel">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>MEMBER</th>
              <th>EVENT</th>
              <th>REGISTERED</th>
              <th>PAYMENT</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const event = events.find((e) => e.id === item.eventId)
              const hasPayment = item.paidAmount != null && item.paidAmount > 0
              return <tr key={item.id}>
                <td><MemberCell name={item.name} email={item.email} /></td>
                <td><b>{event?.title ?? 'Removed event'}</b></td>
                <td>{formatDate(item.registeredAt, { month: 'short', day: 'numeric' })}</td>
                <td>
                  {hasPayment ? (
                    <div>
                      <b style={{ color: '#16a34a' }}>NPR {item.paidAmount?.toLocaleString()}</b>
                      <small style={{ display: 'block', color: 'var(--text-subtle, #64748b)', fontSize: '0.75rem' }}>
                        {item.paymentMethod || 'eSewa'} {item.paymentRef ? `• Ref: ${item.paymentRef.slice(0, 8)}…` : ''}
                      </small>
                    </div>
                  ) : event?.isPaid ? (
                    <span className="status-badge badge-pending">Payment Pending</span>
                  ) : (
                    <span style={{ color: 'var(--text-subtle, #64748b)' }}>Free Event</span>
                  )}
                </td>
                <td><StatusBadge status={item.status} /></td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <EmptyState title="No registrations yet" detail="Event signups will appear here." />}
    </div>
  </div>
}
function MemberCell({ name, email }: { name: string; email: string }) { return <div className="member-cell"><Avatar name={name} /><span><b>{name}</b><small>{email}</small></span></div> }
function RegistrationTable({ registrations, events, compact = false }: { registrations: Registration[]; events: ClubEvent[]; compact?: boolean }) {
  return <div className="table-scroll">
    <table className={`data-table ${compact ? 'data-table-compact' : ''}`}>
      <thead>
        <tr>
          <th>MEMBER</th>
          <th>EVENT</th>
          <th>FEE</th>
          <th>STATUS</th>
        </tr>
      </thead>
      <tbody>
        {registrations.map((item) => {
          const event = events.find((e) => e.id === item.eventId)
          const hasPayment = item.paidAmount != null && item.paidAmount > 0
          return <tr key={item.id}>
            <td><MemberCell name={item.name} email={item.email.split('@')[0]} /></td>
            <td><span className="table-event-title">{event?.title ?? 'Removed event'}</span></td>
            <td>
              {hasPayment ? (
                <b style={{ color: '#16a34a', fontSize: '0.85rem' }}>NPR {item.paidAmount?.toLocaleString()}</b>
              ) : event?.isPaid ? (
                <small style={{ color: '#d97706' }}>Pending</small>
              ) : (
                <small style={{ color: 'var(--text-subtle, #64748b)' }}>Free</small>
              )}
            </td>
            <td><StatusBadge status={item.status} /></td>
          </tr>
        })}
      </tbody>
    </table>
  </div>
}
function DonationRow({ donation }: { donation: Donation }) { return <div className="donation-row"><span className="donation-icon"><Heart size={14} /></span><div><b>{donation.name}</b><small>{donation.purpose}</small></div><strong>{formatMoney(donation.amount)}</strong></div> }
function ParticipantDonationsPage({ donations, member, onContribute }: { donations: Donation[]; member: Member; onContribute: () => void }) { const mine = donations.filter((item) => item.memberId === member.id); const total = mine.filter((item) => item.status === 'Received').reduce((sum, item) => sum + item.amount, 0); return <div className="section-page"><div className="donation-summary"><div><span className="eyebrow">YOUR SUPPORT</span><div className="donation-total">{formatMoney(total)}</div><p>Your contributions help fund workshops and student projects.</p><button className="button button-lime" onClick={onContribute}><Heart size={15} /> Make a contribution</button></div><div className="donation-summary-icon"><Heart size={32} strokeWidth={1.3} /></div></div><div className="panel event-table-panel"><div className="panel-heading panel-heading-padded"><h3>Donation history</h3><span className="result-count">{mine.length} contributions</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>PURPOSE</th><th>DATE</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>{mine.map((item) => <tr key={item.id}><td>{item.purpose}</td><td>{formatDate(item.date, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td><b>{formatMoney(item.amount)}</b></td><td><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div>{mine.length === 0 && <EmptyState title="No contributions yet" detail="Your contribution history will appear here." />}</div><p className="disclaimer-note"><ShieldCheck size={14} /> Contributions are recorded as pending until confirmed by club staff.</p></div> }
function AttendancePage({ role, currentMember, registrations, attendance, events, onScan }: {
  role: Role
  currentMember: Member
  registrations: Registration[]
  attendance: AttendanceRecord[]
  events: ClubEvent[]
  onScan: () => void
}) {
  const activeRegistrations = registrations.filter((item) => item.status !== 'Cancelled')
  const ownRegistrations = activeRegistrations.filter((item) => item.memberId === currentMember.id)
  const ownAttendance = attendance.filter((item) => item.memberId === currentMember.id)
  const registered = role === 'Participant' ? ownRegistrations.length : activeRegistrations.length
  const attended = role === 'Participant' ? ownAttendance.length : attendance.length

  if (role === 'Participant') return <div className="section-page">
    <div className="attendance-callout"><div className="scan-mark"><QrCode size={24} /></div><div><b>Your event check-in codes</b><small>Only your active registrations are shown here. Present the matching code to event staff.</small></div></div>
    <div className="metric-grid metric-grid-3">
      <Metric icon={CheckCircle2} label="Events attended" value={String(attended).padStart(2, '0')} detail="Verified check-ins" tone="green" />
      <Metric icon={Activity} label="Attendance rate" value={`${Math.round(attended / Math.max(registered, 1) * 100)}%`} detail={`${attended} of ${registered} registered events`} tone="blue" />
      <Metric icon={TrendingUp} label="Club points" value={currentMember.points.toLocaleString()} detail="Earned from verified attendance" tone="peach" />
    </div>
    <div className="panel attendance-history">
      <PanelHeading title="Your registered events" />
      <div className="member-attendance-list">
        {ownRegistrations.map((registration) => {
          const event = events.find((item) => item.id === registration.eventId)
          const checkedIn = ownAttendance.some((item) => item.registrationId === registration.id)
          return <article className="member-attendance-card" key={registration.id}>
            <div className="member-attendance-details">
              <span className={`history-check ${checkedIn ? 'history-done' : ''}`}>{checkedIn ? <Check size={15} /> : <CalendarDays size={15} />}</span>
              <div><b>{event?.title ?? 'Club event'}</b><small>{formatDate(registration.registeredAt)} · {checkedIn ? 'Attendance verified' : 'Registered · check-in pending'}</small></div>
              <StatusBadge status={checkedIn ? 'Attended' : registration.status} />
            </div>
            {!checkedIn && registration.status === 'Confirmed' && <RegistrationQr registration={registration} />}
          </article>
        })}
        {ownRegistrations.length === 0 && <EmptyState title="No event registrations yet" detail="Register for an event to see your check-in code and attendance history." />}
      </div>
    </div>
  </div>

  return <div className="section-page">
    <div className="attendance-callout"><div className="scan-mark"><QrCode size={24} /></div><div><b>QR-based attendance verification</b><small>Scan a participant QR and confirm once. Only active event registrations can be checked in.</small></div><button className="button button-primary" onClick={onScan}><ScanLine size={15} /> Open scanner</button></div>
    <div className="metric-grid metric-grid-3">
      <Metric icon={Users} label="Registered" value={String(registered)} detail="Across active events" tone="blue" />
      <Metric icon={CheckCircle2} label="Checked in" value={String(attended)} detail="Verified attendance records" tone="green" />
      <Metric icon={Activity} label="Average attendance" value={`${Math.round(attended / Math.max(registered, 1) * 100)}%`} detail="From current registrations" tone="peach" />
    </div>
    <div className="panel event-table-panel">
      <PanelHeading title="Attendance records" />
      <div className="table-scroll"><table className="data-table"><thead><tr><th>EVENT</th><th>PARTICIPANT</th><th>DATE</th><th>CHECK-IN TIME</th><th>STATUS</th></tr></thead><tbody>{attendance.map((record) => <tr key={record.id}><td><b>{events.find((event) => event.id === record.eventId)?.title ?? 'Club event'}</b></td><td>{record.memberName}</td><td>{formatDate(record.date, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td>{record.checkInTime}</td><td><StatusBadge status="Verified" /></td></tr>)}</tbody></table></div>
      {attendance.length === 0 && <EmptyState title="No attendance recorded yet" detail="Verified participant check-ins will appear here." />}
    </div>
  </div>
}

function RegistrationQr({ registration }: { registration: Registration }) {
  const [image, setImage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(`BIMCLUB:${registration.id}`, { width: 180, margin: 1 }))
      .then((dataUrl) => {
        if (active) setImage(dataUrl)
      })
      .catch((qrError: unknown) => {
        if (active) setError(qrError instanceof Error ? qrError.message : 'Unable to generate this check-in code.')
      })
    return () => {
      active = false
    }
  }, [registration.id])

  return <div className="member-registration-qr">
    <div><b>Event check-in QR</b><small>Show this code to event staff</small></div>
    {image ? <img src={image} alt={`Check-in QR for ${registration.name}`} /> : <span role="status">{error || 'Generating QR code…'}</span>}
  </div>
}
function FilesPage({ role, files, onUpload, onPreview, onDownload, onDelete }: {
  role: Role
  files: ClubFile[]
  onUpload: (file: File) => Promise<void>
  onPreview: (file: ClubFile) => Promise<Blob>
  onDownload: (file: ClubFile) => Promise<void>
  onDelete: (file: ClubFile) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All categories')
  const [preview, setPreview] = useState<{
    file: ClubFile
    url?: string
    text?: string
    sheets?: SpreadsheetSheet[]
    selectedSheet?: string
  } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const filtered = files.filter((file) =>
    `${file.name} ${file.type} ${file.category} ${file.uploadedBy}`.toLowerCase().includes(query.toLowerCase())
    && (category === 'All categories' || file.category === category))

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url)
  }, [preview])

  const viewFile = async (file: ClubFile) => {
    setError('')
    setBusy(file.id)
    try {
      const blob = await onPreview(file)
      if (file.type.toUpperCase() === 'DOCX') {
        const JSZip = (await import('jszip')).default
        const zip = await JSZip.loadAsync(await blob.arrayBuffer())
        const documentFile = zip.file('word/document.xml')
        if (!documentFile) throw new Error('The DOCX document contents could not be found.')
        const documentXml = await documentFile.async('text')
        const parsedDocument = new DOMParser().parseFromString(documentXml, 'application/xml')
        if (parsedDocument.querySelector('parsererror')) throw new Error('This DOCX document could not be read.')
        const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
        const text = Array.from(parsedDocument.getElementsByTagNameNS(wordNamespace, 'p'))
          .map((paragraph) => Array.from(paragraph.getElementsByTagNameNS(wordNamespace, 't'))
            .map((node) => node.textContent ?? '')
            .join(''))
          .join('\n')
        setPreview({ file, text })
      } else if (file.type.toUpperCase() === 'XLSX') {
        const ExcelJS = (await import('exceljs')).default
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(await blob.arrayBuffer())
        const sheets: SpreadsheetSheet[] = workbook.worksheets.map((worksheet) => {
          const rows: string[][] = []
          let truncated = false
          worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber > 200) {
              truncated = true
              return
            }
            const values = Array.from(
              { length: Math.min(worksheet.columnCount, 30) },
              (_, index) => row.getCell(index + 1).text,
            )
            rows.push(values)
          })
          return { name: worksheet.name, rows, truncated }
        })
        setPreview({ file, sheets, selectedSheet: sheets[0]?.name })
      } else {
        setPreview({ file, url: URL.createObjectURL(blob) })
      }
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Unable to preview this file.')
    } finally {
      setBusy('')
    }
  }
  const downloadFile = async (file: ClubFile) => {
    setError('')
    setBusy(file.id)
    try {
      await onDownload(file)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download this file.')
    } finally {
      setBusy('')
    }
  }
  const deleteFile = async (file: ClubFile) => {
    if (role !== 'Admin' || !window.confirm(`Permanently delete "${file.name}"? This cannot be undone.`)) return
    setError('')
    setBusy(file.id)
    try {
      await onDelete(file)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this file.')
    } finally {
      setBusy('')
    }
  }
  const selectedSheet = preview?.sheets?.find((sheet) => sheet.name === preview.selectedSheet) ?? preview?.sheets?.[0]

  return <div className="section-page">
    <div className="list-toolbar">
      <SearchField value={query} onChange={setQuery} placeholder="Search files" />
      <SelectField value={category} onChange={setCategory} options={['All categories', 'Notices', 'Event Documents', 'Club Guidelines', 'Reports', 'Other']} icon={<Filter size={15} />} />
      <span className="result-count">{filtered.length} files</span>
      {role !== 'Participant' && <label className={`button button-primary file-upload-button ${busy === 'upload' ? 'button-disabled' : ''}`}>
        <Upload size={15} /> {busy === 'upload' ? 'Uploading…' : 'Upload file'}
        <input type="file" disabled={busy === 'upload'} onChange={(event) => {
          const selected = event.target.files?.[0]
          event.currentTarget.value = ''
          if (!selected) return
          setBusy('upload')
          setError('')
          void onUpload(selected).catch((uploadError: unknown) => {
            setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload this file.')
          }).finally(() => setBusy(''))
        }} />
      </label>}
    </div>
    {error && <div className="event-data-error" role="alert"><span><b>File action failed.</b><small>{error}</small></span></div>}
    <div className="panel file-table-panel">
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>FILE NAME</th><th>FILE TYPE</th><th>CATEGORY</th><th>UPLOAD DATE</th><th>UPLOADED BY</th><th>ACTIONS</th></tr></thead>
        <tbody>{filtered.map((file) => <tr key={file.id}>
          <td><div className="file-cell"><span className="file-icon file-green"><FileText size={17} /></span><span><button className="file-name-preview" title={`Preview ${file.name}`} disabled={busy === file.id} onClick={() => void viewFile(file)}>{file.name}</button><small>{file.size} · Click to preview</small></span></div></td>
          <td>{file.type}</td><td><span className="folder-label">{file.category}</span></td>
          <td>{formatDate(file.uploadDate, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td>{file.uploadedBy}</td>
          <td><div className="table-actions">
            <button className="icon-button" aria-label={`View ${file.name}`} title="Preview file" disabled={busy === file.id} onClick={() => void viewFile(file)}><Eye size={15} /></button>
            <button className="icon-button" aria-label={`Download ${file.name}`} disabled={busy === file.id} onClick={() => void downloadFile(file)}><ArrowDownToLine size={15} /></button>
            {role === 'Admin' && <button className="icon-button file-delete-button" aria-label={`Delete ${file.name}`} title="Delete file" disabled={busy === file.id} onClick={() => void deleteFile(file)}><Trash2 size={15} /></button>}
          </div></td>
        </tr>)}</tbody>
      </table></div>
      {filtered.length === 0 && <EmptyState title={files.length === 0 ? 'No files uploaded yet' : 'No files match'} detail={files.length === 0 ? 'Files uploaded by club staff will appear here.' : 'Try another search or category.'} />}
    </div>
    <div className="storage-note"><ShieldCheck size={15} /> Club files are shared with current BIM Club members.</div>
    {preview && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setPreview(null)
    }}>
      <section className="modal file-preview-modal" role="dialog" aria-modal="true" aria-labelledby="file-preview-title">
        <div className="modal-heading"><div><span className="eyebrow">CLUB FILE</span><h2 id="file-preview-title">{preview.file.name}</h2></div><button className="icon-button" aria-label="Close preview" onClick={() => setPreview(null)}><X size={19} /></button></div>
        <div className="file-preview-content">
          {preview.sheets
            ? <div className="file-spreadsheet-preview">
              <div className="file-sheet-tabs" role="tablist" aria-label="Worksheet tabs">
                {preview.sheets.map((sheet) => <button key={sheet.name} role="tab" aria-selected={sheet.name === selectedSheet?.name} onClick={() => setPreview((current) => current ? { ...current, selectedSheet: sheet.name } : current)}>{sheet.name}</button>)}
              </div>
              {selectedSheet && <div className="table-scroll"><table className="data-table"><tbody>
                {selectedSheet.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, columnIndex) => <td key={columnIndex}>{value}</td>)}</tr>)}
              </tbody></table></div>}
              {selectedSheet?.truncated && <p className="file-preview-limit">Showing the first 200 rows and 30 columns.</p>}
              {selectedSheet?.rows.length === 0 && <EmptyState title="This worksheet is empty" detail="No cell data is available to preview." />}
            </div>
            : preview.text !== undefined
            ? <pre className="file-preview-text">{preview.text || 'This document does not contain readable text.'}</pre>
            : preview.file.mimeType.startsWith('image/')
            ? <img src={preview.url} alt={preview.file.name} />
            : preview.file.mimeType === 'application/pdf' || preview.file.mimeType.startsWith('text/') || preview.file.mimeType === 'application/json' || preview.file.mimeType === 'text/csv'
              ? <iframe src={preview.url} title={`Preview of ${preview.file.name}`} />
              : <div className="file-preview-unavailable"><FileText size={32} /><b>Preview is not available for this file type.</b><span>Download the file to open it with a compatible application.</span><button className="button button-primary" onClick={() => void downloadFile(preview.file)}><ArrowDownToLine size={15} /> Download file</button></div>}
        </div>
      </section>
    </div>}
  </div>
}
function DonationsPage({ role, donations, onAdd }: { role: Role; donations: Donation[]; onAdd: () => void }) { const total = donations.filter((item) => item.status === 'Received').reduce((sum, item) => sum + item.amount, 0); return <div className="section-page"><div className="donation-summary"><div><span className="eyebrow">COMMUNITY SUPPORT</span><div className="donation-total">{formatMoney(total)}</div><p>Recorded support for BIM Club activities.</p></div><div className="donation-summary-icon"><Heart size={32} strokeWidth={1.3} /></div></div><div className="metric-grid metric-grid-3"><Metric icon={CircleDollarSign} label="Total received" value={formatMoney(total)} detail="Confirmed donations" tone="green" /><Metric icon={Users} label="Contributors" value={String(donations.length)} detail="Live donation records" tone="blue" /><Metric icon={CreditCard} label="Pending" value={formatMoney(donations.filter((item) => item.status === 'Pending').reduce((sum, item) => sum + item.amount, 0))} detail="Awaiting confirmation" tone="yellow" /></div><div className="panel event-table-panel"><div className="panel-heading panel-heading-padded"><h3>Donation ledger</h3>{role === 'Admin' && <button className="button button-quiet button-xs" onClick={onAdd}><Plus size={14} /> Add donation</button>}</div><div className="table-scroll"><table className="data-table"><thead><tr><th>CONTRIBUTOR</th><th>PURPOSE</th><th>DATE</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>{donations.map((item) => <tr key={item.id}><td><div className="member-cell"><span className="donor-avatar"><Heart size={14} /></span><span><b>{item.name}</b><small>BIM Club supporter</small></span></div></td><td>{item.purpose}</td><td>{formatDate(item.date, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td><b>{formatMoney(item.amount)}</b></td><td><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div></div><p className="disclaimer-note"><ShieldCheck size={14} /> Donation records are visible to club administrators and members.</p></div> }
function UsersPage({ members }: { members: Member[] }) { const [searchValue, setSearchValue] = useState(''); const filtered = members.filter((item) => `${item.name} ${item.email} ${item.role}`.toLowerCase().includes(searchValue.toLowerCase())); return <div className="section-page"><div className="list-toolbar"><SearchField value={searchValue} onChange={setSearchValue} placeholder="Search members" /><span className="result-count">{filtered.length} members</span></div><div className="panel event-table-panel"><div className="table-scroll"><table className="data-table"><thead><tr><th>MEMBER</th><th>ROLE</th><th>JOINED</th><th>CLUB POINTS</th><th>STATUS</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><MemberCell name={item.name} email={item.email} /></td><td><span className={`role-tag role-${item.role.toLowerCase()}`}>{item.role}</span></td><td>{formatDate(item.joined, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td><b>{item.points.toLocaleString()}</b> pts</td><td><StatusBadge status="Confirmed" /></td></tr>)}</tbody></table></div>{filtered.length === 0 && <EmptyState title="No members yet" detail="New members appear automatically after signup." />}</div></div> }
function ReportsPage({ events, registrations, donations, attendance }: {
  events: ClubEvent[]
  registrations: Registration[]
  donations: Donation[]
  attendance: AttendanceRecord[]
}) {
  const donationsRaised = donations.filter((item) => item.status === 'Received').reduce((sum, item) => sum + item.amount, 0)
  const eventRevenue = registrations.filter((item) => item.paidAmount != null && item.status !== 'Cancelled').reduce((sum, item) => sum + (item.paidAmount ?? 0), 0)
  const totalFunds = donationsRaised + eventRevenue
  const categories = [...new Set(events.map((event) => event.category))]
  return <div className="section-page">
    <div className="report-topline"><span>Live club records</span><button className="button button-quiet" onClick={() => window.print()}><ArrowDownToLine size={15} /> Export report</button></div>
    <div className="metric-grid metric-grid-4">
      <Metric icon={CalendarDays} label="Events hosted" value={String(events.length)} detail="In the live club calendar" tone="green" />
      <Metric icon={Users} label="Registrations" value={String(registrations.length)} detail={`${registrations.filter((r) => r.paidAmount != null).length} paid via eSewa`} tone="blue" />
      <Metric icon={CheckCircle2} label="Total attendance" value={String(attendance.length)} detail="Verified check-ins" tone="peach" />
      <Metric icon={CircleDollarSign} label="Total funds raised" value={formatMoney(totalFunds)} detail={`${formatMoney(eventRevenue)} tickets · ${formatMoney(donationsRaised)} donations`} tone="yellow" />
    </div>
    <div className="content-grid report-charts">
      <section className="panel chart-panel"><PanelHeading title="Monthly attendance" /><div className="chart-wrap"><AttendanceChart attendance={attendance} /></div></section>
      <section className="panel report-breakdown"><PanelHeading title="Event breakdown" /><div className="breakdown-list">
        {categories.map((label, index) => <div key={label}><span className={`breakdown-dot breakdown-${index % 4}`} /><span>{label}</span><b>{events.filter((event) => event.category === label).length}</b><small>events</small></div>)}
        {categories.length === 0 && <EmptyState title="No events yet" detail="Event categories will appear here." />}
      </div><div className="report-callout"><Sparkles size={15} /><span><b>Live report</b><small>Metrics reflect current club records.</small></span></div></section>
    </div>
  </div>
}
function LeaderboardPage({ members, currentMember }: { members: Member[]; currentMember: Member }) { return <div className="section-page leaderboard-page"><div className="leaderboard-banner"><div><span className="eyebrow">MEMBER RECOGNITION</span><h2>Showing up<br /><em>adds up.</em></h2><p>Points are earned by attending events and contributing to the club community.</p></div><div className="leaderboard-total"><TrendingUp size={20} /><b>{currentMember.points.toLocaleString()}</b><small>your club points</small></div></div><div className="panel leaderboard-table"><div className="panel-heading panel-heading-padded"><h3>Member leaderboard</h3><span className="result-count">Live points</span></div><div className="leader-list">{[...members].sort((a, b) => b.points - a.points).map((member, index) => <div className={`leader-row ${member.id === currentMember.id ? 'leader-current' : ''}`} key={member.id}><span className={`leader-rank ${index < 3 ? 'leader-rank-top' : ''}`}>{String(index + 1).padStart(2, '0')}</span><Avatar name={member.name} /><span className="leader-name"><b>{member.name}{member.id === currentMember.id && <small>YOU</small>}</b><small>{member.role === 'BOD' ? 'Board of Directors' : 'BIM Club member'}</small></span><span className="leader-points"><b>{member.points.toLocaleString()}</b><small>pts</small></span></div>)}</div></div></div> }
function ProfilePage({ member, role, photoUrl, photoBusy, photoError, onPhotoUpload, busy, onSignOut }: { member: Member; role: Role; photoUrl: string | null; photoBusy: boolean; photoError: string; onPhotoUpload: (file: File) => Promise<void>; busy: boolean; onSignOut: () => Promise<void> }) { return <div className="section-page profile-page"><div className="profile-cover"><div className="profile-avatar-wrap"><Avatar name={displayName(role, member)} size imageUrl={photoUrl} /><label className="profile-photo-trigger" aria-label="Upload profile photo" title="Upload profile photo"><Plus size={15} /><input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy} onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void onPhotoUpload(selected); event.currentTarget.value = '' }} /></label></div><span className="profile-member-since">MEMBER SINCE {formatDate(member.joined, { month: 'long', year: 'numeric' }).toUpperCase()}</span></div>{photoError && <div className="event-data-error profile-photo-error" role="alert"><span><b>Photo was not updated</b><small>{photoError}</small></span></div>}<div className="profile-details"><div className="profile-name-row"><div><h2>{displayName(role, member)}</h2><span className="role-tag role-participant">{role} · KIST College</span></div><button className="button button-quiet" disabled={busy} onClick={() => void onSignOut()}>{busy ? 'Signing out…' : 'Sign out'} <LogOut size={15} /></button></div><div className="profile-info-grid"><div><span>EMAIL</span><b>{member.email || 'No email on your account'}</b></div><div><span>MEMBERSHIP</span><b>BIM Club</b></div><div><span>CLUB POINTS</span><b>{member.points.toLocaleString()} points</b></div><div><span>ROLE</span><b>{role} account</b></div></div></div></div> }
function EventEditor({ event, form, setForm, saving, error, onClose, onSave }: { event: ClubEvent | null; form: EventForm; setForm: (form: EventForm) => void; saving: boolean; error: string; onClose: () => void; onSave: (form: EventForm) => Promise<void> }) {
  const update = (key: keyof EventForm, value: string | number | boolean) => setForm({ ...form, [key]: value })
  const updatePaid = (isPaid: boolean) => setForm({ ...form, isPaid, price: isPaid ? form.price : undefined })
  return <div className="modal-backdrop" role="presentation" onMouseDown={(click) => { if (click.target === click.currentTarget && !saving) onClose() }}>
    <div className="modal event-editor-modal" role="dialog" aria-modal="true" aria-labelledby="event-modal-title">
      <div className="modal-heading"><div><span className="eyebrow">EVENT MANAGEMENT</span><h2 id="event-modal-title">{event ? 'Edit event' : 'Create an event'}</h2></div><button className="icon-button" aria-label="Close" disabled={saving} onClick={onClose}><X size={19} /></button></div>
      <div className="modal-body">
        {error && <div className="auth-feedback auth-feedback-error" role="alert">Event was not saved: {error}</div>}
        <label className="form-label">Event title<input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Product Design Sprint" /></label>
        <label className="form-label">Description<textarea rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="What will participants learn or do?" /></label>
        <div className="form-grid-two"><label className="form-label">Date<input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} /></label><label className="form-label">Registration deadline<input type="date" value={form.registrationDeadline} onChange={(e) => update('registrationDeadline', e.target.value)} /></label></div>
        <div className="form-grid-two"><label className="form-label">Start time<input type="time" value={form.startTime} onChange={(e) => update('startTime', e.target.value)} /></label><label className="form-label">End time<input type="time" value={form.endTime} onChange={(e) => update('endTime', e.target.value)} /></label></div>
        <label className="form-label">Location<input value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="Venue or room" /></label>
        <div className="form-grid-two"><label className="form-label">Category<select value={form.category} onChange={(e) => update('category', e.target.value)}><option>Workshop</option><option>Design</option><option>Competition</option><option>Seminar</option><option>Community</option></select></label><label className="form-label">Maximum participants<input type="number" min="1" value={form.maxParticipants} onChange={(e) => update('maxParticipants', Number(e.target.value))} /></label></div>
        <div className="form-grid-two"><label className="form-label">Registration fee<select value={form.isPaid ? 'paid' : 'free'} onChange={(e) => updatePaid(e.target.value === 'paid')}><option value="free">Free</option><option value="paid">Paid</option></select></label>{form.isPaid && <label className="form-label">Fee (NPR)<input type="number" min="1" step="0.01" required value={form.price ?? ''} onChange={(e) => update('price', Number(e.target.value))} placeholder="e.g. 500" /></label>}</div>
        <div className="form-grid-two"><label className="form-label">Status<select value={form.status} onChange={(e) => update('status', e.target.value)}>{(['Draft', 'Published', 'Registration Open', 'Registration Closed', 'Completed', 'Cancelled'] as EventStatus[]).map((status) => <option key={status}>{status}</option>)}</select></label><label className="form-label">Image URL<input value={form.image} onChange={(e) => update('image', e.target.value)} placeholder="Optional image URL" /></label></div>
      </div>
      <div className="modal-footer"><button className="button button-quiet" disabled={saving} onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving} onClick={() => void onSave(form)}>{saving ? 'Saving…' : event ? 'Save changes' : 'Create event'} {!saving && <ArrowRight size={15} />}</button></div>
    </div>
  </div>
}
function DonationEditor({ onClose, onSave, role, memberName }: {
  onClose: () => void
  onSave: (donation: Omit<Donation, 'id' | 'date' | 'status'>) => Promise<void>
  role: Role
  memberName: string
}) {
  const [name, setName] = useState(role === 'Participant' ? memberName : '')
  const [purpose, setPurpose] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isFormReady = Boolean(purpose.trim()) && Boolean(amount) && Number(amount) > 0 && (role === 'Participant' || name.trim())

  const submit = async () => {
    setSaving(true)
    setError('')
    try {
      await onSave({ name: role === 'Participant' ? memberName : name, purpose, amount: Number(amount) })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this donation.')
    } finally {
      setSaving(false)
    }
  }

  const payWithEsewa = async () => {
    try {
      if (!isFormReady) {
        setError('Enter the contributor, purpose, and amount before opening eSewa.')
        return
      }
      if (!hasEsewaConfig) {
        setError('Set VITE_ESEWA_MERCHANT_CODE and the callback URLs in .env.local before using the eSewa payment flow.')
        return
      }

      await submitEsewaPayment({
        amount: Number(amount),
        purpose: purpose.trim(),
        donorName: role === 'Participant' ? memberName : name.trim(),
        merchantCode: import.meta.env.VITE_ESEWA_MERCHANT_CODE,
        productCode: import.meta.env.VITE_ESEWA_PRODUCT_CODE,
        successUrl: import.meta.env.VITE_ESEWA_SUCCESS_URL,
        failureUrl: import.meta.env.VITE_ESEWA_FAILURE_URL,
      })
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Unable to start the eSewa payment flow.')
    }
  }

  return <div className="modal-backdrop" role="presentation">
    <div className="modal donation-editor-modal" role="dialog" aria-modal="true" aria-labelledby="donation-modal-title">
      <div className="modal-heading"><div><span className="eyebrow">CLUB FINANCE</span><h2 id="donation-modal-title">{role === 'Participant' ? 'Make a contribution' : 'Add donation'}</h2></div><button className="icon-button" aria-label="Close" disabled={saving} onClick={onClose}><X size={19} /></button></div>
      <div className="modal-body">
        {role !== 'Participant' && <label className="form-label">Contributor<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name or organization" /></label>}
        <label className="form-label">Purpose<input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Club support" /></label>
        <label className="form-label">Amount (NPR)<input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></label>
        {error && <div className="event-data-error" role="alert">{error}</div>}
      </div>
      <div className="modal-footer">
        <button className="button button-quiet" disabled={saving} onClick={onClose}>Cancel</button>
        <button className="button button-quiet" disabled={saving || !isFormReady} onClick={() => void payWithEsewa()}>Pay with eSewa</button>
        <button className="button button-primary" disabled={saving || !isFormReady} onClick={() => void submit()}>{saving ? 'Saving…' : 'Save donation'} <Check size={15} /></button>
      </div>
    </div>
  </div>
}
function EmptyState({ title, detail, action, onAction }: { title: string; detail: string; action?: string; onAction?: () => void }) { return <div className="empty-state"><span><CalendarDays size={20} /></span><b>{title}</b><p>{detail}</p>{action && onAction && <button className="text-link" onClick={onAction}>{action} <ArrowRight size={14} /></button>}</div> }

export default App
