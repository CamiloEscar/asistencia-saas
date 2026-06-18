import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import apiClient from '@/lib/api-client'
import type {
  AttendanceMarkRequest,
  AttendanceMarkResponse,
  AttendanceRecord,
  ClassSession,
  ListAttendanceQuery,
  PaginatedResponse,
} from '@asistencia/shared'

const keys = {
  all: ['attendance'] as const,
  list: (q: ListAttendanceQuery) => [...keys.all, 'list', q] as const,
  roster: (sessionId: string) => [...keys.all, 'roster', sessionId] as const,
}

export interface RosterStudent {
  id: string
  fullName: string
  legajo?: string | null
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'JUSTIFIED'
  justificationText?: string | null
}

export interface RosterResponse {
  session: ClassSession
  students: RosterStudent[]
}

/**
 * Fetch the roster for a session. The endpoint includes the session
 * metadata and the current attendance state (if any) per student.
 */
export function useSessionRoster(sessionId: string | undefined) {
  return useQuery({
    queryKey: keys.roster(sessionId ?? ''),
    queryFn: async (): Promise<RosterResponse> => {
      const { data } = await apiClient.get<RosterResponse>(`/sessions/${sessionId}/roster`)
      return data
    },
    enabled: Boolean(sessionId),
    staleTime: 0,
  })
}

export function useMarkAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      sessionId: string
      payload: AttendanceMarkRequest
    }): Promise<AttendanceMarkResponse> => {
      const { data } = await apiClient.post<AttendanceMarkResponse>(
        `/sessions/${vars.sessionId}/attendance`,
        vars.payload,
      )
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.roster(vars.sessionId) })
      qc.invalidateQueries({ queryKey: keys.all })
    },
  })
}

export function useUpdateAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      sessionId: string
      payload: AttendanceMarkRequest
    }): Promise<AttendanceMarkResponse> => {
      const { data } = await apiClient.patch<AttendanceMarkResponse>(
        `/sessions/${vars.sessionId}/attendance`,
        vars.payload,
      )
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.roster(vars.sessionId) })
      qc.invalidateQueries({ queryKey: keys.all })
    },
  })
}

export function useOpenSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data } = await apiClient.post<ClassSession>(`/sessions/${sessionId}/open`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useCloseSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data } = await apiClient.post<ClassSession>(`/sessions/${sessionId}/close`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useListAttendance(query: ListAttendanceQuery) {
  return useQuery({
    queryKey: keys.list(query),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<AttendanceRecord>>('/attendance', {
        params: query,
      })
      return data
    },
    staleTime: 30_000,
  })
}

export function useUploadEvidence(_sessionId: string) {
  return useMutation({
    mutationFn: async (vars: { recordId: string; file: File }) => {
      const fd = new FormData()
      fd.append('file', vars.file)
      const { data } = await apiClient.post<{ url: string }>(
        `/attendance/${vars.recordId}/evidence`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      return data
    },
  })
}

/**
 * Page state container: holds the per-student local state while the
 * teacher works through the roster. The component is responsible for
 * translating it into the final attendance payload on submit.
 */
export interface RosterEntry {
  studentId: string
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'JUSTIFIED'
  justificationText?: string
  evidenceFile?: File
}

type Status = RosterEntry['status']

export function useRosterState(initial: RosterStudent[]) {
  const [entries, setEntries] = useState<Map<string, RosterEntry>>(() => {
    const m = new Map<string, RosterEntry>()
    initial.forEach((s) => {
      m.set(s.id, {
        studentId: s.id,
        status: s.status ?? 'PRESENT',
        justificationText: s.justificationText ?? undefined,
      })
    })
    return m
  })

  function setStatus(studentId: string, status: Status) {
    setEntries((prev) => {
      const next = new Map(prev)
      const cur = next.get(studentId)
      next.set(studentId, {
        ...cur,
        studentId,
        status,
        // Clear justification when switching away from LATE/JUSTIFIED
        justificationText:
          status === 'LATE' || status === 'JUSTIFIED' ? cur?.justificationText : undefined,
      })
      return next
    })
  }

  function setJustification(studentId: string, text: string) {
    setEntries((prev) => {
      const next = new Map(prev)
      const cur = next.get(studentId)
      if (!cur) return prev
      next.set(studentId, { ...cur, justificationText: text })
      return next
    })
  }

  function setEvidence(studentId: string, file: File | undefined) {
    setEntries((prev) => {
      const next = new Map(prev)
      const cur = next.get(studentId)
      if (!cur) return prev
      next.set(studentId, { ...cur, evidenceFile: file })
      return next
    })
  }

  function setAll(status: Status) {
    setEntries((prev) => {
      const next = new Map(prev)
      for (const [id, e] of prev) {
        next.set(id, {
          ...e,
          studentId: id,
          status,
          justificationText:
            status === 'LATE' || status === 'JUSTIFIED' ? e.justificationText : undefined,
        })
      }
      return next
    })
  }

  function clear() {
    setEntries((prev) => {
      const next = new Map(prev)
      for (const [id] of prev) {
        next.set(id, { studentId: id, status: 'PRESENT' })
      }
      return next
    })
  }

  return {
    entries,
    setStatus,
    setJustification,
    setEvidence,
    setAll,
    clear,
  }
}
