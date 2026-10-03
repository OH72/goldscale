import type { CategoryType } from './common'

export interface CategoryResponse {
  id: string
  name: string
  type: CategoryType
  icon: string | null
  createdAt: string
}

export interface CreateCategoryRequest {
  name: string
  type: CategoryType
  icon: string | null
}

export interface UpdateCategoryRequest {
  name: string
  icon: string | null
}
