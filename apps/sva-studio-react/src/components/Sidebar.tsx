import { useTranslation } from 'react-i18next'
import { navigationRegistry } from '@sva-studio/sdk'
import styles from './Sidebar.module.css'

export function Sidebar() {
  const { t } = useTranslation()
  let navItems = []
  let error = null

  try {
    navItems = navigationRegistry.getItems()
  } catch (err) {
    console.error('Failed to load navigation items:', err)
    error = err
  }

  if (error) {
    return (
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <h1>{t('layout.brandName')}</h1>
        </div>
        <nav className={styles.nav}>
          <div className={styles.errorContainer}>
            <p>{t('navigation.unavailable')}</p>
            <button
              className={styles.reloadButton}
              onClick={() => location.reload()}
            >
              {t('navigation.reload')}
            </button>
          </div>
        </nav>
      </aside>
    )
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <h1>{t('layout.brandName')}</h1>
      </div>
      <nav className={styles.nav}>
        <ul className={styles.navList}>
          {navItems.map((item) => (
            <li key={item.id} className={styles.navItem}>
              <a href={item.route || '#'} className={styles.navLink}>
                {item.icon && <span className={styles.icon}>{item.icon}</span>}
                <span>{item.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
