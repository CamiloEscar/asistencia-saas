import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import esCommon from '../../locales/es/common.json';
import esErrors from '../../locales/es/errors.json';

/**
 * I18n provider. Default locale is `es` (Spanish). Locales for `en` and `pt`
 * exist as empty objects to keep the structure ready for post-MVP expansion
 * (per spec REQ-X-006).
 */
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { common: esCommon, errors: esErrors },
    },
    fallbackLng: 'es',
    defaultNS: 'common',
    ns: ['common', 'errors'],
    interpolation: { escapeValue: false }, // React already escapes
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
  });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
