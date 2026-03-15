// Vehicle make/model catalog that fetches from the database
export type VehicleCatalog = Record<string, string[]>

const STORAGE_KEY = 'vehicle-catalog'
const MAKES_CACHE_KEY = 'vehicle-makes-cache'
const MAKES_CACHE_EXPIRY_KEY = 'vehicle-makes-cache-expiry'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Fallback seed catalog in case API is unavailable
const fallbackCatalog: VehicleCatalog = {
  'Maruti Suzuki': ['Swift', 'Baleno', 'Alto', 'Dzire', 'Brezza'],
  Hyundai: ['i10', 'i20', 'Creta', 'Venue', 'Verna'],
  Tata: ['Nexon', 'Punch', 'Harrier', 'Safari', 'Altroz'],
}

let catalogCache: VehicleCatalog | null = null
let makesCache: string[] | null = null
let modelsCacheMap: Map<string, string[]> = new Map()

function loadMakesFromStorage(): string[] | null {
  if (typeof window === 'undefined') return null
  try {
    const cached = window.localStorage.getItem(MAKES_CACHE_KEY)
    const expiry = window.localStorage.getItem(MAKES_CACHE_EXPIRY_KEY)
    
    if (cached && expiry && Date.now() < parseInt(expiry)) {
      return JSON.parse(cached)
    }
    // Clear expired cache
    window.localStorage.removeItem(MAKES_CACHE_KEY)
    window.localStorage.removeItem(MAKES_CACHE_EXPIRY_KEY)
  } catch {
    // ignore storage failures
  }
  return null
}

function saveMakesToStorage(makes: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MAKES_CACHE_KEY, JSON.stringify(makes))
    window.localStorage.setItem(MAKES_CACHE_EXPIRY_KEY, String(Date.now() + CACHE_DURATION))
  } catch {
    // ignore storage failures
  }
}

export function getMakes(): string[] {
  // Return cached makes if available
  if (makesCache) {
    return makesCache
  }

  // Try to load from localStorage
  const cached = loadMakesFromStorage()
  if (cached) {
    makesCache = cached
    return cached
  }

  // Fallback to seed catalog
  return Object.keys(fallbackCatalog).sort((a, b) => a.localeCompare(b))
}

export async function fetchMakesFromAPI(): Promise<string[]> {
  try {
    const response = await fetch('/api/vehicle-makes-models')
    if (!response.ok) throw new Error('Failed to fetch makes')
    const makes = await response.json()
    
    // Cache the result
    makesCache = makes
    saveMakesToStorage(makes)
    
    return makes
  } catch (error) {
    console.warn('Failed to fetch makes from API, using fallback:', error)
    return getMakes()
  }
}

export function getModels(make: string): string[] {
  // Check in-memory cache first
  if (modelsCacheMap.has(make)) {
    return modelsCacheMap.get(make)!
  }

  // Fallback to seed
  const models = fallbackCatalog[make] || []
  return [...models].sort((a, b) => a.localeCompare(b))
}

export async function fetchModelsFromAPI(make: string): Promise<string[]> {
  try {
    const response = await fetch(`/api/vehicle-makes-models?make=${encodeURIComponent(make)}`)
    if (!response.ok) throw new Error('Failed to fetch models')
    const data = await response.json()
    
    // Extract model strings from the response
    const models = Array.isArray(data) ? data.map((item: any) => item.model || item) : []
    
    // Cache the result
    modelsCacheMap.set(make, models)
    
    return models
  } catch (error) {
    console.warn(`Failed to fetch models for ${make} from API:`, error)
    return getModels(make)
  }
}

export async function addMakeModel(make: string, model: string) {
  const cleanMake = make.trim()
  const cleanModel = model.trim()
  if (!cleanMake || !cleanModel) return

  try {
    const response = await fetch('/api/vehicle-makes-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ make: cleanMake, model: cleanModel }),
    })

    if (response.ok) {
      // Clear cache to refetch on next load
      makesCache = null
      modelsCacheMap.delete(cleanMake)
    }
  } catch (error) {
    console.warn('Failed to add make/model to database:', error)
  }
}
