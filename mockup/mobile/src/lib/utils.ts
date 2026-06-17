import type { QuietPlace, PlaceType } from '../types/quietPlace';

export function getTransitTimes(distanceKm: number) {
  return {
    walkMin: Math.max(1, Math.round(distanceKm * 12)),
    subwayMin: Math.max(2, Math.round(distanceKm * 4 + 3)),
    driveMin: Math.max(1, Math.round(distanceKm * 3 + 2)),
  };
}

export function getCrowdednessText(level: QuietPlace['crowdedness']) {
  return {
    low: 'Not Crowded',
    medium: 'Moderately Busy',
    high: 'Very Crowded',
  }[level];
}

export function getCrowdednessColor(level: QuietPlace['crowdedness']) {
  return {
    low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    high: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  }[level];
}

export function getTypeColor(type: PlaceType) {
  return {
    Cafe: 'bg-amber-500',
    Library: 'bg-blue-500',
    'Coworking Space': 'bg-purple-500',
    'Public Study Area': 'bg-emerald-500',
  }[type];
}

export function getTypeLabel(type: PlaceType) {
  return {
    Cafe: 'Cafe',
    Library: 'Library',
    'Coworking Space': 'Coworking',
    'Public Study Area': 'Public',
  }[type];
}

export function latLngToPosition(lat: number, lng: number) {
  const latMin = 40.70;
  const latMax = 40.82;
  const lngMin = -74.02;
  const lngMax = -73.93;
  const y = ((latMax - lat) / (latMax - latMin)) * 100;
  const x = ((lng - lngMin) / (lngMax - lngMin)) * 100;
  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
  };
}

export function formatRating(place: QuietPlace) {
  if (!place.reviews.length) return '0.0';
  return (place.reviews.reduce((s, r) => s + r.rating, 0) / place.reviews.length).toFixed(1);
}
