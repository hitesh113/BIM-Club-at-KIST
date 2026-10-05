import { mockSnapshot } from '../mockData'
import type { ClubSnapshot } from '../types'

export interface ClubRepository {
  loadSnapshot(): ClubSnapshot
}

export const mockClubRepository: ClubRepository = {
  loadSnapshot() {
    return {
      events: mockSnapshot.events.map((item) => ({ ...item })),
      registrations: mockSnapshot.registrations.map((item) => ({ ...item })),
      donations: mockSnapshot.donations.map((item) => ({ ...item })),
      members: mockSnapshot.members.map((item) => ({ ...item })),
    }
  },
}