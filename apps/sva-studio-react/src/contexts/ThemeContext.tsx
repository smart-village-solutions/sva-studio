import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') as Theme | null

    let initialTheme: Theme = 'light'

    if (storedTheme) {
      initialTheme = storedTheme
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      initialTheme = 'dark'
    }

    setTheme(initialTheme)
    applyTheme(initialTheme)
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme((prevTheme) => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light'
      applyTheme(newTheme)
      localStorage.setItem('theme', newTheme)
      return newTheme
    })
  }

  const applyTheme = (newTheme: Theme) => {
    const htmlElement = document.documentElement
    if (newTheme === 'dark') {
      htmlElement.classList.add('dark')
      htmlElement.setAttribute('data-theme', 'dark')
    } else {
      htmlElement.classList.remove('dark')
      htmlElement.removeAttribute('data-theme')
    }
  }

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
