import { useTranslation } from 'react-i18next'
import styles from './Header.module.css'

export function Header() {
  const { t } = useTranslation()

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
          <button className={styles.themeButton} disabled title={t('common.theme')}>
            ◐
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
