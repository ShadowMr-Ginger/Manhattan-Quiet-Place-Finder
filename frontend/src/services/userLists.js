import { apiRequest } from './api'
import { apiSummaryToPlace } from './venues'

function mapItems(data) {
  return (data?.items ?? []).map(apiSummaryToPlace)
}

export async function fetchSaved() {
  return mapItems(await apiRequest('/users/me/saved'))
}

export async function addSaved(venueId) {
  await apiRequest(`/users/me/saved/${encodeURIComponent(venueId)}`, {
    method: 'POST',
  })
}

export async function removeSaved(venueId) {
  await apiRequest(`/users/me/saved/${encodeURIComponent(venueId)}`, {
    method: 'DELETE',
  })
}

export async function fetchRecent() {
  return mapItems(await apiRequest('/users/me/recent'))
}

export async function recordRecentView(venueId) {
  await apiRequest(`/users/me/recent/${encodeURIComponent(venueId)}`, {
    method: 'POST',
  })
}
