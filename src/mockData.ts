import type { ClubSnapshot } from './types'

const additionalWorkshopAttendees = [
  'Aashish Poudel', 'Sabina Koirala', 'Dipesh Tamang', 'Nima Sherpa', 'Shreya Joshi',
  'Bikash Lama', 'Kriti Bhattarai', 'Roshan Tamang', 'Pooja Shahi', 'Sagar Bista',
  'Anisha Khatri', 'Prabin Ghimire', 'Roshani KC', 'Milan Shrestha', 'Samir Basnet',
  'Anupama Rai', 'Kushal Thapa', 'Rachana Adhikari', 'Bibek Giri', 'Nisha Bhandari',
  'Prakash Karki', 'Alisha Gurung', 'Utsav Neupane', 'Sushmita Pandey', 'Hemant Regmi',
  'Diya Khadka', 'Suman Ghimire', 'Aayush Poudel', 'Elina Tamang', 'Ritesh Maharjan',
  'Sneha Shrestha', 'Kabin Lama', 'Rina Thapa', 'Pratik Koirala', 'Aastha Bista',
  'Shankar Rai', 'Manisha KC', 'Rohit Pandey', 'Dawa Sherpa',
].map((name, index) => ({
  id: `reg-workshop-${index + 1}`,
  eventId: 'evt-101',
  memberId: `workshop-member-${index + 1}`,
  name,
  email: `${name.toLowerCase().replaceAll(' ', '.')}@kist.edu.np`,
  registeredAt: `2026-09-${String(index % 28 + 1).padStart(2, '0')}`,
  status: 'Confirmed' as const,
}))

export const mockSnapshot: ClubSnapshot = {
  events: [
    {
      id: 'evt-101', title: 'Web Development Workshop',
      description: 'Build and ship your first responsive website. A hands-on afternoon covering HTML, CSS, JavaScript, and the tools teams use to launch real products.',
      date: '2026-10-17', startTime: '10:00', endTime: '15:30', location: 'Innovation Lab, KIST College', category: 'Workshop',
      image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=85',
      maxParticipants: 50, registrationDeadline: '2026-10-15', status: 'Registration Open',
    },
    {
      id: 'evt-102', title: 'UI/UX Design Workshop',
      description: 'Learn to turn ideas into clear, accessible interfaces through user research, wireframes, and rapid prototyping.',
      date: '2026-10-28', startTime: '11:00', endTime: '14:00', location: 'Design Studio, Block B', category: 'Design',
      image: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=1200&q=85',
      maxParticipants: 36, registrationDeadline: '2026-10-26', status: 'Registration Open',
    },
    {
      id: 'evt-103', title: 'Hackathon 2026',
      description: 'One day, mixed teams, and a real challenge from our campus community. Prototype a useful solution and present it to local tech mentors.',
      date: '2026-11-14', startTime: '08:30', endTime: '19:00', location: 'KIST Main Auditorium', category: 'Competition',
      image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=85',
      maxParticipants: 120, registrationDeadline: '2026-11-10', status: 'Published',
    },
    {
      id: 'evt-104', title: 'Career & Technology Seminar',
      description: 'A candid conversation with Kathmandu-based product designers and software engineers about early careers in technology.',
      date: '2026-09-19', startTime: '13:00', endTime: '16:00', location: 'Seminar Hall, KIST College', category: 'Seminar',
      image: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1200&q=85',
      maxParticipants: 80, registrationDeadline: '2026-09-17', status: 'Completed',
    },
    {
      id: 'evt-105', title: 'BIM Orientation Program',
      description: 'Welcome to the Bachelor of Information Management community. Meet your peers, faculty, and the BIM Club team.',
      date: '2026-08-22', startTime: '09:30', endTime: '12:30', location: 'KIST College of Management', category: 'Community',
      image: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=85',
      maxParticipants: 150, registrationDeadline: '2026-08-20', status: 'Completed',
    },
  ],
  registrations: [
    { id: 'reg-001', eventId: 'evt-101', memberId: 'member-100', name: 'Aarav Shrestha', email: 'aarav.shrestha@kist.edu.np', registeredAt: '2026-10-02', status: 'Confirmed' },
    { id: 'reg-002', eventId: 'evt-102', memberId: 'member-100', name: 'Aarav Shrestha', email: 'aarav.shrestha@kist.edu.np', registeredAt: '2026-10-03', status: 'Confirmed' },
    { id: 'reg-003', eventId: 'evt-101', memberId: 'member-101', name: 'Prakriti Rai', email: 'prakriti.rai@kist.edu.np', registeredAt: '2026-10-01', status: 'Confirmed' },
    { id: 'reg-004', eventId: 'evt-101', memberId: 'member-102', name: 'Sujan Karki', email: 'sujan.karki@kist.edu.np', registeredAt: '2026-09-30', status: 'Confirmed' },
    { id: 'reg-005', eventId: 'evt-103', memberId: 'member-103', name: 'Aditi Maharjan', email: 'aditi.maharjan@kist.edu.np', registeredAt: '2026-10-04', status: 'Confirmed' },
    { id: 'reg-006', eventId: 'evt-104', memberId: 'member-104', name: 'Nischal Thapa', email: 'nischal.thapa@kist.edu.np', registeredAt: '2026-09-09', status: 'Attended' },
    { id: 'reg-007', eventId: 'evt-104', memberId: 'member-105', name: 'Sanjana Gurung', email: 'sanjana.gurung@kist.edu.np', registeredAt: '2026-09-11', status: 'Attended' },
    { id: 'reg-008', eventId: 'evt-105', memberId: 'member-106', name: 'Rohan Basnet', email: 'rohan.basnet@kist.edu.np', registeredAt: '2026-08-15', status: 'Attended' },
    ...additionalWorkshopAttendees,
  ],
  donations: [
    { id: 'don-01', name: 'BIM Alumni Network', purpose: 'Hackathon prizes', amount: 25000, date: '2026-10-01', status: 'Received' },
    { id: 'don-02', name: 'Aarav Shrestha', purpose: 'Student fund', amount: 1500, date: '2026-09-28', status: 'Received' },
    { id: 'don-03', name: 'KIST IT Department', purpose: 'Workshop equipment', amount: 10000, date: '2026-09-20', status: 'Received' },
    { id: 'don-04', name: 'Maya Adhikari', purpose: 'General fund', amount: 2000, date: '2026-10-05', status: 'Pending' },
  ],
  members: [
    { id: 'member-100', name: 'Aarav Shrestha', email: 'aarav.shrestha@kist.edu.np', role: 'Participant', joined: '2026-02-14', points: 840 },
    { id: 'member-101', name: 'Prakriti Rai', email: 'prakriti.rai@kist.edu.np', role: 'Participant', joined: '2026-03-01', points: 1120 },
    { id: 'member-102', name: 'Sujan Karki', email: 'sujan.karki@kist.edu.np', role: 'BOD', joined: '2025-08-16', points: 1540 },
    { id: 'member-103', name: 'Aditi Maharjan', email: 'aditi.maharjan@kist.edu.np', role: 'Participant', joined: '2026-01-22', points: 1320 },
    { id: 'member-104', name: 'Nischal Thapa', email: 'nischal.thapa@kist.edu.np', role: 'Participant', joined: '2025-11-04', points: 970 },
    { id: 'member-105', name: 'Sanjana Gurung', email: 'sanjana.gurung@kist.edu.np', role: 'Participant', joined: '2026-03-19', points: 760 },
    { id: 'member-106', name: 'Rohan Basnet', email: 'rohan.basnet@kist.edu.np', role: 'Participant', joined: '2026-06-13', points: 680 },
    { id: 'member-107', name: 'Maya Adhikari', email: 'maya.adhikari@kist.edu.np', role: 'Admin', joined: '2024-07-11', points: 510 },
  ],
}