import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import de from './locales/de.json'
import en from './locales/en.json'

const resources = {
  de: { translation: de },
  en: { translation: en },
}

i18next.use(initReactI18next).init({
  resources,
  lng: 'de',
  fallbackLng: 'de',
  interpolation: {
    escapeValue: true,
  },
})

export default i18next
