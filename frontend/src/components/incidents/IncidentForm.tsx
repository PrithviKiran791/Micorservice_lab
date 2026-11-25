import { useState, type FormEvent } from 'react'
import { Loader2, Send } from 'lucide-react'
import { INCIDENT_TYPES, SEVERITIES, type Incident, type IncidentType, type Severity } from '../../types/api'
import { incidentService } from '../../services/incidentService'
import { toAppError } from '../../services/errors'
import { INCIDENT_TYPE_LABEL, SEVERITY_LABEL } from '../../utils/format'
import { toCreateRequest, validateIncident, type IncidentFormErrors, type IncidentFormValues } from '../../utils/validation'
import { INCIDENT_TYPE_ICON } from '../common/Badge'
import { TextArea, TextInput } from '../common/FormField'
import { HoverBorderGradient } from '../ui/hover-border-gradient'
import { LocationPicker } from '../map/LocationPicker'

const SEVERITY_STYLE: Record<Severity, string> = {
  LOW: 'peer-checked:border-sky peer-checked:bg-sky/15 peer-checked:text-sky',
  MEDIUM: 'peer-checked:border-amber peer-checked:bg-amber/15 peer-checked:text-amber',
  CRITICAL: 'peer-checked:border-critical peer-checked:bg-critical/15 peer-checked:text-critical',
}

const SEVERITY_HINT: Record<Severity, string> = {
  LOW: 'No immediate danger',
  MEDIUM: 'Needs help soon',
  CRITICAL: 'Life-threatening',
}

/** The structured emergency report. Validates before sending; the backend validates again and its errors are shown too. */
export function IncidentForm({ onCreated }: { onCreated: (incident: Incident) => void }) {
  const [values, setValues] = useState<IncidentFormValues>({ type: '', severity: '', description: '', locationText: '', position: null })
  const [errors, setErrors] = useState<IncidentFormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const set = <K extends keyof IncidentFormValues>(key: K, value: IncidentFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setServerError(null)
    const found = validateIncident(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSubmitting(true)
    try {
      onCreated(await incidentService.create(toCreateRequest(values)))
    } catch (err) {
      const appError = toAppError(err)
      if (appError.code === 'VALIDATION_ERROR' && appError.details.length > 0) {
        const fieldErrors: IncidentFormErrors = {}
        for (const d of appError.details) {
          if (d.field === 'latitude' || d.field === 'longitude') fieldErrors.position = d.message
          else if (d.field in values) fieldErrors[d.field as keyof IncidentFormValues] = d.message
        }
        setErrors(fieldErrors)
      }
      setServerError(appError.message)
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Type of emergency</legend>
        <div className="grid grid-cols-3 gap-3">
          {INCIDENT_TYPES.map((t: IncidentType) => {
            const Icon = INCIDENT_TYPE_ICON[t]
            return (
              <label key={t} className="cursor-pointer">
                <input type="radio" name="type" value={t} checked={values.type === t} onChange={() => set('type', t)} className="peer sr-only" />
                <span className="flex flex-col items-center gap-2 rounded-lg border border-line bg-night px-3 py-4 text-sm font-medium text-mute transition-colors hover:border-faint peer-checked:border-brand peer-checked:bg-brand/15 peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                  {INCIDENT_TYPE_LABEL[t]}
                </span>
              </label>
            )
          })}
        </div>
        {errors.type && <p className="mt-1.5 text-xs text-critical" role="alert">{errors.type}</p>}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Severity</legend>
        <div className="grid grid-cols-3 gap-3">
          {SEVERITIES.map((s: Severity) => (
            <label key={s} className="cursor-pointer">
              <input type="radio" name="severity" value={s} checked={values.severity === s} onChange={() => set('severity', s)} className="peer sr-only" />
              <span className={`flex flex-col items-center rounded-lg border border-line bg-night px-3 py-3 text-sm font-semibold text-mute transition-colors hover:border-faint peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand ${SEVERITY_STYLE[s]}`}>
                {SEVERITY_LABEL[s]}
                <span className="mt-0.5 text-xs font-normal opacity-80">{SEVERITY_HINT[s]}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.severity && <p className="mt-1.5 text-xs text-critical" role="alert">{errors.severity}</p>}
      </fieldset>

      <TextArea
        id="description"
        label="What is happening?"
        value={values.description}
        onChange={(e) => set('description', e.target.value)}
        error={errors.description}
        maxLength={500}
        placeholder="Person collapsed near the library entrance and is not responding."
        hint={`${values.description.length}/500`}
      />

      <TextInput
        id="location"
        label="Location"
        value={values.locationText}
        onChange={(e) => set('locationText', e.target.value)}
        error={errors.locationText}
        maxLength={200}
        placeholder="Main Library, Gate 2"
        hint="Describe where help is needed (building, floor, landmark)."
      />

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-ink">Position on the map <span className="font-normal text-mute">(optional)</span></legend>
        <p className="mb-3 text-xs text-mute">Pinning the exact spot helps the dispatcher see where help is needed. You can skip this and send the report with the description only.</p>
        <LocationPicker
          value={values.position ?? null}
          onChange={(position) => set('position', position)}
          onPlaceName={(name) => setValues((v) => (v.locationText.trim() === '' ? { ...v, locationText: name.slice(0, 200) } : v))}
        />
        {errors.position && <p className="mt-1.5 text-xs text-critical" role="alert">{errors.position}</p>}
      </fieldset>

      {serverError && (
        <p className="rounded-md border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical" role="alert">
          {serverError}
        </p>
      )}

      <HoverBorderGradient
        as="button"
        type="submit"
        disabled={submitting}
        highlightColor="#ef4444"
        containerClassName="w-full rounded-full sm:w-auto"
        className="h-10 w-full px-5 text-sm font-semibold sm:w-auto"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
        <span>{submitting ? 'Sending report...' : 'Report emergency'}</span>
      </HoverBorderGradient>
    </form>
  )
}
