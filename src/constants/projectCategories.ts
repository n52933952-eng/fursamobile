// projectCategories — must stay in sync with backend allow-list + PostProjectScreen
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
