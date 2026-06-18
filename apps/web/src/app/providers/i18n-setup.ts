import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import esCommon from '../../locales/es/common.json'
import esErrors from '../../locales/es/errors.json'
import esDashboard from '../../locales/es/dashboard.json'
import esFeedback from '../../locales/es/feedback.json'
import esInstitutions from '../../locales/es/institutions.json'
import esUsers from '../../locales/es/users.json'
import esStudents from '../../locales/es/students.json'
import esTeachers from '../../locales/es/teachers.json'
import esSubjects from '../../locales/es/subjects.json'
import esCourses from '../../locales/es/courses.json'
import esAttendance from '../../locales/es/attendance.json'
import esProfile from '../../locales/es/profile.json'

/**
 * I18next singleton configuration. Default locale is `es` (Spanish).
 * The actual translations live in `locales/<lng>/*.json`.
 *
 * Convention: feature code uses `t('attendance.take.submit')` — the first
 * dot-segment is the namespace. We map that to `i18next`'s preferred
 * `ns:key` form via a `parseMissingKeyHandler` so feature code can
 * `useTranslation()` (default ns) and still resolve cross-namespace
 * keys without a prefix.
 */
export function initI18n() {
  if (i18n.isInitialized) {
    const ns = [
      'common',
      'errors',
      'dashboard',
      'feedback',
      'institutions',
      'users',
      'students',
      'teachers',
      'subjects',
      'courses',
      'attendance',
      'profile',
    ]
    ns.forEach((n) => {
      if (!i18n.hasLoadedNamespace(n)) {
        void i18n.loadNamespaces(n)
      }
    })
    return i18n
  }
  const ns = [
    'common',
    'errors',
    'dashboard',
    'feedback',
    'institutions',
    'users',
    'students',
    'teachers',
    'subjects',
    'courses',
    'attendance',
    'profile',
  ]
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
          institutions: esInstitutions,
          users: esUsers,
          students: esStudents,
          teachers: esTeachers,
          subjects: esSubjects,
          courses: esCourses,
          attendance: esAttendance,
          profile: esProfile,
        },
      },
      fallbackLng: 'es',
      defaultNS: 'common',
      ns,
      partialBundledLanguages: true,
      interpolation: { escapeValue: false }, // React already escapes
      detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
      // Treat the first dot-segment of a key as a namespace hint. This lets
      // `t('attendance.take.submit')` (the common pattern in feature code)
      // resolve to the `attendance` namespace without forcing every
      // component to call `useTranslation('attendance')`.
      parseMissingKeyHandler: (key: string) => {
        const parts = key.split('.')
        if (parts.length < 2) return key
        const candidateNs = parts[0] ?? ''
        if (ns.includes(candidateNs)) {
          const subKey = parts.slice(1).join('.')
          const translated = i18n.t(`${candidateNs}:${subKey}`)
          // If i18next returns the qualified key (no translation found),
          // fall back to the original key. Otherwise return the value.
          if (translated && translated !== `${candidateNs}:${subKey}`) {
            return translated
          }
        }
        return key
      },
    })
  return i18n
}

export default i18n
