// Google ratings for research runs, through the Places API (New) Text Search.
// Rating and review count go in the report with the retrieval date (references/analytics-inputs.md, section 4).
// Places returns at most five review texts and they may not be stored: they are passed to Claude
// as a sample for meeting questions and never saved.

export type PlaceResult = {
  id: string
  name: string
  address: string
  rating: number | null
  count: number
  mapsUri: string
  websiteUri: string
  matched: boolean // the profile's website is the same site we researched
  reviews: { rating: number; text: string }[]
}

const FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.websiteUri',
  'places.reviews',
].join(',')

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

export async function findPlace(apiKey: string, query: string, website?: string | null): Promise<PlaceResult | null> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify({ textQuery: query, pageSize: 5, languageCode: 'en' }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Places API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as { places?: Record<string, any>[] }
  const places = data.places ?? []
  if (!places.length) return null
  const want = website ? host(website) : ''
  // Prefer the profile whose website is the site we researched.
  const p = (want && places.find((x) => host(x.websiteUri ?? '') === want)) || places[0]
  return {
    id: p.id,
    name: p.displayName?.text ?? '',
    address: p.formattedAddress ?? '',
    rating: typeof p.rating === 'number' ? p.rating : null,
    count: p.userRatingCount ?? 0,
    mapsUri: p.googleMapsUri ?? '',
    websiteUri: p.websiteUri ?? '',
    matched: !!want && host(p.websiteUri ?? '') === want,
    reviews: (p.reviews ?? []).map((r: any) => ({ rating: r.rating, text: r.text?.text ?? r.originalText?.text ?? '' })),
  }
}

// Checks a key with a tiny request.
export async function testPlacesKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'places.id' },
      body: JSON.stringify({ textQuery: 'CN Tower Toronto', pageSize: 1 }),
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) return { ok: true, message: 'Connected' }
    if (res.status === 403) return { ok: false, message: 'Google refused this key. Turn on "Places API (New)" for it in Google Cloud.' }
    if (res.status === 400) return { ok: false, message: 'Google says this key is not valid' }
    return { ok: false, message: `Google returned ${res.status}` }
  } catch {
    return { ok: false, message: 'Could not reach Google. Try again.' }
  }
}
