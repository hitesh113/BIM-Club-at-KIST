import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, Bell, CalendarDays,
  Check, CheckCircle2, ChevronDown, ChevronLeft, Clock, CreditCard, FileText,
  Filter, Heart, LayoutDashboard, LogOut, MapPin, Menu, Plus, QrCode, Search,
  Settings2, ShieldCheck, Sparkles, TrendingUp, Users, Wallet, X, Upload,
  CircleDollarSign, GraduationCap, ChartNoAxesCombined, ClipboardList, Building2,
  ScanLine, BookOpen, Handshake, UserPlus, Globe,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { mockClubRepository } from './services/clubRepository'
import type { ActivityLogEntry, AttendanceRecord, ClubEvent, ClubFile, Donation, EventStatus, Member, Notification, Registration, Role } from './types'
import './App.css'

type Page = 'home' | 'about' | 'events' | 'event-detail' | 'login' | 'register' | 'dashboard' | 'manage-events' | 'registrations' | 'attendance' | 'files' | 'donations' | 'users' | 'reports' | 'leaderboard' | 'notifications' | 'activity' | 'profile'
type EventForm = Omit<ClubEvent, 'id'>

const memberId = 'member-100'
const blankEvent: EventForm = {
  title: '', description: '', date: '2026-11-21', startTime: '10:00', endTime: '13:00',
  location: 'KIST College of Management', category: 'Workshop', image: '',
  maxParticipants: 50, registrationDeadline: '2026-11-18', status: 'Draft',
}
const pageTitles: Record<Page, string> = {
  home: 'Welcome to BIM Club', about: 'About the club', events: 'Events', 'event-detail': 'Event details',
  login: 'Welcome back', register: 'Join the club', dashboard: 'Overview', 'manage-events': 'Manage events',
  registrations: 'Registrations', attendance: 'Attendance', files: 'Club files', donations: 'Donations',
  users: 'Members & users', reports: 'Reports', leaderboard: 'Leaderboard', notifications: 'Notifications', activity: 'Activity log', profile: 'My profile',
}
const chartData = [
  { month: 'May', attendees: 46 }, { month: 'Jun', attendees: 68 }, { month: 'Jul', attendees: 55 },
  { month: 'Aug', attendees: 92 }, { month: 'Sep', attendees: 74 }, { month: 'Oct', attendees: 118 },
]
const bodMembers = [
  { name: 'Shishir Joshi', position: 'President', image: '' },
  { name: 'Aliza Aryal', position: 'Vice President', image: '' },
  { name: 'Shreesha Mahat', position: 'Secretary', image: '' },
  { name: 'Sadhana Kushma', position: 'Treasurer', image: '' },
  { name: 'Rajiv Shrestha', position: 'Technical Coordinator', image: '' },
  { name: 'Dhirendra Singh Dhami', position: 'Event Coordinator', image: '' },
  { name: 'Bandana Kharel', position: 'PR & Marketing Coordinator', image: '' },
  { name: 'Kabir Jung Tharu', position: 'Training Coordinator', image: '' },
  { name: 'Aayush Basnet', position: 'Research & Development Coordinator', image: '' },
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

function App() {
  const [snapshot] = useState(() => mockClubRepository.loadSnapshot())
  const [page, setPage] = useState<Page>('home')
  const [role, setRole] = useState<Role | null>(null)
  const [events, setEvents] = useState(snapshot.events)
  const [registrations, setRegistrations] = useState(snapshot.registrations)
  const [donations, setDonations] = useState(snapshot.donations)
  const [members, setMembers] = useState(snapshot.members)
  const [attendance, setAttendance] = useState(snapshot.attendance)
  const [files, setFiles] = useState(snapshot.files)
  const [notifications, setNotifications] = useState(snapshot.notifications)
  const [activityLog, setActivityLog] = useState(snapshot.activityLog)
  const [selectedId, setSelectedId] = useState('evt-101')
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
  const [roleChoice, setRoleChoice] = useState<Role>('Participant')
  const [scannerOpen, setScannerOpen] = useState(false)

  const currentMember = members.find((member) => member.id === memberId) ?? snapshot.members[0]
  const myRegistrations = registrations.filter((registration) => registration.memberId === memberId && registration.status !== 'Cancelled')
  const selectedEvent = events.find((event) => event.id === selectedId)
  const filteredEvents = useMemo(() => events.filter((event) => {
    const textMatch = `${event.title} ${event.location} ${event.category}`.toLowerCase().includes(search.toLowerCase())
    return textMatch && (category === 'All categories' || category === event.category) && (statusFilter === 'All statuses' || statusFilter === event.status)
  }), [events, search, category, statusFilter])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3000)
  }
  const addActivity = (user: string, action: string) => setActivityLog((items) => [{ id: `log-${Date.now()}`, user, action, timestamp: 'Just now' }, ...items])
  const addNotification = (item: Omit<Notification, 'id' | 'read'>) => setNotifications((items) => [{ ...item, id: `note-${Date.now()}`, read: false }, ...items])
  const markNotificationsRead = () => setNotifications((items) => items.map((item) => item.recipient === 'All' || item.recipient === role ? { ...item, read: true } : item))
  const navigate = (target: Page) => {
    setPage(target)
    setMenuOpen(false)
    setNotificationOpen(false)
    setProfileOpen(false)
  }
  const signIn = (nextRole: Role) => {
    setRole(nextRole)
    setRoleChoice(nextRole)
    navigate('dashboard')
    notify(`Signed in as ${nextRole}`)
  }
  const signOut = () => {
    setRole(null)
    navigate('home')
    notify('You have been signed out')
  }
  const openEvent = (id: string) => {
    setSelectedId(id)
    navigate('event-detail')
  }
  const startEventEditor = (event?: ClubEvent) => {
    setEditingEvent(event ?? null)
    setEventForm(event ? { ...event } : blankEvent)
    setEventModal(true)
  }
  const saveEvent = (form: EventForm) => {
    if (!form.title.trim()) return notify('Add an event title before saving')
    if (editingEvent) {
      setEvents((items) => items.map((item) => item.id === editingEvent.id ? { ...form, id: item.id, image: form.image || item.image } : item))
      notify('Event changes saved')
    } else {
      setEvents((items) => [{ ...form, id: `evt-${Date.now()}`, image: form.image || snapshot.events[0].image }, ...items])
      notify('Event created as a draft')
    }
    setEventModal(false)
    setEditingEvent(null)
  }
  const setEventStatus = (id: string, status: EventStatus) => {
    setEvents((items) => items.map((event) => event.id === id ? { ...event, status } : event))
    notify(`Event marked ${status.toLowerCase()}`)
  }
  const register = (event: ClubEvent) => {
    const count = registrations.filter((item) => item.eventId === event.id && item.status !== 'Cancelled').length
    if (event.status !== 'Registration Open' || count >= event.maxParticipants || event.registrationDeadline < '2026-10-05') return notify('Registration is closed or this event is full')
    if (myRegistrations.some((item) => item.eventId === event.id)) return notify('You are already registered for this event')
    setRegistrations((items) => [{
      id: `reg-${Date.now()}`, eventId: event.id, memberId, name: currentMember.name,
      email: currentMember.email, registeredAt: '2026-10-05', status: 'Confirmed',
    }, ...items])
    addNotification({ title: 'Event registration successful', detail: `You are registered for ${event.title}.`, timestamp: 'Just now', recipient: 'Participant' })
    addActivity(currentMember.name, `Participant registered for ${event.title}`)
    notify(`You're registered for ${event.title}`)
  }
  const cancelRegistration = (id: string) => {
    setRegistrations((items) => items.map((item) => item.memberId === memberId && item.eventId === id ? { ...item, status: 'Cancelled' } : item))
    notify('Registration cancelled')
  }

  const publicMode = !role
  return <div className="app-shell">
    {publicMode ? <PublicHeader page={page} onNavigate={navigate} onSignIn={() => navigate('login')} /> : <>
      {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <button className="brand brand-sidebar" onClick={() => navigate('dashboard')}><span className="brand-mark"><GraduationCap size={21} /></span><span className="brand-copy"><strong>BIM<span>club</span></strong><small>KIST COLLEGE OF MANAGEMENT</small></span></button>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Dashboard navigation">{navigation[role].map(({ label, page: target, icon: Icon }) => <button key={label} className={`side-link ${page === target ? 'side-link-active' : ''}`} onClick={() => navigate(target)}><Icon size={17} /><span>{label}</span>{label === 'Registrations' && <i className="nav-count">6</i>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="semester-card"><span className="semester-icon"><Building2 size={15} /></span><div><b>Fall semester</b><small>2026 · KIST College</small></div><ChevronDown size={14} /></div><div className="sidebar-user"><Avatar name={displayName(role, currentMember)} /><div><b>{displayName(role, currentMember)}</b><small>{role} account</small></div><button className="icon-button" aria-label="Open profile" onClick={() => navigate('profile')}><Settings2 size={16} /></button></div></div>
      </aside>
      <div className="main-column">
        <header className="app-header"><button className="icon-button mobile-menu-button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={20} /></button><div className="breadcrumb"><span>Workspace</span><ChevronLeft size={14} /><b>{pageTitles[page]}</b></div><div className="header-actions"><button className="icon-button header-search" aria-label="Search events" onClick={() => { navigate(role === 'Participant' ? 'events' : 'manage-events'); setSearch('') }}><Search size={18} /></button><div className="popover-anchor"><button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotificationOpen(!notificationOpen)}><Bell size={18} /><i /></button>{notificationOpen && <div className="popover notification-popover"><div className="popover-title">Notifications <span>2 new</span></div><p><b>Workshop registrations are open</b><small>Web Development Workshop · 2h ago</small></p><p><b>New donation received</b><small>NPR 1,500 from Aarav · Yesterday</small></p></div>}</div><div className="popover-anchor"><button className="header-profile" onClick={() => setProfileOpen(!profileOpen)}><Avatar name={displayName(role, currentMember)} /><span>{shortName(role, currentMember)}</span><ChevronDown size={14} /></button>{profileOpen && <div className="popover profile-popover"><div className="popover-title">Switch demo role</div>{(['Admin', 'BOD', 'Participant'] as Role[]).map((item) => <button key={item} onClick={() => signIn(item)}>{item}{item === role && <Check size={14} />}</button>)}<button className="signout-option" onClick={signOut}><LogOut size={14} /> Sign out</button></div>}</div></div></header>
        <main className="page-content"><PageHeading page={page} role={role} onCreate={() => startEventEditor()} onNavigate={navigate} />{renderContent()}</main>
      </div>
    </>}
    {publicMode && <main className="public-main">{renderContent()}</main>}
    {eventModal && <EventEditor event={editingEvent} form={eventForm} setForm={setEventForm} onClose={() => setEventModal(false)} onSave={saveEvent} />}
    {donationModal && <DonationEditor onClose={() => setDonationModal(false)} onSave={(donation) => { setDonations((items) => [donation, ...items]); addActivity(currentMember.name, `${role} recorded a contribution of ${formatMoney(donation.amount)}`); addNotification({ title: 'Donation successful', detail: `${formatMoney(donation.amount)} contribution recorded.`, timestamp: 'Just now', recipient: role === 'Participant' ? 'Participant' : 'All' }); setDonationModal(false); notify('Contribution recorded in the demo ledger') }} />}
    {scannerOpen && <AttendanceScanner events={events} registrations={registrations} attendance={attendance} onClose={() => setScannerOpen(false)} onConfirm={(record) => { setAttendance((items) => [...items, record]); setRegistrations((items) => items.map((item) => item.id === record.registrationId ? { ...item, status: 'Attended' } : item)); setMembers((items) => items.map((item) => item.id === record.memberId ? { ...item, points: item.points + 100 } : item)); addActivity(role === 'BOD' ? 'Sujan Karki' : 'Maya Adhikari', `BOD recorded attendance for ${record.memberName}`); addNotification({ title: 'Attendance recorded', detail: `${record.memberName} was checked in through QR-based attendance verification.`, timestamp: 'Just now', recipient: 'All' }); setScannerOpen(false); notify('Attendance recorded') }} />}
    {toast && <div className="toast"><span><Check size={15} /></span>{toast}</div>}
  </div>

  function renderContent() {
    if (!role) {
      if (page === 'about') return <AboutPage events={events} members={members} registrations={registrations} onNavigate={navigate} />
      if (page === 'events') return <EventsPage events={filteredEvents} search={search} setSearch={setSearch} category={category} setCategory={setCategory} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onEvent={openEvent} onNavigate={navigate} />
      if (page === 'event-detail') return <EventDetails event={selectedEvent} registrations={registrations} onBack={() => navigate('events')} onRegister={() => navigate('login')} />
      if (page === 'login' || page === 'register') return <AuthPage mode={page} roleChoice={roleChoice} setRoleChoice={setRoleChoice} onSignIn={signIn} onNavigate={navigate} />
      return <LandingPage events={events} onNavigate={navigate} onEvent={openEvent} />
    }
    const countFor = (id: string) => registrations.filter((item) => item.eventId === id && item.status !== 'Cancelled').length
    if (page === 'dashboard') return <Dashboard role={role} events={events} registrations={registrations} donations={donations} myRegistrations={myRegistrations} onNavigate={navigate} onCreate={() => startEventEditor()} onEvent={openEvent} />
    if (page === 'events') return <EventsPage events={filteredEvents} search={search} setSearch={setSearch} category={category} setCategory={setCategory} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onEvent={openEvent} onNavigate={navigate} />
    if (page === 'event-detail') return <EventDetails event={selectedEvent} registrations={registrations} isRegistered={myRegistrations.some((item) => item.eventId === selectedEvent?.id)} onBack={() => navigate(role === 'Participant' ? 'events' : 'manage-events')} onRegister={() => selectedEvent && register(selectedEvent)} onCancel={() => selectedEvent && cancelRegistration(selectedEvent.id)} />
    if (page === 'manage-events') return <ManageEvents events={filteredEvents} countFor={countFor} search={search} setSearch={setSearch} category={category} setCategory={setCategory} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onEdit={startEventEditor} onCreate={() => startEventEditor()} onEvent={openEvent} onStatus={setEventStatus} />
    if (page === 'registrations') return <RegistrationsPage events={events} registrations={registrations} query={query} setQuery={setQuery} onAttendance={(id) => { setRegistrations((items) => items.map((item) => item.id === id ? { ...item, status: 'Attended' } : item)); notify('Attendance recorded') }} />
    if (page === 'attendance') return <AttendancePage role={role} registrations={registrations} attendance={attendance} events={events} onScan={() => setScannerOpen(true)} />
    if (page === 'files') return <FilesPage role={role} files={files} onUpload={(file) => { setFiles((items) => [file, ...items]); addActivity(role === 'BOD' ? 'Sujan Karki' : 'Maya Adhikari', `${role} uploaded ${file.name}`); notify('File added to club files') }} onDownload={() => notify('Download prepared for this demo file')} />
    if (page === 'donations' && role === 'Participant') return <ParticipantDonationsPage donations={donations} onContribute={() => setDonationModal(true)} />
    if (page === 'donations') return <DonationsPage role={role} donations={donations} onAdd={() => setDonationModal(true)} />
    if (page === 'users') return <UsersPage members={members} setMembers={setMembers} onAdded={() => notify('Demo member added')} />
    if (page === 'reports') return <ReportsPage events={events} registrations={registrations} donations={donations} />
    if (page === 'leaderboard') return <LeaderboardPage members={members} currentMember={currentMember} />
    if (page === 'notifications') return <NotificationsPage notifications={notifications.filter((item) => item.recipient === 'All' || item.recipient === role)} onRead={markNotificationsRead} />
    if (page === 'activity') return <ActivityLogPage entries={activityLog} />
    if (page === 'profile') return <ProfilePage member={currentMember} role={role} onRole={signIn} onSignOut={signOut} />
    if (page === 'about') return <AboutPage events={events} members={members} registrations={registrations} onNavigate={navigate} />
    return <LandingPage events={events} onNavigate={navigate} onEvent={openEvent} />
  }
}

function displayName(role: Role | null, member: Member) { return role === 'Admin' ? 'Maya Adhikari' : role === 'BOD' ? 'Sujan Karki' : member.name }
function shortName(role: Role | null, member: Member) { return role === 'Admin' ? 'Maya A.' : role === 'BOD' ? 'Sujan K.' : `${member.name.split(' ')[0]} ${member.name.split(' ')[1][0]}.` }
function Avatar({ name, size = false }: { name: string; size?: boolean }) { const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2); return <span className={`avatar avatar-${initials.toLowerCase()} ${size ? 'avatar-large' : ''}`}>{initials}</span> }
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
    <div className="footer-bottom"><span>© 2026 BIM Club, KIST College of Management. All rights reserved.</span></div>
  </footer>
}
function LandingPage({ events, onNavigate, onEvent }: { events: ClubEvent[]; onNavigate: (page: Page) => void; onEvent: (id: string) => void }) {
  const upcoming = events.filter((event) => event.date >= '2026-10-05' && event.status !== 'Cancelled').slice(0, 3)
  return <div className="landing-page">
    <section className="landing-hero"><div className="hero-copy"><div className="eyebrow hero-eyebrow"><span className="eyebrow-dot" /> KIST COLLEGE OF MANAGEMENT · SINCE 2011</div><h1>Curious minds.<br /><em>Built together.</em></h1><p>We’re the BIM students building ideas, learning by doing, and making campus a little more connected.</p><div className="hero-actions"><button className="button button-lime" onClick={() => onNavigate('events')}>Explore events <ArrowRight size={16} /></button><button className="button button-outline-light" onClick={() => onNavigate('about')}>Get to know us</button></div><div className="hero-footnote"><span><Users size={15} /> 240+ members</span><span><CalendarDays size={15} /> 18 events this year</span></div></div><div className="hero-visual"><img src={events[0]?.image} alt="Students collaborating at a workshop" /><div className="hero-image-tag"><span className="tag-icon"><Sparkles size={16} /></span><div><b>Make room for ideas.</b><small>Learn together, build together.</small></div><ArrowUpRight size={17} /></div><div className="hero-photo-caption">A COMMUNITY FOR WHAT’S NEXT <span>01 / 03</span></div></div><div className="hero-index">01 <span>—</span> 03</div></section>
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
function PublicBackHome({ onNavigate }: { onNavigate: (page: Page) => void }) { return <button className="button button-quiet public-back-home" onClick={() => onNavigate('home')}><ChevronLeft size={15} /> Back to home</button> }
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
          <div className="public-page-action"><PublicBackHome onNavigate={onNavigate} /></div>
          <div className="eyebrow hero-eyebrow"><span className="eyebrow-dot" /> KIST COLLEGE OF MANAGEMENT</div>
          <h1>About BIM Club</h1>
          <h2>BIM Club, KIST College of Management</h2>
          <p>A student community for exploring technology, business, and new ideas through events, practical learning, and collaboration.</p>
          <div className="hero-actions">
            <button className="button button-lime" onClick={() => onNavigate('events')}>Explore Events <ArrowRight size={16} /></button>
            <button className="button button-outline-light" onClick={() => onNavigate('register')}>Join the Club</button>
          </div>
        </div>
        <div className="about-modern-image">
          <img src="https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=85" alt="Students talking and sharing ideas around a table" />
          <div className="about-image-caption"><span className="about-image-icon"><GraduationCap size={17} /></span><span><b>Learn together.</b><small>Find your next way to take part.</small></span></div>
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
function EventsPage({ events, search, setSearch, category, setCategory, statusFilter, setStatusFilter, onEvent, onNavigate }: { events: ClubEvent[]; search: string; setSearch: (value: string) => void; category: string; setCategory: (value: string) => void; statusFilter: string; setStatusFilter: (value: string) => void; onEvent: (id: string) => void; onNavigate: (page: Page) => void }) {
  return <div className="events-page"><div className="events-intro"><div className="public-page-action"><PublicBackHome onNavigate={onNavigate} /></div><div className="eyebrow">MAKE SOMETHING OF YOUR SEMESTER</div><h1>Events that take<br /><em>you somewhere.</em></h1><p>Workshops, conversations, and the occasional friendly competition. There’s a seat for you.</p></div><div className="filter-bar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search events" /></label><label className="select-field"><Filter size={15} /><select value={category} onChange={(event) => setCategory(event.target.value)}><option>All categories</option><option>Workshop</option><option>Design</option><option>Competition</option><option>Seminar</option><option>Community</option></select><ChevronDown size={14} /></label><label className="select-field"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option><option>Registration Open</option><option>Published</option><option>Completed</option></select><ChevronDown size={14} /></label><span className="result-count">{events.length} events</span></div><div className="public-event-grid events-grid-list">{events.map((event, index) => <PublicEventCard key={event.id} event={event} index={index} onClick={() => onEvent(event.id)} />)}</div>{events.length === 0 && <EmptyState title="No events match those filters" detail="Try changing your search or category." />}</div>
}
function EventDetails({ event, registrations, isRegistered = false, onBack, onRegister, onCancel }: { event?: ClubEvent; registrations: Registration[]; isRegistered?: boolean; onBack: () => void; onRegister: () => void; onCancel?: () => void }) {
  if (!event) return <EmptyState title="Event not found" detail="This event may have been removed." />
  const count = registrations.filter((item) => item.eventId === event.id && item.status !== 'Cancelled').length
  const available = Math.max(0, event.maxParticipants - count)
  const open = event.status === 'Registration Open' && available > 0 && event.registrationDeadline >= '2026-10-05'
  return <div className="detail-page"><button className="back-link" onClick={onBack}><ChevronLeft size={15} /> Back to events</button><div className="detail-layout"><div className="detail-main"><div className="detail-image"><img src={event.image} alt="" /><span className="category-pill">{event.category}</span></div><div className="detail-kicker"><StatusBadge status={event.status} /> <span>·</span> {formatDate(event.date, { month: 'long', day: 'numeric', year: 'numeric' })}</div><h1>{event.title}</h1><p className="detail-description">{event.description}</p><div className="detail-facts"><div><CalendarDays size={18} /><span><small>DATE & TIME</small><b>{formatDate(event.date, { weekday: 'long', month: 'long', day: 'numeric' })}</b><span>{event.startTime} – {event.endTime}</span></span></div><div><MapPin size={18} /><span><small>LOCATION</small><b>{event.location}</b><span>Kathmandu, Nepal</span></span></div><div><Users size={18} /><span><small>CAPACITY</small><b>{event.maxParticipants} seats</b><span>Registration closes {formatDate(event.registrationDeadline, { month: 'long', day: 'numeric' })}</span></span></div></div><div className="detail-about"><h2>About this event</h2><p>{event.description} Bring your laptop, your questions, and an open mind. All BIM students are welcome; no prior experience is needed.</p></div></div><aside className="registration-card"><div className="eyebrow">SAVE YOUR SEAT</div><h3>{formatDate(event.date, { month: 'long', day: 'numeric' })}</h3><p>{event.startTime} – {event.endTime}</p><div className="capacity-line"><div><b>{event.maxParticipants}</b><span> seats</span></div><small>{count} registered</small></div><div className="capacity-track"><span style={{ width: `${Math.min(100, count / event.maxParticipants * 100)}%` }} /></div><div className="seat-count"><span><i />{available} seats available</span><b>{Math.round(count / event.maxParticipants * 100)}%</b></div>{isRegistered ? <><div className="registered-note"><CheckCircle2 size={17} /><span><b>You’re on the list</b><small>Registration confirmed</small></span></div>{onCancel && <button className="button button-cancel" onClick={onCancel}>Cancel registration</button>}</> : <button className={`button ${open ? 'button-primary' : 'button-disabled'}`} disabled={!open} onClick={onRegister}>{open ? 'Register for event' : available === 0 ? 'Event is full' : 'Registration closed'} {open && <ArrowRight size={15} />}</button>}<small className="registration-note">No fee · Open to KIST students</small></aside></div></div>
}
function AuthPage({ mode, roleChoice, setRoleChoice, onSignIn, onNavigate }: { mode: 'login' | 'register'; roleChoice: Role; setRoleChoice: (role: Role) => void; onSignIn: (role: Role) => void; onNavigate: (page: Page) => void }) { return <div className="auth-page"><div className="auth-art"><div className="auth-art-inner"><span className="eyebrow"><span className="eyebrow-dot" /> KIST BIM CLUB</span><h2>Make your<br />next thing<br /><em>together.</em></h2><p>A community for curious people and practical ideas.</p><img src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1000&q=85" alt="A team working together" /><span className="auth-caption">BIM CLUB · KIST COLLEGE OF MANAGEMENT</span></div></div><div className="auth-form-wrap"><button className="back-link" onClick={() => onNavigate('home')}><ChevronLeft size={15} /> Back to home</button><div className="auth-form"><div className="eyebrow">{mode === 'login' ? 'MEMBER ACCESS' : 'BECOME A MEMBER'}</div><h1>{mode === 'login' ? 'Welcome back.' : 'Make yourself at home.'}</h1><p>{mode === 'login' ? 'Sign in to your BIM Club workspace.' : 'Create a member profile to join events and club activities.'}</p>{mode === 'register' && <label className="form-label">Full name<input defaultValue="Aarav Shrestha" /></label>}<label className="form-label">College email<input type="email" defaultValue="aarav.shrestha@kist.edu.np" /></label><label className="form-label">Password<input type="password" defaultValue="kistclub2026" /></label><label className="form-label">Demo role<select value={roleChoice} onChange={(event) => setRoleChoice(event.target.value as Role)}><option>Participant</option><option>BOD</option><option>Admin</option></select></label><button className="button button-primary auth-submit" onClick={() => onSignIn(roleChoice)}>{mode === 'login' ? 'Sign in to workspace' : 'Create demo account'} <ArrowRight size={15} /></button><div className="demo-note"><ShieldCheck size={15} /> Demo access only. No account or backend connection required.</div><div className="auth-switch">{mode === 'login' ? 'New to the club?' : 'Already a member?'} <button onClick={() => onNavigate(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create a profile' : 'Sign in'}</button></div></div></div></div> }
function Dashboard({ role, events, registrations, donations, myRegistrations, onNavigate, onCreate, onEvent }: { role: Role; events: ClubEvent[]; registrations: Registration[]; donations: Donation[]; myRegistrations: Registration[]; onNavigate: (page: Page) => void; onCreate: () => void; onEvent: (id: string) => void }) {
  const upcoming = events.filter((event) => event.date >= '2026-10-05' && event.status !== 'Cancelled').sort((a, b) => a.date.localeCompare(b.date))
  const completed = events.filter((event) => event.status === 'Completed').length
  const raised = donations.filter((donation) => donation.status === 'Received').reduce((sum, donation) => sum + donation.amount, 0)
  if (role === 'Participant') return <div className="dashboard-page"><div className="welcome-banner participant-banner"><div><span className="eyebrow">MONDAY, OCTOBER 5, 2026</span><h2>A good week to<br /><em>try something new.</em></h2><p>Your club calendar is starting to fill up.</p><button className="button button-lime" onClick={() => onNavigate('events')}>Explore events <ArrowRight size={15} /></button></div><div className="participant-illustration"><div className="illustration-orbit orbit-one" /><div className="illustration-orbit orbit-two" /><span className="illustration-star">✳</span><CalendarDays size={76} strokeWidth={1.15} /><span className="illustration-label">OCT<br />2026</span></div></div><div className="metric-grid metric-grid-4"><Metric icon={CalendarDays} label="Registered events" value={String(myRegistrations.length).padStart(2, '0')} detail="This semester" tone="green" /><Metric icon={CheckCircle2} label="Events attended" value="06" detail="Keep showing up" tone="blue" /><Metric icon={Activity} label="Attendance rate" value="86%" detail="Above club average" tone="peach" /><Metric icon={Wallet} label="Donations made" value="NPR 1,500" detail="Thank you for giving" tone="yellow" /></div><div className="content-grid dashboard-lower"><section className="panel"><PanelHeading title="Coming up for you" action="Browse events" onAction={() => onNavigate('events')} /><div className="compact-event-list">{myRegistrations.map((item) => events.find((event) => event.id === item.eventId)).filter((event): event is ClubEvent => Boolean(event && event.date >= '2026-10-05')).map((event) => <CompactEvent key={event.id} event={event} onClick={() => onEvent(event.id)} />)}{myRegistrations.every((item) => { const event = events.find((candidate) => candidate.id === item.eventId); return !event || event.date < '2026-10-05' }) && <EmptyState title="Your calendar is open" detail="Register for an event and it will appear here." action="Find an event" onAction={() => onNavigate('events')} />}</div></section><section className="panel"><PanelHeading title="Your activity" action="Leaderboard" onAction={() => onNavigate('leaderboard')} /><div className="timeline"><ActivityItem icon={CheckCircle2} title="Registered for UI/UX Design Workshop" detail="October 3 · 11:42 AM" tone="green" /><ActivityItem icon={CalendarDays} title="Attended BIM Orientation Program" detail="August 22 · KIST College" tone="blue" /><ActivityItem icon={Heart} title="Donated to the student fund" detail="September 28 · NPR 1,500" tone="peach" /></div><div className="rank-strip"><span className="rank-icon"><TrendingUp size={17} /></span><div><b>You’re #4 this semester</b><small>Earn points by joining club events</small></div><button className="icon-button" aria-label="View leaderboard" onClick={() => onNavigate('leaderboard')}><ArrowRight size={16} /></button></div></section></div></div>
  if (role === 'BOD') return <div className="dashboard-page"><WelcomeBanner variant="bod" onCreate={onCreate} /><div className="metric-grid metric-grid-4"><Metric icon={CalendarDays} label="Upcoming events" value={String(upcoming.length).padStart(2, '0')} detail="Next 30 days" tone="green" /><Metric icon={Clock} label="Today's events" value="00" detail="On the calendar" tone="blue" /><Metric icon={Users} label="Registrations" value="128" detail="Across active events" tone="peach" /><Metric icon={CheckCircle2} label="Attendance statistics" value="84%" detail="Across completed events" tone="yellow" /></div><div className="content-grid dashboard-lower"><section className="panel"><PanelHeading title="Upcoming events" action="Manage events" onAction={() => onNavigate('manage-events')} /><div className="compact-event-list">{upcoming.slice(0, 3).map((event) => <CompactEvent key={event.id} event={event} onClick={() => onEvent(event.id)} />)}</div></section><section className="panel"><PanelHeading title="Recent activity" action="View registrations" onAction={() => onNavigate('registrations')} /><div className="timeline"><ActivityItem icon={Users} title="Prakriti Rai registered" detail="Web Development Workshop · 18m ago" tone="green" /><ActivityItem icon={CalendarDays} title="UI/UX Design Workshop published" detail="By Maya Adhikari · Yesterday" tone="blue" /><ActivityItem icon={Upload} title="Workshop guide uploaded" detail="Club files · 2 days ago" tone="peach" /></div><div className="quick-actions"><button onClick={() => onNavigate('registrations')}><ClipboardList size={15} /> Registrations</button><button onClick={() => onNavigate('attendance')}><QrCode size={15} /> Scan QR</button><button onClick={() => onNavigate('files')}><Upload size={15} /> Upload file</button></div></section></div></div>
  return <div className="dashboard-page"><WelcomeBanner variant="admin" onCreate={onCreate} /><div className="metric-grid metric-grid-4"><Metric icon={Users} label="Total members" value="240" detail="12 joined this month" tone="green" trend="+12%" /><Metric icon={CalendarDays} label="Total events" value={String(events.length + 13)} detail="Since the club began" tone="blue" /><Metric icon={Clock} label="Upcoming events" value={String(upcoming.length)} detail="Next 30 days" tone="peach" /><Metric icon={CheckCircle2} label="Completed events" value={String(completed + 13)} detail="This academic year" tone="yellow" /><Metric icon={Activity} label="Total attendance" value="1,284" detail="Across 18 events" tone="blue" /><Metric icon={CircleDollarSign} label="Total donations" value={formatMoney(raised)} detail="This academic year" tone="green" /></div><div className="content-grid admin-content-grid"><section className="panel chart-panel"><PanelHeading title="Attendance overview" action="Full report" onAction={() => onNavigate('reports')} /><div className="chart-legend"><span><i /> Event attendance</span><span className="chart-period">May — Oct 2026 <ChevronDown size={13} /></span></div><div className="chart-wrap"><AttendanceChart /></div></section><section className="panel"><PanelHeading title="Upcoming events" action="All events" onAction={() => onNavigate('manage-events')} /><div className="compact-event-list">{upcoming.slice(0, 3).map((event) => <CompactEvent key={event.id} event={event} onClick={() => onEvent(event.id)} />)}</div></section></div><div className="content-grid admin-bottom-grid"><section className="panel table-panel"><PanelHeading title="Recent registrations" action="View all" onAction={() => onNavigate('registrations')} /><RegistrationTable registrations={registrations.slice(0, 4)} events={events} compact /></section><section className="panel"><PanelHeading title="Recent donations" action="Ledger" onAction={() => onNavigate('donations')} /><div className="donation-mini-list">{donations.slice(0, 3).map((donation) => <DonationRow key={donation.id} donation={donation} />)}</div></section><div className="panel quick-panel"><PanelHeading title="Quick actions" />{[['Create event', CalendarDays, onCreate], ['Manage members', Users, () => onNavigate('users')], ['Upload file', Upload, () => onNavigate('files')], ['View reports', ChartNoAxesCombined, () => onNavigate('reports')]].map(([label, Icon, action]) => { const ItemIcon = Icon as typeof Users; return <button key={label as string} onClick={action as () => void}><span><ItemIcon size={15} /></span>{label as string}<ArrowRight size={14} /></button> })}</div></div></div>
}
function WelcomeBanner({ variant, onCreate }: { variant: 'admin' | 'bod'; onCreate: () => void }) { return <div className={`welcome-banner ${variant}-banner`}><div><span className="eyebrow">MONDAY, OCTOBER 5, 2026</span><h2>{variant === 'admin' ? <>Good morning,<br /><em>Maya.</em></> : <>Let’s make this<br />week <em>count.</em></>}</h2><p>{variant === 'admin' ? 'The BIM Club is building momentum. Here’s your club at a glance.' : 'Your committee is on track. Here’s what needs your attention.'}</p><button className="button button-lime" onClick={onCreate}><Plus size={15} /> {variant === 'admin' ? 'Create an event' : 'Create an event'}</button></div>{variant === 'admin' ? <div className="admin-banner-art"><div className="banner-stat banner-stat-top"><span>ACTIVE MEMBERS</span><b>240 <small>+12%</small></b><div className="mini-bars">{[30, 42, 37, 58, 49, 75, 69, 96].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div><div className="banner-stat banner-stat-bottom"><span>THIS SEMESTER</span><b>12 <small>events</small></b><span className="banner-spark">↗</span></div><div className="banner-orbit orbit-one" /><div className="banner-orbit orbit-two" /><span className="banner-sparkle">✳</span></div> : <div className="bod-banner-art"><span className="art-tag art-tag-one"><CalendarDays size={17} /> 3 events ahead</span><span className="art-tag art-tag-two"><Users size={17} /> 42 registrations</span><div className="art-big-icon"><Activity size={74} strokeWidth={1.15} /></div><span className="art-grid" /></div>}</div> }
function AttendanceChart() { return <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}><defs><linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#245d9d" stopOpacity={0.18} /><stop offset="100%" stopColor="#245d9d" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e4e9ef" strokeDasharray="4 6" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#78889b', fontSize: 11 }} dy={9} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#78889b', fontSize: 11 }} /><Tooltip contentStyle={{ border: '1px solid #e1e7ee', borderRadius: 4, fontSize: 12 }} /><Area type="monotone" dataKey="attendees" stroke="#245d9d" strokeWidth={2.5} fill="url(#attendanceFill)" /></AreaChart></ResponsiveContainer> }
function AttendanceScanner({ events, registrations, attendance, onClose, onConfirm }: { events: ClubEvent[]; registrations: Registration[]; attendance: AttendanceRecord[]; onClose: () => void; onConfirm: (record: AttendanceRecord) => void }) { const [eventId, setEventId] = useState(events[0]?.id ?? ''); const [registrationId, setRegistrationId] = useState(''); const [scanMessage, setScanMessage] = useState('Starting camera…'); const selected = registrations.find((item) => item.id === registrationId); const duplicate = Boolean(selected && attendance.some((item) => item.registrationId === selected.id)); useEffect(() => { let scanner: import('html5-qrcode').Html5Qrcode | undefined; let active = true; import('html5-qrcode').then(({ Html5Qrcode }) => { if (!active) return; scanner = new Html5Qrcode('attendance-qr-reader'); scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 220 }, (decodedText) => { const decodedId = decodedText.startsWith('BIMCLUB:') ? decodedText.slice(8) : decodedText; const match = registrations.find((item) => item.id === decodedId); if (!match) return setScanMessage('QR code is not a registered participant for this event.'); setEventId(match.eventId); setRegistrationId(match.id); setScanMessage('Participant QR scanned. Review the details below.'); }, () => undefined).catch(() => setScanMessage('Camera unavailable. Enter a QR payload below.')); }); return () => { active = false; scanner?.stop().catch(() => undefined); }; }, [registrations]); const submitPayload = (value: string) => { const decodedId = value.startsWith('BIMCLUB:') ? value.slice(8) : value; const match = registrations.find((item) => item.id === decodedId); if (!match) return setScanMessage('QR payload not recognized. Use a registered participant QR.'); setEventId(match.eventId); setRegistrationId(match.id); setScanMessage('Participant QR verified. Review the details below.'); }; return <div className="modal-backdrop" role="presentation"><div className="modal donation-editor-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><span className="eyebrow">QR-BASED ATTENDANCE VERIFICATION</span><h2>Verify participant check-in</h2></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={19} /></button></div><div className="modal-body"><label className="form-label">Event<select value={eventId} onChange={(event) => { setEventId(event.target.value); setRegistrationId('') }}>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label><div id="attendance-qr-reader" className="qr-reader" /><div className="scan-preview"><QrCode size={42} /><b>{scanMessage}</b><small>Allow camera access, or enter a QR payload such as BIMCLUB:reg-001.</small></div><label className="form-label">QR payload<input placeholder="BIMCLUB:reg-001" onChange={(event) => submitPayload(event.target.value)} /></label>{selected && <div className="registered-note"><CheckCircle2 size={17} /><span><b>{selected.name}</b><small>{selected.email} · {duplicate ? 'Already checked in for this event.' : 'Registration confirmed.'}</small></span></div>}</div><div className="modal-footer"><button className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={!selected || duplicate} onClick={() => selected && onConfirm({ id: `att-${Date.now()}`, eventId: selected.eventId, registrationId: selected.id, memberId: selected.memberId, memberName: selected.name, date: '2026-10-05', checkInTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), status: 'Verified', method: 'QR', verifiedBy: 'BOD' })}>{duplicate ? 'Already recorded' : 'Confirm attendance'} <Check size={15} /></button></div></div></div> }
function NotificationsPage({ notifications, onRead }: { notifications: Notification[]; onRead: () => void }) { return <div className="section-page"><div className="list-toolbar"><span className="result-count">{notifications.filter((item) => !item.read).length} unread notifications</span><button className="button button-quiet" onClick={onRead}><Check size={15} /> Mark all read</button></div><div className="panel notification-list-panel">{notifications.map((item) => <div className={`notification-row ${item.read ? '' : 'notification-unread'}`} key={item.id}><span className="notification-icon"><Bell size={15} /></span><div><b>{item.title}</b><small>{item.detail}</small></div><time>{item.timestamp}</time></div>)}{notifications.length === 0 && <EmptyState title="You are all caught up" detail="New club updates will appear here." />}</div></div> }
function ActivityLogPage({ entries }: { entries: ActivityLogEntry[] }) { return <div className="section-page"><div className="panel event-table-panel"><div className="panel-heading panel-heading-padded"><h3>Admin activity log</h3><span className="result-count">{entries.length} entries</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>USER</th><th>ACTION</th><th>DATE / TIME</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td><MemberCell name={entry.user} email="club workspace" /></td><td>{entry.action}</td><td>{entry.timestamp}</td></tr>)}</tbody></table></div></div></div> }
function Metric({ icon: Icon, label, value, detail, tone, trend }: { icon: typeof Users; label: string; value: string; detail: string; tone: string; trend?: string }) { return <div className="metric-card"><div className="metric-top"><span className={`metric-icon tone-${tone}`}><Icon size={17} /></span>{trend && <span className="metric-trend"><ArrowUpRight size={13} />{trend}</span>}</div><div className="metric-value">{value}</div><div className="metric-label">{label}</div><div className="metric-detail">{detail}</div></div> }
function PanelHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) { return <div className="panel-heading"><h3>{title}</h3>{action && <button className="text-link text-link-small" onClick={onAction}>{action}<ArrowRight size={13} /></button>}</div> }
function CompactEvent({ event, onClick }: { event: ClubEvent; onClick: () => void }) { const date = new Date(`${event.date}T12:00:00`); return <button className="compact-event" onClick={onClick}><span className="compact-date"><b>{date.getDate()}</b><small>{date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</small></span><span className="compact-event-body"><b>{event.title}</b><small><Clock size={12} /> {event.startTime} <span>·</span> <MapPin size={12} /> {event.location}</small></span><StatusBadge status={event.status} /></button> }
function ActivityItem({ icon: Icon, title, detail, tone }: { icon: typeof Activity; title: string; detail: string; tone: string }) { return <div className="activity-item"><span className={`activity-icon tone-${tone}`}><Icon size={15} /></span><div><b>{title}</b><small>{detail}</small></div></div> }
function StatusBadge({ status }: { status: EventStatus | Registration['status'] | Donation['status'] | AttendanceRecord['status'] | `${number}%` }) { return <span className={`status-badge badge-${String(status).toLowerCase().replaceAll(' ', '-')}`}><i />{status}</span> }
function ManageEvents({ events, countFor, search, setSearch, category, setCategory, statusFilter, setStatusFilter, onEdit, onCreate, onEvent, onStatus }: { events: ClubEvent[]; countFor: (id: string) => number; search: string; setSearch: (value: string) => void; category: string; setCategory: (value: string) => void; statusFilter: string; setStatusFilter: (value: string) => void; onEdit: (event: ClubEvent) => void; onCreate: () => void; onEvent: (id: string) => void; onStatus: (id: string, status: EventStatus) => void }) {
  return <div className="section-page"><div className="list-toolbar"><SearchField value={search} onChange={setSearch} placeholder="Search events" /><SelectField value={category} onChange={setCategory} options={['All categories', 'Workshop', 'Design', 'Competition', 'Seminar', 'Community']} icon={<Filter size={15} />} /><SelectField value={statusFilter} onChange={setStatusFilter} options={['All statuses', 'Draft', 'Published', 'Registration Open', 'Registration Closed', 'Completed', 'Cancelled']} /><span className="result-count">{events.length} events</span><button className="button button-primary toolbar-create" onClick={onCreate}><Plus size={15} /> New event</button></div><div className="panel event-table-panel"><div className="table-scroll"><table className="data-table"><thead><tr><th>EVENT</th><th>DATE & LOCATION</th><th>REGISTRATIONS</th><th>STATUS</th><th /></tr></thead><tbody>{events.map((event) => { const count = countFor(event.id); return <tr key={event.id}><td><button className="event-table-name" onClick={() => onEvent(event.id)}><img src={event.image} alt="" /><span><b>{event.title}</b><small>{event.category}</small></span></button></td><td><b>{formatDate(event.date, { month: 'short', day: 'numeric', year: 'numeric' })}</b><small className="table-secondary"><MapPin size={12} /> {event.location}</small></td><td><div className="registration-progress"><span>{count} / {event.maxParticipants}</span><i><b style={{ width: `${Math.min(100, count / event.maxParticipants * 100)}%` }} /></i></div></td><td><StatusBadge status={event.status} /></td><td><div className="table-actions"><button className="icon-button" aria-label={`Edit ${event.title}`} onClick={() => onEdit(event)}><Settings2 size={15} /></button><button className="icon-button" aria-label={`Toggle registration for ${event.title}`} onClick={() => onStatus(event.id, event.status === 'Registration Open' ? 'Registration Closed' : 'Registration Open')}><ArrowUpRight size={15} /></button></div></td></tr> })}</tbody></table></div>{events.length === 0 && <EmptyState title="No events found" detail="Try another search or create a new event." action="Create event" onAction={onCreate} />}</div></div>
}
function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="search-field"><Search size={16} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label> }
function SelectField({ value, onChange, options, icon }: { value: string; onChange: (value: string) => void; options: string[]; icon?: React.ReactNode }) { return <label className="select-field">{icon}<select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={14} /></label> }
function RegistrationsPage({ events, registrations, query, setQuery, onAttendance }: { events: ClubEvent[]; registrations: Registration[]; query: string; setQuery: (value: string) => void; onAttendance: (id: string) => void }) { const filtered = registrations.filter((item) => `${item.name} ${item.email} ${events.find((event) => event.id === item.eventId)?.title ?? ''}`.toLowerCase().includes(query.toLowerCase())); return <div className="section-page"><div className="list-toolbar"><SearchField value={query} onChange={setQuery} placeholder="Search name, email, or event" /><span className="result-count">{filtered.length} registrations</span><button className="button button-quiet" onClick={() => window.print()}><ArrowDownToLine size={15} /> Export</button></div><div className="panel event-table-panel"><div className="table-scroll"><table className="data-table"><thead><tr><th>MEMBER</th><th>EVENT</th><th>REGISTERED</th><th>STATUS</th><th /></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><MemberCell name={item.name} email={item.email} /></td><td><b>{events.find((event) => event.id === item.eventId)?.title ?? 'Removed event'}</b></td><td>{formatDate(item.registeredAt, { month: 'short', day: 'numeric' })}</td><td><StatusBadge status={item.status} /></td><td>{item.status === 'Confirmed' && <button className="button button-quiet button-xs" onClick={() => onAttendance(item.id)}><Check size={13} /> Mark attended</button>}</td></tr>)}</tbody></table></div></div></div> }
function MemberCell({ name, email }: { name: string; email: string }) { return <div className="member-cell"><Avatar name={name} /><span><b>{name}</b><small>{email}</small></span></div> }
function RegistrationTable({ registrations, events, compact = false }: { registrations: Registration[]; events: ClubEvent[]; compact?: boolean }) { return <div className="table-scroll"><table className={`data-table ${compact ? 'data-table-compact' : ''}`}><thead><tr><th>MEMBER</th><th>EVENT</th><th>STATUS</th></tr></thead><tbody>{registrations.map((item) => <tr key={item.id}><td><MemberCell name={item.name} email={item.email.split('@')[0]} /></td><td><span className="table-event-title">{events.find((event) => event.id === item.eventId)?.title ?? 'Removed event'}</span></td><td><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div> }
function DonationRow({ donation }: { donation: Donation }) { return <div className="donation-row"><span className="donation-icon"><Heart size={14} /></span><div><b>{donation.name}</b><small>{donation.purpose}</small></div><strong>{formatMoney(donation.amount)}</strong></div> }
function ParticipantDonationsPage({ donations, onContribute }: { donations: Donation[]; onContribute: () => void }) { const mine = donations.filter((item) => item.name === 'Aarav Shrestha'); const total = mine.reduce((sum, item) => sum + item.amount, 0); return <div className="section-page"><div className="donation-summary"><div><span className="eyebrow">YOUR SUPPORT</span><div className="donation-total">{formatMoney(total)}</div><p>Your contributions help fund workshops and student projects.</p><button className="button button-lime" onClick={onContribute}><Heart size={15} /> Make a contribution</button></div><div className="donation-summary-icon"><Heart size={32} strokeWidth={1.3} /></div></div><div className="panel event-table-panel"><div className="panel-heading panel-heading-padded"><h3>Donation history</h3><span className="result-count">{mine.length} contributions</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>PURPOSE</th><th>DATE</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>{mine.map((item) => <tr key={item.id}><td>{item.purpose}</td><td>{formatDate(item.date, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td><b>{formatMoney(item.amount)}</b></td><td><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div>{mine.length === 0 && <EmptyState title="No contributions yet" detail="Your contribution history will appear here." />}</div><p className="disclaimer-note"><ShieldCheck size={14} /> Mock contribution flow only. No real payment processing is connected.</p></div> }
function AttendancePage({ role, registrations, attendance, events, onScan }: { role: Role; registrations: Registration[]; attendance: AttendanceRecord[]; events: ClubEvent[]; onScan: () => void }) {
  const attended = role === 'Participant' ? attendance.filter((item) => item.memberId === memberId).length : attendance.length
  const registered = role === 'Participant' ? registrations.filter((item) => item.memberId === memberId && item.status !== 'Cancelled').length : registrations.filter((item) => item.status !== 'Cancelled').length
  if (role === 'Participant') return <div className="section-page"><div className="attendance-callout"><div className="scan-mark"><QrCode size={24} /></div><div><b>QR-based attendance verification</b><small>Show your event QR/check-in option to the BOD team at the venue.</small></div><button className="button button-primary" onClick={() => onScan()}><QrCode size={15} /> View event QR</button></div><div className="metric-grid metric-grid-3"><Metric icon={CheckCircle2} label="Events attended" value={String(attended).padStart(2, '0')} detail="This academic year" tone="green" /><Metric icon={Activity} label="Attendance rate" value={`${Math.round(attended / Math.max(registered, 1) * 100)}%`} detail={`${attended} of ${registered} registered events`} tone="blue" /><Metric icon={TrendingUp} label="Club points" value={`${attended * 100}`} detail="100 points per verified event" tone="peach" /></div><div className="panel attendance-history"><PanelHeading title="Your attendance history" /><div className="history-list">{registrations.filter((item) => item.memberId === memberId).map((item) => <div className="history-row" key={item.id}><span className={`history-check ${item.status === 'Attended' ? 'history-done' : ''}`}>{item.status === 'Attended' ? <Check size={15} /> : <CalendarDays size={15} />}</span><div><b>{events.find((event) => event.id === item.eventId)?.title ?? 'Club event'}</b><small>{formatDate(item.registeredAt)} · {item.status === 'Attended' ? 'QR verified attendance recorded' : 'Registered · check-in pending'}</small></div><StatusBadge status={item.status} /></div>)}</div></div></div>
  return <div className="section-page"><div className="attendance-callout"><div className="scan-mark"><QrCode size={24} /></div><div><b>QR-based attendance verification</b><small>Scan a participant QR and confirm once. Duplicate attendance is blocked.</small></div><button className="button button-primary" onClick={onScan}><ScanLine size={15} /> Open scanner</button></div><div className="metric-grid metric-grid-3"><Metric icon={Users} label="Registered" value={String(registered)} detail="Across active events" tone="blue" /><Metric icon={CheckCircle2} label="Checked in" value={String(attended)} detail="Verified attendance records" tone="green" /><Metric icon={Activity} label="Average attendance" value={`${Math.round(attended / Math.max(registered, 1) * 100)}%`} detail="From current registrations" tone="peach" /></div><div className="panel event-table-panel"><PanelHeading title="Attendance records" /><div className="table-scroll"><table className="data-table"><thead><tr><th>EVENT</th><th>PARTICIPANT</th><th>DATE</th><th>CHECK-IN TIME</th><th>STATUS</th></tr></thead><tbody>{attendance.map((record) => <tr key={record.id}><td><b>{events.find((event) => event.id === record.eventId)?.title ?? 'Club event'}</b></td><td>{record.memberName}</td><td>{formatDate(record.date, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td>{record.checkInTime}</td><td><StatusBadge status="Verified" /></td></tr>)}</tbody></table></div>{attendance.length === 0 && <EmptyState title="No attendance recorded yet" detail="Verified participant check-ins will appear here." />}</div></div>
}
function FilesPage({ role, files, onUpload, onDownload }: { role: Role; files: ClubFile[]; onUpload: (file: ClubFile) => void; onDownload: () => void }) { const [query, setQuery] = useState(''); const [category, setCategory] = useState('All categories'); const filtered = files.filter((file) => `${file.name} ${file.type} ${file.category} ${file.uploadedBy}`.toLowerCase().includes(query.toLowerCase()) && (category === 'All categories' || file.category === category)); return <div className="section-page"><div className="list-toolbar"><SearchField value={query} onChange={setQuery} placeholder="Search files" /><SelectField value={category} onChange={setCategory} options={['All categories', 'Notices', 'Event Documents', 'Club Guidelines', 'Reports', 'Other']} icon={<Filter size={15} />} /><span className="result-count">{filtered.length} files</span>{role !== 'Participant' && <label className="button button-primary file-upload-button"><Upload size={15} /> Upload file<input type="file" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) onUpload({ id: `file-${Date.now()}`, name: selected.name, type: selected.name.split('.').pop()?.toUpperCase() ?? 'FILE', category: 'Other', uploadDate: '2026-10-05', uploadedBy: role === 'BOD' ? 'Sujan Karki' : 'Maya Adhikari', size: `${Math.max(1, Math.round(selected.size / 1024))} KB` }) }} /></label>}</div><div className="panel file-table-panel"><div className="table-scroll"><table className="data-table"><thead><tr><th>FILE NAME</th><th>FILE TYPE</th><th>CATEGORY</th><th>UPLOAD DATE</th><th>UPLOADED BY</th><th /></tr></thead><tbody>{filtered.map((file) => <tr key={file.id}><td><div className="file-cell"><span className="file-icon file-green"><FileText size={17} /></span><span><b>{file.name}</b><small>{file.size}</small></span></div></td><td>{file.type}</td><td><span className="folder-label">{file.category}</span></td><td>{formatDate(file.uploadDate, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td>{file.uploadedBy}</td><td><button className="icon-button" aria-label={`Download ${file.name}`} onClick={onDownload}><ArrowDownToLine size={15} /></button></td></tr>)}</tbody></table></div>{filtered.length === 0 && <EmptyState title="No files match" detail="Try another search or category." />}</div><div className="storage-note"><ShieldCheck size={15} /> Club files are shared with current BIM Club members.</div></div> }
function DonationsPage({ role, donations, onAdd }: { role: Role; donations: Donation[]; onAdd: () => void }) { const total = donations.filter((item) => item.status === 'Received').reduce((sum, item) => sum + item.amount, 0); return <div className="section-page"><div className="donation-summary"><div><span className="eyebrow">COMMUNITY SUPPORT</span><div className="donation-total">{formatMoney(total)}</div><p>Raised for BIM Club activities in 2026.</p></div><div className="donation-summary-icon"><Heart size={32} strokeWidth={1.3} /></div></div><div className="metric-grid metric-grid-3"><Metric icon={CircleDollarSign} label="Total received" value={formatMoney(total)} detail="This academic year" tone="green" /><Metric icon={Users} label="Contributors" value={String(donations.length)} detail="Students, alumni & faculty" tone="blue" /><Metric icon={CreditCard} label="Pending" value={formatMoney(donations.filter((item) => item.status === 'Pending').reduce((sum, item) => sum + item.amount, 0))} detail="Awaiting confirmation" tone="yellow" /></div><div className="panel event-table-panel"><div className="panel-heading panel-heading-padded"><h3>Donation ledger</h3>{role === 'Admin' && <button className="button button-quiet button-xs" onClick={onAdd}><Plus size={14} /> Add donation</button>}</div><div className="table-scroll"><table className="data-table"><thead><tr><th>CONTRIBUTOR</th><th>PURPOSE</th><th>DATE</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>{donations.map((item) => <tr key={item.id}><td><div className="member-cell"><span className="donor-avatar"><Heart size={14} /></span><span><b>{item.name}</b><small>BIM Club supporter</small></span></div></td><td>{item.purpose}</td><td>{formatDate(item.date, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td><b>{formatMoney(item.amount)}</b></td><td><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div></div><p className="disclaimer-note"><ShieldCheck size={14} /> Donation records are visible to club administrators and members.</p></div> }
function UsersPage({ members, setMembers, onAdded }: { members: Member[]; setMembers: (update: (previous: Member[]) => Member[]) => void; onAdded: () => void }) { const [searchValue, setSearchValue] = useState(''); const filtered = members.filter((item) => `${item.name} ${item.email} ${item.role}`.toLowerCase().includes(searchValue.toLowerCase())); return <div className="section-page"><div className="list-toolbar"><SearchField value={searchValue} onChange={setSearchValue} placeholder="Search members" /><span className="result-count">{filtered.length} members</span><button className="button button-primary" onClick={() => { setMembers((items) => [{ id: `member-${Date.now()}`, name: 'New member', email: 'new.member@kist.edu.np', role: 'Participant', joined: '2026-10-05', points: 0 }, ...items]); onAdded() }}><Plus size={15} /> Add member</button></div><div className="panel event-table-panel"><div className="table-scroll"><table className="data-table"><thead><tr><th>MEMBER</th><th>ROLE</th><th>JOINED</th><th>CLUB POINTS</th><th>STATUS</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><MemberCell name={item.name} email={item.email} /></td><td><span className={`role-tag role-${item.role.toLowerCase()}`}>{item.role}</span></td><td>{formatDate(item.joined, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td><b>{item.points.toLocaleString()}</b> pts</td><td><StatusBadge status="Confirmed" /></td></tr>)}</tbody></table></div></div></div> }
function ReportsPage({ events, registrations, donations }: { events: ClubEvent[]; registrations: Registration[]; donations: Donation[] }) { const attended = registrations.filter((item) => item.status === 'Attended').length; const raised = donations.filter((item) => item.status === 'Received').reduce((sum, item) => sum + item.amount, 0); return <div className="section-page"><div className="report-topline"><span>Academic year 2026</span><button className="button button-quiet" onClick={() => window.print()}><ArrowDownToLine size={15} /> Export report</button></div><div className="metric-grid metric-grid-4"><Metric icon={CalendarDays} label="Events hosted" value={String(events.length + 13)} detail="Across this academic year" tone="green" /><Metric icon={Users} label="Registrations" value={String(registrations.length + 120)} detail="All event registrations" tone="blue" /><Metric icon={CheckCircle2} label="Total attendance" value={String(attended + 918)} detail="Checked in at events" tone="peach" /><Metric icon={CircleDollarSign} label="Raised" value={formatMoney(raised)} detail="Confirmed donations" tone="yellow" /></div><div className="content-grid report-charts"><section className="panel chart-panel"><PanelHeading title="Monthly attendance" /><div className="chart-wrap"><AttendanceChart /></div></section><section className="panel report-breakdown"><PanelHeading title="Event breakdown" /><div className="breakdown-list">{['Workshop', 'Design', 'Competition', 'Seminar'].map((label, index) => <div key={label}><span className={`breakdown-dot breakdown-${index}`} /><span>{label}</span><b>{[8, 4, 3, 3][index]}</b><small>events</small></div>)}</div><div className="report-callout"><Sparkles size={15} /><span><b>Engagement is growing</b><small>Attendance is up 18% from last semester.</small></span></div></section></div></div> }
function LeaderboardPage({ members, currentMember }: { members: Member[]; currentMember: Member }) { return <div className="section-page leaderboard-page"><div className="leaderboard-banner"><div><span className="eyebrow">FALL 2026 · MEMBER RECOGNITION</span><h2>Showing up<br /><em>adds up.</em></h2><p>Points are earned by attending events and contributing to the club community.</p></div><div className="leaderboard-total"><TrendingUp size={20} /><b>{currentMember.points.toLocaleString()}</b><small>your club points</small></div></div><div className="panel leaderboard-table"><div className="panel-heading panel-heading-padded"><h3>Member leaderboard</h3><span className="result-count">Updated today</span></div><div className="leader-list">{[...members].sort((a, b) => b.points - a.points).map((member, index) => <div className={`leader-row ${member.id === currentMember.id ? 'leader-current' : ''}`} key={member.id}><span className={`leader-rank ${index < 3 ? 'leader-rank-top' : ''}`}>{String(index + 1).padStart(2, '0')}</span><Avatar name={member.name} /><span className="leader-name"><b>{member.name}{member.id === currentMember.id && <small>YOU</small>}</b><small>{member.role === 'BOD' ? 'Board of Directors' : 'BIM Club member'}</small></span><span className="leader-points"><b>{member.points.toLocaleString()}</b><small>pts</small></span></div>)}</div></div></div> }
function ProfilePage({ member, role, onRole, onSignOut }: { member: Member; role: Role; onRole: (role: Role) => void; onSignOut: () => void }) { return <div className="section-page profile-page"><div className="profile-cover"><div className="profile-avatar-wrap"><Avatar name={displayName(role, member)} size /></div><span className="profile-member-since">MEMBER SINCE {formatDate(member.joined, { month: 'long', year: 'numeric' }).toUpperCase()}</span></div><div className="profile-details"><div className="profile-name-row"><div><h2>{displayName(role, member)}</h2><span className="role-tag role-participant">{role} · KIST College</span></div><button className="button button-quiet" onClick={onSignOut}>Sign out <LogOut size={15} /></button></div><div className="profile-info-grid"><div><span>COLLEGE EMAIL</span><b>{member.email}</b></div><div><span>MEMBERSHIP</span><b>BIM Club · Fall 2026</b></div><div><span>CLUB POINTS</span><b>{member.points.toLocaleString()} points</b></div><div><span>ROLE</span><b>{role} account</b></div></div><div className="profile-role-switch"><div><b>Demo role selector</b><small>Switch accounts to preview each workspace.</small></div><div>{(['Admin', 'BOD', 'Participant'] as Role[]).map((item) => <button className={item === role ? 'role-selected' : ''} key={item} onClick={() => onRole(item)}>{item}</button>)}</div></div></div></div> }
function EventEditor({ event, form, setForm, onClose, onSave }: { event: ClubEvent | null; form: EventForm; setForm: (form: EventForm) => void; onClose: () => void; onSave: (form: EventForm) => void }) { const update = (key: keyof EventForm, value: string | number) => setForm({ ...form, [key]: value }); return <div className="modal-backdrop" role="presentation" onMouseDown={(click) => { if (click.target === click.currentTarget) onClose() }}><div className="modal event-editor-modal" role="dialog" aria-modal="true" aria-labelledby="event-modal-title"><div className="modal-heading"><div><span className="eyebrow">EVENT MANAGEMENT</span><h2 id="event-modal-title">{event ? 'Edit event' : 'Create an event'}</h2></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={19} /></button></div><div className="modal-body"><label className="form-label">Event title<input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Product Design Sprint" /></label><label className="form-label">Description<textarea rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="What will participants learn or do?" /></label><div className="form-grid-two"><label className="form-label">Date<input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} /></label><label className="form-label">Registration deadline<input type="date" value={form.registrationDeadline} onChange={(e) => update('registrationDeadline', e.target.value)} /></label></div><div className="form-grid-two"><label className="form-label">Start time<input type="time" value={form.startTime} onChange={(e) => update('startTime', e.target.value)} /></label><label className="form-label">End time<input type="time" value={form.endTime} onChange={(e) => update('endTime', e.target.value)} /></label></div><label className="form-label">Location<input value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="Venue or room" /></label><div className="form-grid-two"><label className="form-label">Category<select value={form.category} onChange={(e) => update('category', e.target.value)}><option>Workshop</option><option>Design</option><option>Competition</option><option>Seminar</option><option>Community</option></select></label><label className="form-label">Maximum participants<input type="number" min="1" value={form.maxParticipants} onChange={(e) => update('maxParticipants', Number(e.target.value))} /></label></div><div className="form-grid-two"><label className="form-label">Status<select value={form.status} onChange={(e) => update('status', e.target.value)}>{(['Draft', 'Published', 'Registration Open', 'Registration Closed', 'Completed', 'Cancelled'] as EventStatus[]).map((status) => <option key={status}>{status}</option>)}</select></label><label className="form-label">Image URL<input value={form.image} onChange={(e) => update('image', e.target.value)} placeholder="Optional image URL" /></label></div></div><div className="modal-footer"><button className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" onClick={() => onSave(form)}>{event ? 'Save changes' : 'Create draft'} <ArrowRight size={15} /></button></div></div></div> }
function DonationEditor({ onClose, onSave }: { onClose: () => void; onSave: (donation: Donation) => void }) { const [name, setName] = useState(''); const [purpose, setPurpose] = useState('General fund'); const [amount, setAmount] = useState(''); return <div className="modal-backdrop" role="presentation"><div className="modal donation-editor-modal" role="dialog" aria-modal="true" aria-labelledby="donation-modal-title"><div className="modal-heading"><div><span className="eyebrow">CLUB FINANCE</span><h2 id="donation-modal-title">Add donation</h2></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={19} /></button></div><div className="modal-body"><label className="form-label">Contributor<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or organization" /></label><label className="form-label">Purpose<input value={purpose} onChange={(e) => setPurpose(e.target.value)} /></label><label className="form-label">Amount (NPR)<input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></label></div><div className="modal-footer"><button className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={!name || !amount} onClick={() => onSave({ id: `don-${Date.now()}`, name, purpose, amount: Number(amount), date: '2026-10-05', status: 'Received' })}>Add donation <Check size={15} /></button></div></div></div> }
function EmptyState({ title, detail, action, onAction }: { title: string; detail: string; action?: string; onAction?: () => void }) { return <div className="empty-state"><span><CalendarDays size={20} /></span><b>{title}</b><p>{detail}</p>{action && onAction && <button className="text-link" onClick={onAction}>{action} <ArrowRight size={14} /></button>}</div> }

export default App
