// Copiado de letsgrow-mobile/lib/carousel.ts por scripts/sync-shared.mjs. Não edite aqui.
/** Card carousels (Plantas tab, Início): one card fills the width; several show dots and a peek of the next card. */

/** Width of each card: the whole available width when it is the only one, otherwise the design width capped to leave a peek. */
export function carouselCardWidth(count: number, available: number, cardWidth: number, peek: number): number {
  if (count <= 1) return available
  return Math.max(0, Math.min(cardWidth, available - peek))
}

/** Index of the dot to highlight for a horizontal offset; the scroll end always marks the last card. */
export function carouselIndex(offset: number, count: number, step: number, maxOffset: number): number {
  if (count <= 1 || step <= 0) return 0
  if (maxOffset > 0 && offset >= maxOffset - 1) return count - 1
  return Math.min(count - 1, Math.max(0, Math.round(offset / step)))
}

/** Keeps a card index inside the list (0 for an empty one), e.g. after archiving the last card. */
export function clampCarouselIndex(index: number, count: number): number {
  return Math.min(Math.max(0, count - 1), Math.max(0, index))
}

/** Scroll offset that shows a card: its start, but never past the end of the content (`count` cards of `step` = width + gap). */
export function carouselOffset(index: number, count: number, step: number, gap: number, available: number): number {
  const maxOffset = Math.max(0, count * step - gap - available)
  return Math.min(clampCarouselIndex(index, count) * step, maxOffset)
}
