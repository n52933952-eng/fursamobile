/** Must match Post Project & backend allow-list (order for UI chips). */
export const PROJECT_CATEGORIES = [
  'Design',
  'Development',
  'Writing',
  'Marketing',
  'Video',
  'Translation',
  'Data',
  'Other',
] as const

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number]
