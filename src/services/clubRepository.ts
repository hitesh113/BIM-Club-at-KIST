import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { mockSnapshot } from '../mockData'
import type { ActivityLogEntry, AttendanceRecord, ClubEvent, ClubFile, ClubSnapshot, Donation, Member, Notification, Registration, Role } from '../types'

export interface ClubRepository {
  loadSnapshot(): Promise<ClubSnapshot> | ClubSnapshot
  registerForEvent(event: ClubEvent, member: Member): Promise<Registration>
  cancelRegistration(registrationId: string): Promise<void>
  recordAttendance(registration: Registration, verifiedBy: string): Promise<AttendanceRecord>
}

const asRole = (value: unknown): Role => {
  const role = String(value ?? 'Participant').toLowerCase()
  if (role === 'admin') return 'Admin'
  if (role === 'bod') return 'BOD'
  return 'Participant'
}

const asStatus = (value: unknown): Registration['status'] => {
  const status = String(value ?? 'confirmed').toLowerCase()
  if (status === 'attended') return 'Attended'
  if (status === 'cancelled') return 'Cancelled'
  return 'Confirmed'
}

const asFileCategory = (value: unknown): ClubFile['category'] => {
  const category = String(value ?? 'Other')
  if (category === 'Notices') return 'Notices'
  if (category === 'Event Documents') return 'Event Documents'
  if (category === 'Club Guidelines') return 'Club Guidelines'
  if (category === 'Reports') return 'Reports'
  return 'Other'
}

const formatRelativeTime = (value: string): string => {
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return 'Recently'

  const diffMinutes = Math.max(1, Math.round((Date.now() - timestamp.getTime()) / 60000))
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  return `${diffDays}d ago`
}

const formatDate = (value: string): string => {
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return new Date().toISOString().slice(0, 10)
  return timestamp.toISOString().slice(0, 10)
}

export const mockClubRepository: ClubRepository = {
  loadSnapshot() {
    return {
      events: mockSnapshot.events.map((item) => ({ ...item })),
      registrations: mockSnapshot.registrations.map((item) => ({ ...item })),
      donations: mockSnapshot.donations.map((item) => ({ ...item })),
      members: mockSnapshot.members.map((item) => ({ ...item })),
      attendance: mockSnapshot.attendance.map((item) => ({ ...item })),
      files: mockSnapshot.files.map((item) => ({ ...item })),
      notifications: mockSnapshot.notifications.map((item) => ({ ...item })),
      activityLog: mockSnapshot.activityLog.map((item) => ({ ...item })),
    }
  },
  async registerForEvent(event, member) {
    return {
      id: `reg-${Date.now()}`,
      eventId: event.id,
      memberId: member.id,
      name: member.name,
      email: member.email,
      registeredAt: new Date().toISOString().slice(0, 10),
      status: 'Confirmed',
    }
  },
  async cancelRegistration() {},
  async recordAttendance(registration, verifiedBy) {
    const checkedInAt = new Date()
    return {
      id: `att-${Date.now()}`,
      eventId: registration.eventId,
      registrationId: registration.id,
      memberId: registration.memberId,
      memberName: registration.name,
      date: checkedInAt.toISOString().slice(0, 10),
      checkInTime: checkedInAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      status: 'Verified',
      method: 'QR',
      verifiedBy,
    }
  },
}

export const supabaseClubRepository: ClubRepository = {
  async loadSnapshot() {
    if (!supabase || !hasSupabaseConfig) {
      return mockClubRepository.loadSnapshot()
    }

    const [eventsResult, profilesResult, registrationsResult, attendanceResult, filesResult, donationsResult, notificationsResult, activityLogsResult, pointsResult] = await Promise.all([
      supabase.from('events').select('*').order('event_date', { ascending: false }),
      supabase.from('profiles').select('*'),
      supabase.from('event_registrations').select('*'),
      supabase.from('attendance').select('*'),
      supabase.from('files').select('*'),
      supabase.from('donations').select('*'),
      supabase.from('notifications').select('*'),
      supabase.from('activity_logs').select('*'),
      supabase.from('point_transactions').select('member_id, points_delta'),
    ])

    const failedQuery = [
      eventsResult,
      profilesResult,
      registrationsResult,
      attendanceResult,
      filesResult,
      donationsResult,
      notificationsResult,
      activityLogsResult,
      pointsResult,
    ].find((result) => result.error)
    if (failedQuery?.error) throw failedQuery.error

    const profilesById = new Map<string, any>((profilesResult.data ?? []).map((profile: any) => [profile.id, profile]))
    const pointsByMember = new Map<string, number>()
    for (const transaction of pointsResult.data ?? []) {
      pointsByMember.set(transaction.member_id, (pointsByMember.get(transaction.member_id) ?? 0) + Number(transaction.points_delta ?? 0))
    }

    const events: ClubEvent[] = ((eventsResult.data ?? []) as any[]).map((event: any) => ({
      id: event.id,
      title: event.title,
      description: event.description ?? '',
      date: formatDate(event.event_date ?? event.date ?? new Date().toISOString()),
      startTime: event.start_time ?? '10:00',
      endTime: event.end_time ?? '12:00',
      location: event.location ?? 'KIST College of Management',
      category: event.category ?? 'Community',
      image: event.image_url ?? 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=85',
      maxParticipants: Number(event.max_participants ?? 50),
      registrationDeadline: formatDate(event.registration_deadline ?? event.event_date ?? new Date().toISOString()),
      status: event.status ?? 'Published',
    }))

    const members: Member[] = ((profilesResult.data ?? []) as any[]).map((profile: any) => ({
      id: profile.id,
      name: profile.full_name ?? profile.name ?? 'BIM Club member',
      email: profile.email ?? 'member@kist.edu.np',
      role: asRole(profile.role),
      joined: formatDate(profile.created_at ?? new Date().toISOString()),
      points: pointsByMember.get(profile.id) ?? Number(profile.points ?? 0),
    }))

    const registrations: Registration[] = ((registrationsResult.data ?? []) as any[]).map((registration: any) => ({
      id: registration.id,
      eventId: registration.event_id,
      memberId: registration.member_id,
      name: profilesById.get(registration.member_id)?.full_name ?? 'Club member',
      email: profilesById.get(registration.member_id)?.email ?? 'member@kist.edu.np',
      registeredAt: formatDate(registration.registered_at ?? new Date().toISOString()),
      status: asStatus(registration.status),
    }))

    const attendance: AttendanceRecord[] = ((attendanceResult.data ?? []) as any[]).map((record: any) => ({
      id: record.id,
      eventId: record.event_id,
      registrationId: record.registration_id,
      memberId: record.member_id,
      memberName: profilesById.get(record.member_id)?.full_name ?? 'Club member',
      date: formatDate(record.checked_in_at ?? record.date ?? new Date().toISOString()),
      checkInTime: new Date(record.checked_in_at ?? Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      status: 'Verified',
      method: record.method === 'manual' ? 'Manual' : 'QR',
      verifiedBy: profilesById.get(record.verified_by)?.full_name ?? 'System',
    }))

    const files: ClubFile[] = ((filesResult.data ?? []) as any[]).map((file: any) => ({
      id: file.id,
      name: file.name,
      type: file.mime_type?.split('/').pop()?.toUpperCase() ?? 'PDF',
      category: asFileCategory(file.category),
      uploadDate: formatDate(file.uploaded_at ?? new Date().toISOString()),
      uploadedBy: profilesById.get(file.uploaded_by)?.full_name ?? 'Club admin',
      size: file.size_bytes ? `${Math.max(1, Math.round(file.size_bytes / 1024))} KB` : '0 KB',
    }))

    const donations: Donation[] = ((donationsResult.data ?? []) as any[]).map((donation: any) => ({
      id: donation.id,
      name: donation.contributor_name ?? 'Anonymous donor',
      memberId: donation.donor_profile_id ?? undefined,
      purpose: donation.purpose ?? 'Club support',
      amount: Number(donation.amount ?? 0),
      date: formatDate(donation.donated_at ?? new Date().toISOString()),
      status: donation.status === 'received' ? 'Received' : 'Pending',
    }))

    const notificationReadRows = ((await supabase.from('notification_reads').select('notification_id')).data ?? []) as any[]
    const notificationReads = new Set(notificationReadRows.map((item: any) => item.notification_id))
    const notifications: Notification[] = ((notificationsResult.data ?? []) as any[]).map((notification: any) => ({
      id: notification.id,
      title: notification.title,
      detail: notification.body ?? notification.detail ?? 'New update from BIM Club',
      timestamp: formatRelativeTime(notification.created_at ?? new Date().toISOString()),
      read: notificationReads.has(notification.id),
      recipient: notification.recipient_role ? asRole(notification.recipient_role) : 'All',
    }))

    const activityLog: ActivityLogEntry[] = ((activityLogsResult.data ?? []) as any[]).map((item: any) => ({
      id: item.id,
      user: profilesById.get(item.actor_id)?.full_name ?? 'System',
      action: `${item.entity_type ?? 'record'} ${item.action ?? 'updated'}`,
      timestamp: formatRelativeTime(item.created_at ?? new Date().toISOString()),
    }))

    return {
      events,
      registrations,
      donations,
      members,
      attendance,
      files,
      notifications,
      activityLog,
    }
  },
  async registerForEvent(event, member) {
    if (!supabase || !hasSupabaseConfig) throw new Error('Supabase is not configured.')
    const { data, error } = await supabase.rpc('register_for_event', { target_event_id: event.id })
    if (error) throw error
    if (typeof data !== 'string') throw new Error('The registration was saved without returning its ID.')
    return {
      id: data,
      eventId: event.id,
      memberId: member.id,
      name: member.name,
      email: member.email,
      registeredAt: new Date().toISOString().slice(0, 10),
      status: 'Confirmed',
    }
  },
  async cancelRegistration(registrationId) {
    if (!supabase || !hasSupabaseConfig) throw new Error('Supabase is not configured.')
    const { error } = await supabase.rpc('cancel_event_registration', { target_registration_id: registrationId })
    if (error) throw error
  },
  async recordAttendance(registration, verifiedBy) {
    if (!supabase || !hasSupabaseConfig) throw new Error('Supabase is not configured.')
    const { data, error } = await supabase.rpc('record_event_attendance', {
      target_registration_id: registration.id,
      checkin_method: 'qr',
    })
    if (error) throw error
    if (typeof data !== 'string') throw new Error('Attendance was saved without returning its ID.')
    const checkedInAt = new Date()
    return {
      id: data,
      eventId: registration.eventId,
      registrationId: registration.id,
      memberId: registration.memberId,
      memberName: registration.name,
      date: checkedInAt.toISOString().slice(0, 10),
      checkInTime: checkedInAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      status: 'Verified',
      method: 'QR',
      verifiedBy,
    }
  },
}

export const clubRepository = hasSupabaseConfig ? supabaseClubRepository : mockClubRepository
