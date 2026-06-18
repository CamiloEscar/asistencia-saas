import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { initI18n as initI18nApp } from '@/app/providers/i18n-setup'
import { AttendanceRoster } from './AttendanceRoster'
import type { RosterResponse } from '../api/attendance.api'

// Mock the api hooks so the component doesn't try to call the network.
import type * as AttendanceApi from '../api/attendance.api'

vi.mock('../api/attendance.api', async () => {
  const actual = await vi.importActual<typeof AttendanceApi>('../api/attendance.api')
  return {
    ...actual,
    useMarkAttendance: () => ({ mutateAsync: vi.fn().mockResolvedValue({ errors: [] }) }),
    useUpdateAttendance: () => ({ mutateAsync: vi.fn().mockResolvedValue({ errors: [] }) }),
    useUploadEvidence: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
  }
})

beforeAll(async () => {
  const i = initI18nApp()
  if (i && i.isInitialized) {
    i.changeLanguage('es')
  }
  // Wait until all namespaces are loaded.
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
  await Promise.all(ns.map((n) => i.loadNamespaces(n)))
})

const roster: RosterResponse = {
  session: {
    id: 'sess-1',
    courseId: 'course-1',
    courseName: 'Algoritmos',
    scheduledAt: new Date(),
    durationMin: 80,
    status: 'OPEN',
    enrolledCount: 3,
    attendanceTaken: false,
  },
  students: [
    { id: 'stu-1', fullName: 'Ada Lovelace', legajo: 'A001', status: 'PRESENT' },
    { id: 'stu-2', fullName: 'Alan Turing', legajo: 'A002', status: 'PRESENT' },
    { id: 'stu-3', fullName: 'Grace Hopper', legajo: 'A003', status: 'PRESENT' },
  ],
}

function renderRoster(props: Partial<React.ComponentProps<typeof AttendanceRoster>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <I18nextProvider i18n={initI18nApp()}>
      <QueryClientProvider client={qc}>
        <AttendanceRoster sessionId="sess-1" roster={roster} isEdit={false} {...props} />
      </QueryClientProvider>
    </I18nextProvider>,
  )
}

describe('AttendanceRoster', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the three students in the roster', () => {
    renderRoster()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Alan Turing')).toBeInTheDocument()
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
  })

  it('defaults every row to PRESENT', () => {
    renderRoster()
    const presentChips = screen.getAllByRole('button', { pressed: true, name: /asist/i })
    expect(presentChips).toHaveLength(3)
  })

  it('updates a single student state when a chip is clicked', async () => {
    const user = userEvent.setup()
    renderRoster()
    const adaRow = screen.getByText('Ada Lovelace').closest('tr')!
    const ausenteBtn = within(adaRow).getByRole('button', { name: /ausente/i })
    await user.click(ausenteBtn)
    const presentChips = screen.getAllByRole('button', { pressed: true, name: /asist/i })
    expect(presentChips).toHaveLength(2)
  })

  it('bulk action "Marcar todos presentes" sets every row back to PRESENT', async () => {
    const user = userEvent.setup()
    renderRoster()
    const adaRow = screen.getByText('Ada Lovelace').closest('tr')!
    await user.click(within(adaRow).getByRole('button', { name: /ausente/i }))
    const markAllBtn = screen.getByRole('button', { name: /marcar todos presentes/i })
    await user.click(markAllBtn)
    const presentChips = screen.getAllByRole('button', { pressed: true, name: /asist/i })
    expect(presentChips).toHaveLength(3)
  })

  it('calls onSubmitted after the Guardar button is clicked', async () => {
    const user = userEvent.setup()
    const onSubmitted = vi.fn()
    renderRoster({ onSubmitted })
    const adaRow = screen.getByText('Ada Lovelace').closest('tr')!
    await user.click(within(adaRow).getByRole('button', { name: /ausente/i }))
    const submit = screen.getByRole('button', { name: /guardar asistencia/i })
    await user.click(submit)
    await new Promise((r) => setTimeout(r, 20))
    expect(onSubmitted).toHaveBeenCalled()
  })
})
