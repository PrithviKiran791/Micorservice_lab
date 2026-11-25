import { lazy, Suspense } from 'react'
import { BarChart3, Info } from 'lucide-react'
import { Card } from '../components/common/Card'
import { LiveStatus, PageHeader } from '../components/common/PageHeader'
import { EmptyState, ErrorState, InlineNotice, LoadingState } from '../components/common/States'
import { useAuth } from '../contexts/AuthContext'
import { useResource } from '../hooks/useResource'
import { incidentService } from '../services/incidentService'
import { responderService } from '../services/responderService'
import type { Incident, Responder } from '../types/api'

// Recharts is the biggest library of the app, so the charts are loaded only when this page is opened.
const Charts = {
  Type: lazy(() => import('../components/analytics/Charts').then((m) => ({ default: m.TypeChart }))),
  Severity: lazy(() => import('../components/analytics/Charts').then((m) => ({ default: m.SeverityChart }))),
  Status: lazy(() => import('../components/analytics/Charts').then((m) => ({ default: m.StatusChart }))),
  Responder: lazy(() => import('../components/analytics/Charts').then((m) => ({ default: m.ResponderChart }))),
  Activity: lazy(() => import('../components/analytics/Charts').then((m) => ({ default: m.ActivityChart }))),
}

/**
 * Operational charts. The backend offers no aggregate endpoint, so everything here is calculated in the browser from
 * the incident and responder lists the API returns. A reporter's charts cover only their own incidents.
 */
export default function Analytics() {
  const { isAdmin } = useAuth()
  const incidents = useResource<Incident[]>((signal) => incidentService.list(undefined, signal))
  const responders = useResource<Responder[]>((signal) => responderService.list(undefined, signal))
  const list = incidents.data ?? []

  return (
    <>
      <PageHeader title="Analytics" subtitle="Operational view calculated from the available records." actions={<LiveStatus resource={incidents} />} />

      <div className="mb-6">
        <InlineNotice tone="info" title="How these numbers are made">
          There is no analytics endpoint in the backend. The charts are calculated here from {incidents.data ? `${list.length} incident record${list.length === 1 ? '' : 's'}` : 'the incident records'}
          {isAdmin ? ' (all incidents in the system).' : ' (your own incidents only; dispatchers see everyone).'} Counts update on every refresh.
        </InlineNotice>
      </div>

      {incidents.loading ? (
        <Card><LoadingState label="Loading analytics..." /></Card>
      ) : incidents.error && !incidents.data ? (
        <Card><ErrorState error={incidents.error} onRetry={() => void incidents.reload()} title="Could not load incident data" /></Card>
      ) : list.length === 0 ? (
        <Card><EmptyState icon={BarChart3} title="Nothing to chart yet" message="Charts appear as soon as there are incident records." /></Card>
      ) : (
        <Suspense fallback={<Card><LoadingState label="Loading charts..." /></Card>}>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Incidents by type"><Charts.Type incidents={list} /></Card>
            <Card title="Incidents by severity"><Charts.Severity incidents={list} /></Card>
            <Card title="Status distribution"><Charts.Status incidents={list} /></Card>
            <Card title="Responder availability" subtitle="By responder type">
              {responders.data ? (
                <Charts.Responder responders={responders.data} />
              ) : responders.loading ? (
                <LoadingState label="Loading responders..." />
              ) : responders.error ? (
                <ErrorState error={responders.error} onRetry={() => void responders.reload()} title={responders.error.status === 503 ? 'Responder service unavailable' : 'Could not load responders'} />
              ) : null}
            </Card>
            <Card title="Incident activity over time" subtitle="When incidents were reported" className="lg:col-span-2">
              <Charts.Activity incidents={list} />
            </Card>
          </div>
        </Suspense>
      )}

      <p className="mt-6 flex items-start gap-2 text-xs text-faint">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Limits: no history of status changes is stored by the backend, so the activity chart counts incidents by their report time only; responder availability is the current state, not a trend.
      </p>
    </>
  )
}
