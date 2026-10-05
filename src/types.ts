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
  purpose: string
  amount: number
  date: string
  status: 'Received' | 'Pending'
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
}