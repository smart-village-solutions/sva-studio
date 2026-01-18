import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { ContentArea } from './ContentArea'
import styles from './RootLayout.module.css'

interface RootLayoutProps {
  children: ReactNode
}

export function RootLayout({ children }: RootLayoutProps) {
  return (
    <div className={styles.rootLayout}>
      <Sidebar />
      <div className={styles.mainContent}>
        <Header />
        <ContentArea>{children}</ContentArea>
      </div>
    </div>
  )
}
