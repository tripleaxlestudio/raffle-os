import { createContext, useContext } from 'react'

export type UiTheme = 'legacy' | 'kocokan'

// Presentation only. The workspace/publisher remains owned by its existing layout.
export const UiThemeContext = createContext<UiTheme>('legacy')

export function useUiTheme() {
  return useContext(UiThemeContext)
}

export function themeClass(theme: UiTheme, legacyClass: string): string {
  return theme === 'kocokan'
    ? legacyClass.split(' ').map((name) => `kc-${name.replace(/^ui-/, '')}`).join(' ')
    : legacyClass
}

export function useUiClass() {
  const theme = useUiTheme()
  return (legacyClass: string) => themeClass(theme, legacyClass)
}
