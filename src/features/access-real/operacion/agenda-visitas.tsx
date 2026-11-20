/*
 * agenda-visitas.tsx — Calendario mensual/semanal y agenda diaria adaptable a la PWA.
 * Módulo: access-real · visitas. © 2026 Equipo CuidaRed – INTEC.
 */
import { useState } from 'react'
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import { Button, TextField } from '@/components/ui'
import { hhmmA12 } from '@/domain/dates'
import { cn } from '@/lib/cn'
import { aFechaAgenda, diaAgenda, diasSemanaAgenda, estadoCita, mesAgenda, moverMesAgenda, periodoAgenda, responsableCita, sumarDiaAgenda, tituloCita } from './agenda-visitas-datos'
import { fechaDominicana } from './visitas-fechas'
import type { Visita } from './visitas'

const horarioCita = (visita: Pick<Visita, 'hora_programada' | 'hora_fin_programada'>) => visita.hora_programada
  ? `${hhmmA12(visita.hora_programada)}${visita.hora_fin_programada ? ` – ${hhmmA12(visita.hora_fin_programada)}` : ''}` : 'Sin horario definido'

export function AgendaDelDia({ visitas, fecha, abrir, programar }: { visitas: Visita[]; fecha: string; abrir: (id: string) => void; programar?: (fecha: string) => void }) {
  const citas = visitas.filter((visita) => visita.fecha === fecha).sort((a, b) => (a.hora_programada ?? '99').localeCompare(b.hora_programada ?? '99'))
  return <section aria-label="Agenda del día" className="grid min-w-0 gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="text-base font-semibold text-ink">Agenda del día</h3><p className="mt-1 text-sm text-ink-2 first-letter:uppercase">{diaAgenda(fecha)}</p></div>
      <span className="text-sm tabular-nums text-ink-2">{citas.length} {citas.length === 1 ? 'visita' : 'visitas'}</span>
    </div>
    {citas.length ? <ul className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1">
      {citas.map((visita) => {
        const estado = estadoCita(visita)
        return <li key={visita.visita_id} className="min-w-0"><button type="button" onClick={() => abrir(visita.visita_id)}
          className={cn('group grid min-h-12 w-full min-w-0 gap-1 rounded-sm border border-l-4 p-3 text-left transition hover:brightness-95', estado.clase)}>
          <span className="flex items-start justify-between gap-2"><span className="text-xs font-semibold tabular-nums">{horarioCita(visita)}</span><ArrowUpRight size={16} className="shrink-0" aria-hidden /></span>
          <strong className="text-sm leading-snug wrap-anywhere">{tituloCita(visita)}</strong>
          <span className="text-xs">{estado.texto}{visita.tipo_visita === 'institucional' ? ' · Visita de grupo' : ' · Visita personal'}</span>
          {responsableCita(visita) && <span className="text-xs wrap-anywhere">{responsableCita(visita)}</span>}
        </button></li>
      })}
    </ul> : <div className="rounded-sm border border-dashed border-line-soft bg-bg p-4"><p className="text-sm font-medium text-ink">Sin visitas en esta fecha</p><p className="mt-1 text-sm text-ink-2">Selecciona otro día o programa una visita.</p></div>}
    {programar && fecha >= fechaDominicana() && <Button size="sm" variant="outline" className="w-full text-sm" onClick={() => programar(fecha)}>Programar para este día</Button>}
  </section>
}

export function AgendaVisitas({ visitas, fecha, cambiarFecha, abrir, ampliar }: {
  visitas: Visita[]; fecha: string; cambiarFecha: (fecha: string) => void; abrir: (id: string) => void; ampliar?: () => void
}) {
  const [vista, setVista] = useState<'mes' | 'semana'>('semana')
  const hoy = fechaDominicana()
  const dias = vista === 'mes' ? periodoAgenda(fecha).dias : diasSemanaAgenda(fecha)
  const cambiarPeriodo = (n: number) => cambiarFecha(vista === 'mes' ? moverMesAgenda(fecha, n) : sumarDiaAgenda(fecha, n * 7))
  const porFecha = new Map<string, Visita[]>()
  for (const visita of visitas) porFecha.set(visita.fecha, [...(porFecha.get(visita.fecha) ?? []), visita])
  return <section aria-label="Calendario de visitas" className="min-w-0 overflow-hidden rounded-md border border-line-soft bg-surface">
    <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line-soft px-4 py-3">
      <div className="flex items-center gap-2"><CalendarDays size={19} className="text-navy" aria-hidden /><h3 className="text-base font-semibold text-ink">Calendario de visitas</h3></div>
      {ampliar && <button type="button" onClick={ampliar} className="flex min-h-12 items-center gap-1 text-sm font-semibold text-navy">Ampliar calendario <ArrowUpRight size={16} aria-hidden /></button>}
    </header>
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
      <div className="flex min-w-0 items-center gap-1">
        <button type="button" aria-label={vista === 'mes' ? 'Mes anterior' : 'Semana anterior'} onClick={() => cambiarPeriodo(-1)} className="grid size-12 shrink-0 place-items-center rounded-sm text-navy hover:bg-blue-100"><ChevronLeft size={20} aria-hidden /></button>
        <p aria-live="polite" className="min-w-0 text-center text-sm font-semibold text-ink first-letter:uppercase">{mesAgenda(fecha)}</p>
        <button type="button" aria-label={vista === 'mes' ? 'Mes siguiente' : 'Semana siguiente'} onClick={() => cambiarPeriodo(1)} className="grid size-12 shrink-0 place-items-center rounded-sm text-navy hover:bg-blue-100"><ChevronRight size={20} aria-hidden /></button>
      </div>
      <button type="button" onClick={() => cambiarFecha(hoy)} className="min-h-12 rounded-sm px-3 text-sm font-semibold text-navy hover:bg-blue-100">Hoy</button>
      <div className="hidden rounded-sm border border-line-soft p-0.5 md:flex" role="group" aria-label="Vista del calendario">
        {(['mes', 'semana'] as const).map((modo) => <button key={modo} type="button" aria-pressed={vista === modo} onClick={() => setVista(modo)} className={cn('min-h-12 min-w-12 rounded-sm px-3 text-sm font-semibold', vista === modo ? 'bg-navy text-white' : 'text-navy hover:bg-bg')}>{modo === 'mes' ? 'Mes' : 'Semana'}</button>)}
      </div>
    </div>
    <div className="grid gap-4 px-4 pb-4 md:hidden">
      <TextField label="Fecha del calendario" type="date" value={fecha} onChange={(event) => event.target.value && cambiarFecha(event.target.value)} />
      <p className="flex items-center gap-2 text-sm text-ink-2"><Clock3 size={16} aria-hidden /> Elige una fecha para consultar su agenda.</p>
    </div>
    <div className="hidden md:block">
      <div className="grid grid-cols-7 border-y border-line-soft bg-bg text-center text-xs font-semibold text-ink-2" aria-hidden>{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dia) => <span key={dia} className="py-2">{dia}</span>)}</div>
      <div role="group" aria-label={`Calendario de ${mesAgenda(fecha)}`} className="grid grid-cols-7 gap-px bg-line-soft">
        {dias.map((dia) => {
          const citas = porFecha.get(dia) ?? []
          const visibles = citas.slice(0, vista === 'semana' ? 3 : 1)
          const seleccionado = dia === fecha
          return <div key={dia} className={cn('relative min-h-24 min-w-0 px-1.5 pb-2 pt-9', vista === 'semana' && 'min-h-[230px]', dia.slice(0, 7) === fecha.slice(0, 7) ? 'bg-surface' : 'bg-bg')}>
            <button type="button" aria-label={`${diaAgenda(dia)}, ${citas.length} ${citas.length === 1 ? 'visita' : 'visitas'}`} aria-pressed={seleccionado} aria-current={dia === hoy ? 'date' : undefined}
              onClick={() => cambiarFecha(dia)} className={cn('absolute inset-0 min-h-12 min-w-12 text-ink transition hover:bg-blue-100/30', seleccionado && 'ring-2 ring-inset ring-navy')}>
              <span className={cn('absolute top-1 left-1.5 grid h-7 min-w-7 place-items-center rounded-sm text-xs font-semibold', dia === hoy ? 'bg-navy text-white' : dia.slice(0, 7) !== fecha.slice(0, 7) ? 'text-muted' : 'text-ink')}>{aFechaAgenda(dia).getUTCDate()}</span>
              {citas.length > visibles.length && <span className="absolute right-2 bottom-1 text-[11px] font-medium text-navy">+{citas.length - visibles.length} más</span>}
            </button>
            <div className="pointer-events-none relative grid min-w-0 gap-1">
              {visibles.map((visita) => <button key={visita.visita_id} type="button" title={`${tituloCita(visita)} · ${horarioCita(visita)} · ${estadoCita(visita).texto}`}
                aria-label={`Abrir visita: ${tituloCita(visita)}, ${horarioCita(visita)}, ${estadoCita(visita).texto}`} onClick={() => abrir(visita.visita_id)}
                className={cn('pointer-events-auto grid min-h-12 min-w-0 content-center gap-0.5 rounded-sm border-l-[3px] px-1.5 py-1 text-left hover:brightness-95', estadoCita(visita).clase)}>
                <span className="truncate text-[11px] font-semibold tabular-nums">{visita.hora_programada ? hhmmA12(visita.hora_programada) : 'Sin hora'}</span>
                <span className="truncate text-xs font-medium">{tituloCita(visita)}</span>
              </button>)}
            </div>
          </div>
        })}
      </div>
    </div>
    <ul aria-label="Estados del calendario" className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line-soft px-4 py-3 text-xs text-ink-2">
      {([{ estado: 'programada', pendiente_autorizacion: true }, { estado: 'programada' }, { estado: 'en_curso' }, { estado: 'completada' }, { estado: 'cancelada' }] as const).map((item) => {
        const estado = estadoCita(item)
        return <li key={estado.texto} className="flex items-center gap-1.5"><span className={cn('h-2.5 w-1 shrink-0 rounded-sm', estado.punto)} aria-hidden />{estado.texto}</li>
      })}
    </ul>
  </section>
}
