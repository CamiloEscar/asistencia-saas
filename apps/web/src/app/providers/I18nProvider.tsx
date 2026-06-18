import { initI18n } from './i18n-setup'

/**
 * I18n provider. The i18next instance is initialised at module load
 * (singleton, see `./i18n.config.ts`), and `react-i18next` exposes the
 * `useTranslation` hook. This component is a render-noop — it exists
 * so the provider tree is explicit in `App.tsx`.
 */
void initI18n()

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
