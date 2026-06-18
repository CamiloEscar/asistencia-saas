import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import esCommon from '../../locales/es/common.json'
import esErrors from '../../locales/es/errors.json'
import esDashboard from '../../locales/es/dashboard.json'
import esFeedback from '../../locales/es/feedback.json'

/**
 * I18next singleton configuration. Default locale is `es` (Spanish).
 * Locales for `en` and `pt` are wired in `en.json` / `pt.json` (empty
 * objects) so the structure is ready for post-MVP expansion (per spec
 * REQ-X-006). The actual translations live in `locales/<lng>/*.json`.
 */
export function initI18n() {
  if (i18n.isInitialized) return i18n
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        es: {
          common: esCommon,
          errors: esErrors,
          dashboard: esDashboard,
          feedback: esFeedback,
        },
      },
      fallbackLng: 'es',
      defaultNS: 'common',
      ns: ['common', 'errors', 'dashboard', 'feedback'],
      interpolation: { escapeValue: false }, // React already escapes
      detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
    })
  return i18n
}

export default i18n
