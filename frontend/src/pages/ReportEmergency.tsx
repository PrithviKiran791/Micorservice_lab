import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Clock3 } from 'lucide-react'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { IncidentTypeLabel, SeverityBadge, StatusBadge } from '../components/common/Badge'
import { PageHeader } from '../components/common/PageHeader'
import { IncidentForm } from '../components/incidents/IncidentForm'
import type { Incident } from '../types/api'

export default function ReportEmergency() {
  const [created, setCreated] = useState<Incident | null>(null)

  if (created) {
    const assigned = created.status === 'ASSIGNED'
    return (
      <>
        <PageHeader title="Report emergency" />
        <Card className="mx-auto max-w-2xl">
          <div className="flex flex-col items-center text-center">
            <span className={`rounded-full p-3 ${assigned ? 'bg-ok/15 text-ok' : 'bg-amber/15 text-amber'}`}>
              {assigned ? <CheckCircle2 className="h-8 w-8" aria-hidden="true" /> : <Clock3 className="h-8 w-8" aria-hidden="true" />}
            </span>
            <h2 className="mt-4 text-xl font-semibold text-ink">Your report has been received</h2>
            <p className="mt-1 text-sm text-mute">Incident #{created.id} is saved.</p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <StatusBadge status={created.status} />
              <SeverityBadge severity={created.severity} />
              <IncidentTypeLabel type={created.type} />
            </div>

            <p className="mt-5 max-w-md text-sm text-ink">
              {assigned
                ? `${created.assignedResponder?.name} has been assigned to your incident.`
                : 'No responder could be assigned right now (none is free, or the responder service is unreachable). Your report is safely in the queue and a dispatcher will assign help as soon as it is available.'}
            </p>

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link to={`/app/incidents?open=${created.id}`} className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-600">
                Track this incident
              </Link>
              <Button variant="secondary" onClick={() => setCreated(null)}>
                Report another
              </Button>
            </div>
          </div>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Report emergency" subtitle="Tell us what is happening. The system saves your report immediately and looks for a responder." />
      <Card className="mx-auto max-w-2xl">
        <IncidentForm onCreated={setCreated} />
      </Card>
      <p className="mx-auto mt-4 max-w-2xl text-xs text-faint">This is a simulation for a college project. In a real emergency, call your local emergency number.</p>
    </>
  )
}
