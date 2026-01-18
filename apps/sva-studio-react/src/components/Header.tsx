import { useTranslation } from 'react-i18next'
import { useTheme } from '../contexts/ThemeContext'
import styles from './Header.module.css'

export function Header() {
  const { t } = useTranslation()

  // Use a try-catch to handle SSR scenarios where ThemeProvider might not be available yet
  let theme = 'light'
  let toggleTheme = () => {}

  try {
    const themeContext = useTheme()
    theme = themeContext.theme
    toggleTheme = themeContext.toggleTheme
  } catch (error) {
    // ThemeProvider not available during SSR, use default light theme
  }

  const isLightMode = theme === 'light'
  const themeLabel = isLightMode ? t('theme.darkMode') : t('theme.lightMode')

  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <h2 className={styles.pageTitle}>{t('sidebar.dashboard')}</h2>
        <div className={styles.actions}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder={t('header.searchPlaceholder')}
            disabled
          />
          <button
            className={styles.themeButton}
            onClick={toggleTheme}
            title={themeLabel}
            aria-label={t('theme.toggleTheme')}
          >
            {isLightMode ? '☀️' : '🌙'}
          </button>
          <select className={styles.languageSelect} disabled title={t('common.language')}>
            <option value="de">{t('common.languageDe')}</option>
            <option value="en">{t('common.languageEn')}</option>
          </select>
          <button className={styles.userButton} disabled title={t('common.profile')}>
            User
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
