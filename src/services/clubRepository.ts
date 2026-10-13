import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { mockSnapshot } from '../mockData'
import type { ActivityLogEntry, AttendanceRecord, ClubEvent, ClubFile, ClubSnapshot, Donation, Member, Notification, Registration, Role } from '../types'

export interface ClubRepository {
  loadSnapshot(): Promise<ClubSnapshot> | ClubSnapshot
  loadEvents(): Promise<ClubEvent[]>
  uploadClubFile(file: File, uploaderId: string): Promise<ClubFile>
  downloadClubFile(file: ClubFile): Promise<Blob>
  createDonation(donation: Omit<Donation, 'id' | 'date' | 'status'>, memberId: string, role: Role): Promise<Donation>
  loadNotifications(memberId: string, role: Role): Promise<Notification[]>
  createNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>, createdBy: string): Promise<Notification>
  markNotificationRead(notificationId: string, memberId: string): Promise<void>
  uploadProfilePhoto(memberId: string, file: File): Promise<{ path: string | null; url: string }>
  loadProfilePhoto(photoPath: string | null): Promise<string | null>
  createEvent(event: Omit<ClubEvent, 'id'>): Promise<ClubEvent>
  updateEvent(id: string, event: Omit<ClubEvent, 'id'>): Promise<ClubEvent>
  updateEventStatus(event: ClubEvent, status: ClubEvent['status']): Promise<ClubEvent>
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

const fileTypeFromName = (name: string): string => {
  const extension = name.split('.').pop()
  return name.includes('.') && extension ? extension.toUpperCase() : 'FILE'
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

const mapClubEvent = (event: Record<string, any>): ClubEvent => ({
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
})

const eventToDatabase = (event: Omit<ClubEvent, 'id'>) => ({
  title: event.title.trim(),
  description: event.description,
  event_date: event.date,
  start_time: event.startTime,
  end_time: event.endTime,
  location: event.location.trim(),
  category: event.category,
  image_url: event.image || null,
  max_participants: event.maxParticipants,
  registration_deadline: event.registrationDeadline,
  status: event.status,
})

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
  async loadEvents() {
    return mockSnapshot.events.map((event) => ({ ...event }))
  },
  async uploadClubFile() {
    throw new Error('Supabase is not configured. Club files cannot be uploaded.')
  },
  async downloadClubFile() {
    throw new Error('Supabase is not configured. Club files cannot be downloaded.')
  },
  async createDonation() {
    throw new Error('Supabase is not configured. Donations cannot be recorded.')
  },
  async loadNotifications() {
    return mockSnapshot.notifications.map((notification) => ({ ...notification }))
  },
  async createNotification(notification) {
    return {
      ...notification,
      id: `note-${Date.now()}`,
      timestamp: 'Just now',
      read: false,
    }
  },
  async markNotificationRead() {},
  async uploadProfilePhoto(_memberId, file) {
    return { path: null, url: URL.createObjectURL(file) }
  },
  async loadProfilePhoto() {
    return null
  },
  async createEvent(event) {
    return { ...event, id: `evt-${Date.now()}` }
  },
  async updateEvent(id, event) {
    return { ...event, id }
  },
  async updateEventStatus(event, status) {
    return { ...event, status }
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
  async loadEvents() {
    if (!supabase || !hasSupabaseConfig) {
      return mockClubRepository.loadEvents()
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: false })
    if (error) throw error
    return (data ?? []).map((event) => mapClubEvent(event))
  },
  async loadNotifications(memberId, role) {
    if (!supabase || !hasSupabaseConfig) {
      return mockClubRepository.loadNotifications(memberId, role)
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, body, recipient_id, recipient_role, created_at')
      .order('created_at', { ascending: false })
      .limit(30)
    if (error) throw error

    const notifications = data ?? []
    const { data: reads, error: readsError } = await supabase
      .from('notification_reads')
      .select('notification_id')
      .eq('member_id', memberId)
    if (readsError) throw readsError

    const readIds = new Set((reads ?? []).map((read) => read.notification_id))
    return notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      detail: notification.body,
      timestamp: formatRelativeTime(notification.created_at),
      read: readIds.has(notification.id),
      recipient: notification.recipient_role
        ? asRole(notification.recipient_role)
        : notification.recipient_id
          ? role
          : 'All',
    }))
  },
  async uploadClubFile(file, uploaderId) {
    if (!supabase || !hasSupabaseConfig) {
      throw new Error('Supabase is not configured. Club files cannot be uploaded.')
    }

    const safeName = file.name.replace(/[^\w.-]+/g, '-')
    const storagePath = `${uploaderId}/${crypto.randomUUID()}-${safeName}`
    const { error: uploadError } = await supabase.storage
      .from('club-private-files')
      .upload(storagePath, file, { contentType: file.type || 'application/octet-stream' })
    if (uploadError) throw uploadError

    const { data, error: metadataError } = await supabase
      .from('files')
      .insert({
        name: file.name,
        storage_path: storagePath,
        mime_type: file.type || 'application/octet-stream',
        category: 'Other',
        access_level: 'members',
        size_bytes: file.size,
        uploaded_by: uploaderId,
      })
      .select('id, name, storage_path, mime_type, category, uploaded_at, uploaded_by, size_bytes')
      .single()

    if (metadataError) {
      const { error: cleanupError } = await supabase.storage
        .from('club-private-files')
        .remove([storagePath])
      if (cleanupError) {
        throw new Error(`${metadataError.message}; uploaded file cleanup failed: ${cleanupError.message}`)
      }
      throw metadataError
    }

    return {
      id: data.id,
      name: data.name,
      type: fileTypeFromName(data.name),
      mimeType: data.mime_type,
      storagePath: data.storage_path,
      category: asFileCategory(data.category),
      uploadDate: formatDate(data.uploaded_at),
      uploadedBy: 'You',
      size: `${Math.max(1, Math.round(data.size_bytes / 1024))} KB`,
    }
  },
  async downloadClubFile(file) {
    if (!supabase || !hasSupabaseConfig) {
      throw new Error('Supabase is not configured. Club files cannot be downloaded.')
    }

    const { data, error } = await supabase.storage
      .from('club-private-files')
      .download(file.storagePath)
    if (error) throw error
    return data
  },
  async createDonation(donation, memberId, role) {
    if (!supabase || !hasSupabaseConfig) {
      throw new Error('Supabase is not configured. Donations cannot be recorded.')
    }

    const isAdmin = role === 'Admin'
    const { data, error } = await supabase
      .from('donations')
      .insert({
        donor_profile_id: isAdmin ? null : memberId,
        contributor_name: donation.name,
        purpose: donation.purpose,
        amount: donation.amount,
        status: isAdmin ? 'received' : 'pending',
        recorded_by: isAdmin ? memberId : null,
      })
      .select('id, donor_profile_id, contributor_name, purpose, amount, donated_at, status')
      .single()
    if (error) throw error
    return {
      id: data.id,
      name: data.contributor_name,
      memberId: data.donor_profile_id ?? undefined,
      purpose: data.purpose,
      amount: Number(data.amount),
      date: formatDate(data.donated_at),
      status: data.status === 'received' ? 'Received' : 'Pending',
    }
  },
  async createNotification(notification, createdBy) {
    if (!supabase || !hasSupabaseConfig) {
      return mockClubRepository.createNotification(notification, createdBy)
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        title: notification.title,
        body: notification.detail,
        recipient_role: notification.recipient === 'All' ? null : notification.recipient.toLowerCase(),
        created_by: createdBy,
      })
      .select('id, title, body, recipient_role, created_at')
      .single()
    if (error) throw error
    return {
      id: data.id,
      title: data.title,
      detail: data.body,
      timestamp: formatRelativeTime(data.created_at),
      read: false,
      recipient: data.recipient_role ? asRole(data.recipient_role) : 'All',
    }
  },
  async markNotificationRead(notificationId, memberId) {
    if (!supabase || !hasSupabaseConfig) return
    const { error } = await supabase
      .from('notification_reads')
      .upsert(
        { notification_id: notificationId, member_id: memberId },
        { onConflict: 'notification_id,member_id' },
      )
    if (error) throw error
  },
  async uploadProfilePhoto(memberId, file) {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    }
    const extension = extensions[file.type]
    if (!extension) throw new Error('Choose a JPG, PNG, or WebP image.')
    if (file.size > 5 * 1024 * 1024) throw new Error('Profile photos must be 5 MB or smaller.')
    if (!supabase || !hasSupabaseConfig) {
      return mockClubRepository.uploadProfilePhoto(memberId, file)
    }

    const path = `${memberId}/${Date.now()}.${extension}`
    const { error: uploadError } = await supabase.storage
      .from('member-profile-photos')
      .upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) throw uploadError

    const { data, error: urlError } = await supabase.storage
      .from('member-profile-photos')
      .createSignedUrl(path, 60 * 60)
    if (urlError) {
      const { error: cleanupError } = await supabase.storage
        .from('member-profile-photos')
        .remove([path])
      if (cleanupError) throw new Error(`${urlError.message}; uploaded photo cleanup failed: ${cleanupError.message}`)
      throw urlError
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ photo_path: path })
      .eq('id', memberId)
      .select('id')
      .single()
    if (profileError) {
      const { error: cleanupError } = await supabase.storage
        .from('member-profile-photos')
        .remove([path])
      if (cleanupError) throw new Error(`${profileError.message}; uploaded photo cleanup failed: ${cleanupError.message}`)
      throw profileError
    }
    return { path, url: data.signedUrl }
  },
  async loadProfilePhoto(photoPath) {
    if (!photoPath || !supabase || !hasSupabaseConfig) return null
    const { data, error } = await supabase.storage
      .from('member-profile-photos')
      .createSignedUrl(photoPath, 60 * 60)
    if (error) throw error
    return data.signedUrl
  },
  async createEvent(event) {
    if (!supabase || !hasSupabaseConfig) {
      return mockClubRepository.createEvent(event)
    }

    const { data, error } = await supabase
      .from('events')
      .insert(eventToDatabase(event))
      .select('*')
      .single()
    if (error) throw error
    return mapClubEvent(data)
  },
  async updateEvent(id, event) {
    if (!supabase || !hasSupabaseConfig) {
      return mockClubRepository.updateEvent(id, event)
    }

    const { data, error } = await supabase
      .from('events')
      .update(eventToDatabase(event))
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return mapClubEvent(data)
  },
  async updateEventStatus(event, status) {
    if (!supabase || !hasSupabaseConfig) {
      return mockClubRepository.updateEventStatus(event, status)
    }

    const { data, error } = await supabase
      .from('events')
      .update({ status })
      .eq('id', event.id)
      .select('*')
      .single()
    if (error) throw error
    return mapClubEvent(data)
  },
  async loadSnapshot() {
    if (!supabase || !hasSupabaseConfig) {
      return mockClubRepository.loadSnapshot()
    }

    const [eventsResult, profilesResult, registrationsResult, attendanceResult, filesResult, donationsResult, notificationsResult, notificationReadsResult, activityLogsResult, pointsResult] = await Promise.all([
      supabase.from('events').select('*').order('event_date', { ascending: false }),
      supabase.from('profiles').select('*'),
      supabase.from('event_registrations').select('*'),
      supabase.from('attendance').select('*'),
      supabase.from('files').select('*'),
      supabase.from('donations').select('*'),
      supabase.from('notifications').select('*'),
      supabase.from('notification_reads').select('notification_id'),
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
      notificationReadsResult,
      activityLogsResult,
      pointsResult,
    ].find((result) => result.error)
    if (failedQuery?.error) throw failedQuery.error

    const profilesById = new Map<string, any>((profilesResult.data ?? []).map((profile: any) => [profile.id, profile]))
    const pointsByMember = new Map<string, number>()
    for (const transaction of pointsResult.data ?? []) {
      pointsByMember.set(transaction.member_id, (pointsByMember.get(transaction.member_id) ?? 0) + Number(transaction.points_delta ?? 0))
    }

    const events: ClubEvent[] = ((eventsResult.data ?? []) as any[]).map((event) => mapClubEvent(event))

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
      type: fileTypeFromName(file.name),
      mimeType: file.mime_type ?? 'application/octet-stream',
      storagePath: file.storage_path,
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

    const notificationReadRows = (notificationReadsResult.data ?? []) as any[]
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
