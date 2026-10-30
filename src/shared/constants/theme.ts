// Copiado de letsgrow-mobile/constants/theme.ts por scripts/sync-shared.mjs. Não edite aqui.

export const colors = {
  bg:          '#E2E1E0',
  surface:     '#F8F5F2',
  surfaceHigh: '#F7F6F3',
  border:      '#B6BDB6',
  primary:     '#485D50',
  primaryDark: '#2C4330',
  text:        '#2F3F34',
  textMuted:   '#58615B',
  display:     '#454846',
  inputBorder: '#89958B',
  sourceHighlight: '#BEE5D1',
  sourceSecondary: '#FDB6E6',
  textFaint:   '#A8A8A8',
  error:       '#C44536',
  danger:      '#C44536',
  warning:     '#E8C547',
  success:     '#3F5C43',
  purple:      '#8B6BB7',
  sage:        '#D7E6D8',
  sageText:    '#2F4A32',
  yellow:      '#F3E48A',
  yellowText:  '#6B5A12',
  pink:        '#F0A8C8',
  pinkText:    '#7A2E55',
  blueSoft:    '#D7E4F2',
  // Figma variables (LetsGrow - Colors/*) used by the panel screens.
  surfaceBobby: '#DFE9DF',   // surface/bobby
  stroke:       '#BBBCC0',   // stroke/500
  strokeSoft:   '#BEC3C0',   // gray/500
  stateStable:  '#C3CAD8',   // state/stable
  stateAlert:   '#FFFD98',   // state/alert
  stateError:   '#EF4444',   // state/error
  stateSuccess: '#1DB76A',   // state/success (Bobby send button)
  stateNight:   '#D7E4F2',   // state/night (timer center in the dark period)
  textPrimary:  '#28392E',   // text/primary
  textSecondary:'#58605A',   // text/secondary
  special:      '#63BA98',   // special/500
  onPrimary:    '#FFFFFF',
}

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
}

export const radius = {
  sm:   4,
  md:   8,
  lg:   16,
  xl:   20,
  xxl:  28,
  full: 9999,
}

export const typography = {
  h1:      { fontSize: 28, fontFamily: 'Figtree_700Bold', color: colors.text,      lineHeight: 36 },
  h2:      { fontSize: 22, fontFamily: 'Figtree_700Bold', color: colors.text,      lineHeight: 30 },
  h3:      { fontSize: 18, fontFamily: 'Figtree_600SemiBold', color: colors.text,      lineHeight: 26 },
  body:    { fontSize: 16, fontFamily: 'Figtree_400Regular', color: colors.text,      lineHeight: 24 },
  caption: { fontSize: 14, fontFamily: 'Figtree_400Regular', color: colors.textMuted, lineHeight: 20 },
  label:   { fontSize: 14, fontFamily: 'Figtree_500Medium', color: colors.textMuted, lineHeight: 20 },
}

export const phases: Record<string, { color: string; label: string }> = {
  unknown: { color: colors.textMuted, label: 'Fase não informada' },
  germination: { color: '#79C0FF', label: 'Germinação'     },
  seedling:    { color: '#56D364', label: 'Muda'           },
  veg:         { color: '#3F5C43', label: 'Vegetativo'     },
  flower:      { color: '#BC8CFF', label: 'Floração'       },
  late_flower: { color: '#D2A8FF', label: 'Floração Final' },
  harvest:     { color: '#E3B341', label: 'Colheita'       },
  drying:      { color: '#F0883E', label: 'Secagem'        },
  curing:      { color: '#FFA657', label: 'Cura'           },
}
