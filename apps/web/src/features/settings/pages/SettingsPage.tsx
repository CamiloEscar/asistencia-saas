import { useTranslation } from 'react-i18next'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/feedback/PageHeader'

export function SettingsPage() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-6">
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} />

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.theme.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            <ThemeOption
              icon={<Sun className="h-4 w-4" />}
              label={t('settings.theme.light')}
              active={theme === 'light'}
              onClick={() => setTheme('light')}
            />
            <ThemeOption
              icon={<Moon className="h-4 w-4" />}
              label={t('settings.theme.dark')}
              active={theme === 'dark'}
              onClick={() => setTheme('dark')}
            />
            <ThemeOption
              icon={<Monitor className="h-4 w-4" />}
              label={t('settings.theme.system')}
              active={theme === 'system'}
              onClick={() => setTheme('system')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.language.title')}</CardTitle>
          <CardDescription>{t('settings.language.help')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{t('settings.language.current')}</p>
        </CardContent>
      </Card>
    </div>
  )
}

interface ThemeOptionProps {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}

function ThemeOption({ icon, label, active, onClick }: ThemeOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-md border p-4 transition-colors ${
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border bg-background hover:bg-muted/30'
      }`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}
