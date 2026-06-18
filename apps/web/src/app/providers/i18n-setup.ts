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
      ns: [
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
      ],
      interpolation: { escapeValue: false }, // React already escapes
      detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
    })
  return i18n
}

export default i18n
