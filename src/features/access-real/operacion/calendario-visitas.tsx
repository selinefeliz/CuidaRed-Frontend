/* calendario-visitas.tsx — Agenda diaria y selector de ventana de visita. © 2026 Equipo CuidaRed – INTEC. */
import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { TextField } from '@/components/ui'
import { fechaCorta, hhmmA12 } from '@/domain/dates'
import { Estado, Paginador, usePagina } from './controles'
import { fechaDominicana } from './visitas-fechas'

type Cita = {
  visita_id: string
  hora_programada: string | null
  hora_fin_programada?: string | null
  estado: string
  pendiente_autorizacion?: boolean
  participantes: { nombres?: string; apellidos?: string }[]
}

export function CalendarioVisitas({ base, token, fecha, excluir, abrir }: {
  base: string; token: string; fecha: string; excluir?: string; abrir?: (id: string) => void
}) {
  const consulta = usePagina<Cita>(fecha ? `${base}/visitas` : null, token, 0, {
    filters: { desde: fecha, hasta: fecha }, sort: ['hora_programada'],
  })
  if (!fecha) return null
  const citas = consulta.datos?.data.filter((cita) => cita.visita_id !== excluir && ['programada', 'en_curso'].includes(cita.estado)) ?? []

  return <section aria-label="Calendario de disponibilidad" className="grid min-w-0 gap-3 text-sm">
    <h4 className="flex items-center gap-2 text-sm font-semibold text-navy"><CalendarDays size={17} aria-hidden /> Visitas del {fechaCorta(fecha)}</h4>
    <Estado consulta={consulta} />
    {consulta.datos && citas.length === 0 && <p className="text-sm text-ink-2">No hay citas activas en esta página del calendario.</p>}
    {citas.length > 0 && <ul className="grid min-w-0 gap-2 text-sm text-ink-2">
      {citas.map((cita) => {
        const horario = [cita.hora_programada, cita.hora_fin_programada].filter((hora): hora is string => !!hora).map(hhmmA12).join(' – ')
        const responsables = cita.participantes.map(({ nombres, apellidos }) => [nombres, apellidos].filter(Boolean).join(' ')).filter(Boolean).join(', ')
        return <li key={cita.visita_id} className={`grid min-w-0 gap-1 rounded-sm border-l-4 px-3 py-2 ${cita.pendiente_autorizacion ? 'border-warning-700 bg-warning-100' : 'border-blue bg-blue-100'}`}>
          <strong className="text-xs tabular-nums text-navy">{horario || 'Sin hora'}</strong>{responsables && <span className="text-xs wrap-anywhere">{responsables}</span>}
          <span className={cita.pendiente_autorizacion ? 'text-xs font-medium text-warning-700' : 'text-xs font-medium text-navy'}>{cita.pendiente_autorizacion ? 'Por autorizar' : cita.estado === 'en_curso' ? 'En curso' : 'Autorizada'}</span>
          {abrir && <button type="button" onClick={() => abrir(cita.visita_id)} className="ml-2 min-h-12 px-2 font-semibold text-navy underline underline-offset-4">Abrir visita</button>}
        </li>
      })}
    </ul>}
    {consulta.datos && <Paginador pagina={consulta.pagina} total={consulta.datos.meta.totalPages} cambiar={consulta.cambiar} />}
  </section>
}

export function VentanaVisita({ base, token, inicial, excluir }: {
  base: string; token: string; inicial?: { fecha: string; inicio?: string | null; fin?: string | null }; excluir?: string
}) {
  const hoy = fechaDominicana()
  const [fecha, setFecha] = useState(inicial?.fecha && inicial.fecha >= hoy ? inicial.fecha : hoy)
  return <div className="grid gap-3">
    <div className="grid gap-3 sm:grid-cols-3">
      <TextField label="Fecha de la visita" name="fecha" type="date" required min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
      <TextField label="Hora de inicio" name="hora" type="time" required defaultValue={inicial?.inicio ?? ''} />
      <TextField label="Hora de fin" name="hora_fin_programada" type="time" required defaultValue={inicial?.fin ?? ''} />
    </div>
    <CalendarioVisitas base={base} token={token} fecha={fecha} excluir={excluir} />
    <p className="text-sm text-ink-2">Horario de República Dominicana. Se comprueba la disponibilidad de las personas antes de guardar.</p>
  </div>
}
