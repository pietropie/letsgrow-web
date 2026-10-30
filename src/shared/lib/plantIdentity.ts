// Copiado de letsgrow-mobile/lib/plantIdentity.ts por scripts/sync-shared.mjs. Não edite aqui.
type PlantIdentity = { display_name?: string | null; strain_name?: string | null }

export function plantDisplayName(plant?: PlantIdentity | null): string {
  return plant?.display_name?.trim() || plant?.strain_name?.trim() || 'Planta'
}

export type PlantIllustration = 'aurora' | 'sol'
/** Illustration for a plant without strain image, picked from its id (FNV-1a) so it stays the same wherever and whatever else is listed. */
export function plantIllustration(id: string): PlantIllustration {
  let hash = 0x811c9dc5
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193)
  return (hash >>> 0) % 2 ? 'sol' : 'aurora'
}
