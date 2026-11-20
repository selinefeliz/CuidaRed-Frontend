/*
 * panel-visitas.tsx — Panel operativo: solicitudes, agenda y actividad real de la organización.
 * Módulo: access-real · visitas. © 2026 Equipo CuidaRed – INTEC.
 */
import { useId } from 'react'
import { ArrowRight, Building2, CalendarPlus, Check, Inbox, RefreshCw, UserRound } from 'lucide-react'
import { Button } from '@/components/ui'
import { fechaCorta, hhmmA12 } from '@/domain/dates'
import { cn } from '@/lib/cn'
import { AgendaDelDia, AgendaVisitas } from './agenda-visitas'
import { aFechaAgenda, mesAgenda, periodoAgenda, useAgendaCompleta, useRevisionAgenda } from './agenda-visitas-datos'
import { Estado, useConexionReal, usePagina } from './controles'
import type { SolicitudExterna } from './solicitudes-externas'
import type { Visita } from './visitas'

function ActividadVisitas({ visitas, fecha }: { visitas: Visita[]; fecha: string }) {
  const id = useId()
  const periodo = periodoAgenda(fecha)
  const semanas = periodo.dias.filter((_, n) => n % 7 === 0).map((inicio) => {
    const fin = new Date(aFechaAgenda(inicio).getTime() + 6 * 86_400_000).toISOString().slice(0, 10)
    const deSemana = visitas.filter((visita) => visita.fecha >= inicio && visita.fecha <= fin)
    return { inicio, fin, programadas: deSemana.filter((v) => v.estado === 'programada' || v.estado === 'en_curso').length,
      realizadas: deSemana.filter((v) => v.estado === 'completada').length, canceladas: deSemana.filter((v) => v.estado === 'cancelada').length }
  })
  const maximo = Math.max(1, ...semanas.flatMap((semana) => [semana.programadas, semana.realizadas, semana.canceladas]))
  const ancho = 600 / semanas.length
  const tipos = [
    { clave: 'programadas', texto: 'Por realizar', color: 'var(--c-navy)' },
    { clave: 'realizadas', texto: 'Realizadas', color: 'var(--c-success)' },
    { clave: 'canceladas', texto: 'Canceladas', color: 'var(--c-danger)' },
  ] as const
  return <figure aria-labelledby={id} className="min-w-0 rounded-md border border-line-soft bg-surface p-4 sm:p-5">
    <figcaption><h3 id={id} className="text-base font-semibold text-ink">Visitas por semana</h3><p className="mt-1 text-sm text-ink-2">Actividad de {mesAgenda(fecha)}</p></figcaption>
    {visitas.length ? <>
      <div className="mt-4 flex items-center justify-between text-xs text-ink-2"><span>Número de visitas</span><span>Escala: 0–{maximo}</span></div>
      <svg viewBox="0 0 600 160" preserveAspectRatio="none" role="img" aria-label="Comparación semanal de visitas por realizar, realizadas y canceladas" className="mt-2 h-36 w-full">
        {[0, 0.5, 1].map((fraccion) => <line key={fraccion} x1="0" x2="600" y1={148 - fraccion * 130} y2={148 - fraccion * 130} stroke="var(--c-border-soft)" strokeDasharray={fraccion ? '4 5' : undefined} />)}
        {semanas.flatMap((semana, indice) => tipos.map((tipo, columna) => {
          const cantidad = semana[tipo.clave]
          return <rect key={`${semana.inicio}-${tipo.clave}`} x={indice * ancho + ancho * (0.2 + columna * 0.2)} y={148 - cantidad / maximo * 130}
            width={ancho * 0.15} height={cantidad / maximo * 130} rx="3" fill={tipo.color}><title>{`${fechaCorta(semana.inicio)}–${fechaCorta(semana.fin)}: ${cantidad} ${tipo.texto.toLowerCase()}`}</title></rect>
        }))}
      </svg>
      <div className="grid gap-1 text-center text-xs text-ink-2" style={{ gridTemplateColumns: `repeat(${semanas.length}, minmax(0, 1fr))` }}>
        {semanas.map((semana) => <span key={semana.inicio}>{aFechaAgenda(semana.inicio).getUTCDate()}–{aFechaAgenda(semana.fin).getUTCDate()}</span>)}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-2" aria-label="Leyenda de actividad">{tipos.map((tipo) => <li key={tipo.clave} className="flex items-center gap-2"><span aria-hidden className="size-2 rounded-sm" style={{ background: tipo.color }} />{tipo.texto}</li>)}</ul>
      <div className="sr-only"><table><caption>Visitas por semana de {mesAgenda(fecha)}</caption><thead><tr><th>Semana</th>{tipos.map((tipo) => <th key={tipo.clave}>{tipo.texto}</th>)}</tr></thead><tbody>{semanas.map((semana) => <tr key={semana.inicio}><th>{fechaCorta(semana.inicio)}–{fechaCorta(semana.fin)}</th>{tipos.map((tipo) => <td key={tipo.clave}>{semana[tipo.clave]}</td>)}</tr>)}</tbody></table></div>
    </> : <p className="mt-5 border-t border-line-soft pt-5 text-sm text-ink-2">Todavía no hay visitas registradas en este mes. La actividad aparecerá al programarlas.</p>}
  </figure>
}

export function PanelVisitas({ base, token, organizacion, fecha, cambiarFecha, revision, abrir, programar, solicitudes, revisar, historial, calendario, soloCalendario = false }: {
  base: string; token: string; organizacion: string; fecha: string; cambiarFecha: (fecha: string) => void; revision: number
  abrir: (id: string) => void; programar?: (fecha?: string) => void; solicitudes: () => void; revisar: (solicitud: SolicitudExterna) => void
  historial: () => void; calendario: () => void; soloCalendario?: boolean
}) {
  const enLinea = useConexionReal()
  const reloj = useRevisionAgenda(revision)
  const agenda = useAgendaCompleta(base, token, fecha, reloj.revision)
  const pendientes = usePagina<SolicitudExterna>(soloCalendario ? null : `${base}/solicitudes-visita`, token, reloj.revision, { limit: 3, filters: { estado: 'pendiente' }, sort: ['fecha_propuesta', 'fecha_creacion'] })
  const periodo = periodoAgenda(fecha)
  const visitas = agenda.visitas?.filter((visita) => visita.fecha >= periodo.primero && visita.fecha <= periodo.ultimo)
  const resumen = [
    { etiqueta: 'Solicitudes por revisar', valor: pendientes.datos?.meta.total, ayuda: 'Todas las fechas', atencion: true },
    { etiqueta: 'Visitas del mes', valor: visitas?.length, ayuda: mesAgenda(fecha) },
    { etiqueta: 'Por realizar', valor: visitas?.filter((v) => v.estado === 'programada' || v.estado === 'en_curso').length, ayuda: 'Programadas y en curso' },
    { etiqueta: 'Realizadas', valor: visitas?.filter((v) => v.estado === 'completada').length, ayuda: 'Dentro del mes seleccionado' },
  ]
  return <div className="grid min-w-0 gap-5 [&_button]:text-sm">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-2">{organizacion}</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-navy">{soloCalendario ? 'Agenda de visitas' : 'Visitas de la organización'}</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">{soloCalendario ? 'Consulta los horarios y abre una cita para ver su detalle.' : 'Revisa las solicitudes y coordina cada visita con tu equipo.'}</p></div>
      <div className="flex flex-wrap gap-2">
        {!soloCalendario && <Button size="sm" variant="outline" onClick={solicitudes} icon={<Inbox size={17} aria-hidden />}>Solicitudes externas</Button>}
        {programar && <Button size="sm" disabled={!enLinea} onClick={() => programar()} icon={<CalendarPlus size={18} aria-hidden />}>Programar visita</Button>}
      </div>
    </header>
    {!soloCalendario && <dl aria-label="Indicadores de visitas" className="grid grid-cols-2 overflow-hidden rounded-md border border-line-soft bg-surface lg:grid-cols-4">
      {resumen.map((item) => <div key={item.etiqueta} className={cn('min-w-0 border-b border-line-soft px-4 py-4 odd:border-r lg:border-r lg:border-b-0 lg:last:border-r-0', item.atencion && !!item.valor && 'bg-warning-100/60')}>
        <dt className="text-xs font-semibold text-ink-2">{item.etiqueta}</dt><dd><span className={cn('mt-2 block text-3xl font-bold tabular-nums tracking-tight', item.atencion && !!item.valor ? 'text-warning-700' : 'text-navy')}>{item.valor ?? '—'}</span><p className="mt-1 text-xs text-ink-2 first-letter:uppercase">{item.ayuda}</p></dd>
      </div>)}
    </dl>}
    {agenda.sinConexion && <p role="status" className="rounded-sm border border-line-soft bg-warning-100 px-4 py-3 text-sm text-ink">Sin conexión. {agenda.visitas ? 'Consulta la última agenda cargada; para programar o autorizar necesitas Internet.' : 'La agenda se cargará cuando vuelva Internet.'}</p>}
    {agenda.error && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-danger bg-danger-100 px-4 py-2 text-sm text-ink"><p>No se pudo actualizar la agenda. {agenda.visitas && 'Se conservan los datos de la última consulta.'}</p><Button size="sm" variant="outline" onClick={reloj.actualizar}>Reintentar agenda</Button></div>}
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
      <p aria-live="polite">{agenda.cargando && enLinea ? 'Actualizando agenda…' : agenda.actualizada ? `Última consulta: ${new Intl.DateTimeFormat('es-DO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Santo_Domingo' }).format(agenda.actualizada)}` : 'Consultando visitas…'} · Hora de República Dominicana</p>
      <button type="button" disabled={!enLinea || agenda.cargando} onClick={reloj.actualizar} className="flex min-h-12 items-center gap-2 rounded-sm px-3 font-semibold text-navy hover:bg-blue-100 disabled:opacity-50"><RefreshCw size={15} aria-hidden />Actualizar visitas</button>
    </div>
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="order-2 grid min-w-0 gap-5 lg:order-1">
        <AgendaVisitas visitas={agenda.visitas ?? []} fecha={fecha} cambiarFecha={cambiarFecha} abrir={abrir} ampliar={soloCalendario ? undefined : calendario} />
        <div className="rounded-md border border-line-soft bg-surface p-4 lg:hidden">{agenda.visitas !== undefined ? <AgendaDelDia visitas={agenda.visitas} fecha={fecha} abrir={abrir} programar={enLinea ? programar : undefined} /> : <p role="status" className="text-sm text-ink-2">{agenda.sinConexion ? 'Conéctate para consultar las citas.' : 'Cargando citas…'}</p>}</div>
        {!soloCalendario && visitas && <ActividadVisitas visitas={visitas} fecha={fecha} />}
      </div>
      <aside className="order-1 grid min-w-0 gap-5 lg:order-2">
        {!soloCalendario && <section aria-labelledby="pendientes-visitas" className={cn('overflow-hidden rounded-md border bg-surface', pendientes.datos?.meta.total ? 'border-warning-700' : 'border-line-soft')}>
          <header className={cn('border-b px-4 py-4', pendientes.datos?.meta.total ? 'border-warning-700/30 bg-warning-100' : 'border-line-soft')}><div className="flex items-center justify-between gap-2"><h3 id="pendientes-visitas" className="text-base font-semibold text-ink">Solicitudes pendientes</h3><Inbox size={18} className={pendientes.datos?.meta.total ? 'text-warning-700' : 'text-navy'} aria-hidden /></div><p className="mt-1 text-xs text-ink-2">{pendientes.datos ? `${pendientes.datos.meta.total} por revisar antes de confirmar una cita` : 'Solicitudes recibidas desde la portada'}</p></header>
          <div className="px-4"><Estado consulta={pendientes} />
            {pendientes.datos?.meta.total === 0 && <div className="py-5"><p className="flex items-center gap-2 text-sm font-semibold text-success-700"><Check size={17} aria-hidden />No hay solicitudes pendientes</p><p className="mt-2 text-xs leading-relaxed text-ink-2">Las nuevas solicitudes aparecerán aquí para que puedas revisarlas.</p></div>}
            <ul className="divide-y divide-line-soft">{pendientes.datos?.data.map((item, indice) => <li key={item.solicitud_visita_id} className={cn('grid min-w-0 gap-2 py-4', indice > 0 && 'hidden md:grid')}>
              <p className="flex items-start gap-2 text-sm font-semibold text-ink">{item.tipo_visita === 'institucional' ? <Building2 size={16} className="mt-0.5 shrink-0 text-navy" aria-hidden /> : <UserRound size={16} className="mt-0.5 shrink-0 text-navy" aria-hidden />}<span className="wrap-anywhere">{item.entidad_visitante || `${item.visitante.nombres} ${item.visitante.apellidos}`}</span></p>
              <p className="text-xs leading-relaxed text-ink-2">{item.tipo_visita === 'institucional' ? `${item.cantidad_visitantes ?? 1} visitantes · Actividad de grupo` : `Para visitar a ${item.persona_a_visitar}`}</p>
              <p className="text-xs font-medium text-ink">Propuesta: {fechaCorta(item.fecha_propuesta)} · {hhmmA12(item.hora_propuesta)}</p>
              <button type="button" onClick={() => revisar(item)} className="flex min-h-12 items-center justify-between gap-2 text-left font-semibold text-navy hover:underline hover:underline-offset-4">Revisar solicitud <ArrowRight size={16} aria-hidden /></button>
            </li>)}</ul>
          </div>
          {!!pendientes.datos?.meta.total && <button type="button" onClick={solicitudes} className="flex min-h-12 w-full items-center justify-center border-t border-line-soft bg-bg px-3 font-semibold text-navy hover:bg-blue-100">Ver todas las solicitudes</button>}
        </section>}
        <div className="hidden rounded-md border border-line-soft bg-surface p-4 lg:block">{agenda.visitas !== undefined ? <AgendaDelDia visitas={agenda.visitas} fecha={fecha} abrir={abrir} programar={enLinea ? programar : undefined} /> : <p role="status" className="text-sm text-ink-2">{agenda.sinConexion ? 'Conéctate para consultar las citas.' : 'Cargando citas…'}</p>}</div>
        {!soloCalendario && <button type="button" onClick={historial} className="flex min-h-12 items-center justify-between gap-3 rounded-sm border border-line-soft bg-surface px-4 py-3 text-left font-semibold text-navy hover:bg-blue-100">Consultar historial <ArrowRight size={17} aria-hidden /></button>}
      </aside>
    </div>
  </div>
}
