/** Must match backend/config/freelancerCareers.js */
export const FREELANCER_CAREERS = [
  'Full Stack',
  'IT',
  'Writing',
  'Design',
  'Development',
  'Mobile',
  'Marketing',
  'Video',
  'Translation',
  'Data',
  'Other',
] as const

export type FreelancerCareer = (typeof FREELANCER_CAREERS)[number]
