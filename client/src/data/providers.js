// Single source of truth for providers (Phase 1).
// Counts render live from /api/search; descriptions here must stay neutral
// and factual. Licence/permission notes live on each resource; the About page
// carries the takedown contact.

export const PROVIDERS = [
  { id: 'acer', label: 'ACER', description: 'Official selective-entry format and sample material.', site: 'https://www.acer.org' },
  { id: 'vsse', label: 'VSSE', description: 'Verbal-style reasoning sets in the library.', site: null },
  { id: 'jac', label: 'JAC', description: 'Practice papers shared in the collection.', site: null },
  { id: 'capricorn', label: 'Capricorn', description: 'Practice papers shared in the collection.', site: null },
  { id: 'pearson', label: 'Pearson', description: 'Study and reference material in the collection.', site: null },
];

export const PROVIDER_BY_ID = Object.fromEntries(PROVIDERS.map((p) => [p.id, p]));
