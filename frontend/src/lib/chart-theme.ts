import { useTheme } from 'next-themes'

// Categorical palettes drawn from inks and pigments rather than UI blues:
// petrol, brass, vermilion, forest, umber, madder, olive, slate, sand, stone.
const PALETTE_LIGHT = [
  '#24576b', '#a97c22', '#b83a26', '#2e6b4a', '#7a4a2b',
  '#9b4a6a', '#6f7d3a', '#4e5a68', '#c98b5a', '#8a8478',
]
const PALETTE_DARK = [
  '#5e9db3', '#d6aa4e', '#e06e55', '#7fb58f', '#b98663',
  '#c77a9a', '#a3b062', '#8c9aab', '#e0ae82', '#b5ae9f',
]

const LIGHT = {
  palette: PALETTE_LIGHT,
  ink: '#1c1b17',
  muted: '#6b6558',
  grid: '#d9d0bf',
  gold: '#a97c22',
  positive: '#2e6b4a',
  negative: '#b83a26',
  cursor: 'rgba(169, 124, 34, 0.08)',
}

const DARK = {
  palette: PALETTE_DARK,
  ink: '#ece5d6',
  muted: '#9a9383',
  grid: '#2e2d26',
  gold: '#d6aa4e',
  positive: '#7fb58f',
  negative: '#e06e55',
  cursor: 'rgba(214, 170, 78, 0.08)',
}

export type ChartTheme = typeof LIGHT & { isDark: boolean }

/** Colours for Recharts, which needs literal values for SVG attributes. */
export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return { ...(isDark ? DARK : LIGHT), isDark }
}

export const axisTick = (theme: ChartTheme) => ({
  fill: theme.muted,
  fontSize: 11,
  fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
})

export function compactNumber(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return `${v}`
}
