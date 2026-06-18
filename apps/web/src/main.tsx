import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { UserRole } from '@asistencia/shared'
import { App } from './app/App'
import './index.css'

// Smoke-test: importing from @asistencia/shared must work in both dev
// and prod. Path mapping (tsconfig + vite alias) points to
// `packages/shared/src/index.ts`. The UserRole import is unused at
// runtime — it just forces the bundler to follow the module.
void UserRole

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
