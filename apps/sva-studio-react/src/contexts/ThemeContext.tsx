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

// Helper to check if we're on the client side
const isClient = typeof window !== 'undefined' && typeof document !== 'undefined'

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    // This effect only runs on the client
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
      if (isClient) {
        localStorage.setItem('theme', newTheme)
      }
      return newTheme
    })
  }

  const applyTheme = (newTheme: Theme) => {
    if (!isClient) return

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
  // Return a safe default during SSR
  if (context === undefined) {
    return {
      theme: 'light' as Theme,
      toggleTheme: () => {},
    }
  }
  return context
}
