export type Role = 'Admin' | 'BOD' | 'Participant'

export type EventStatus =
  | 'Draft'
  | 'Published'
  | 'Registration Open'
  | 'Registration Closed'
  | 'Completed'
  | 'Cancelled'

export type ClubEvent = {
  id: string
  title: string
  description: string
  date: string
  startTime: string
  endTime: string
  location: string
  category: string
  image: string
  maxParticipants: number
  registrationDeadline: string
  status: EventStatus
}

export type Registration = {
  id: string
  eventId: string
  memberId: string
  name: string
  email: string
  registeredAt: string
  status: 'Confirmed' | 'Attended' | 'Cancelled'
}

export type Donation = {
  id: string
  name: string
  memberId?: string
  purpose: string
  amount: number
  date: string
  status: 'Received' | 'Pending'
}

export type AttendanceRecord = {
  id: string
  eventId: string
  registrationId: string
  memberId: string
  memberName: string
  date: string
  checkInTime: string
  status: 'Verified'
  method: 'QR'
  verifiedBy: string
}

export type ClubFile = {
  id: string
  name: string
  type: string
  category: 'Notices' | 'Event Documents' | 'Club Guidelines' | 'Reports' | 'Other'
  uploadDate: string
  uploadedBy: string
  size: string
}

export type Notification = {
  id: string
  title: string
  detail: string
  timestamp: string
  read: boolean
  recipient: Role | 'All'
}

export type ActivityLogEntry = {
  id: string
  user: string
  action: string
  timestamp: string
}

export type Member = {
  id: string
  name: string
  email: string
  role: Role
  joined: string
  points: number
}

export type ClubSnapshot = {
  events: ClubEvent[]
  registrations: Registration[]
  donations: Donation[]
  members: Member[]
  attendance: AttendanceRecord[]
  files: ClubFile[]
  notifications: Notification[]
  activityLog: ActivityLogEntry[]
}