import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import styles from './index.module.css'

export const HomePage = () => {
  const { t } = useTranslation()

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>
        {t('home.welcome')}
      </h1>
      <p className={styles.description}>
        {t('home.description')}
      </p>
    </div>
  )
}

export const Route = createFileRoute('/')({ component: HomePage })
