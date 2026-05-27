import axiosClient from './axiosClient'

export async function fetchTechSupportTypes(params = {}) {
  const response = await axiosClient.get('/api/tech-support-types', { params })
  return response.data || []
}

export async function fetchTechSupportTypeOptions() {
  const response = await axiosClient.get('/api/tech-support-types/options')
  const items = response.data || []
  return items.map((item) => ({
    techTypeId: item.id,
    label: item.name,
  }))
}
