/*
 * programar-visita.tsx — Programación en dos pasos, selección de equipo y revisión del horario.
 * Módulo: access-real · visitas. © 2026 Equipo CuidaRed – INTEC.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CalendarCheck2, Check, ChevronRight, Clock3, Search, Users, X } from 'lucide-react'
import { Button, CheckboxGroup, SelectField, TextareaField, TextField } from '@/components/ui'
import { fechaCorta, hhmmA12 } from '@/domain/dates'
import { fechasDeSerie, MAX_OCURRENCIAS, type Repeticion } from '@/domain/recurrencia'
import { DIAS_SEMANA } from '@/features/agenda/lib/fechas'
import { cn } from '@/lib/cn'
import { api, ApiError, type CuentaMe } from '../client'
import { mensajeDeError } from '../errores'
import { CalendarioVisitas } from './calendario-visitas'
import { Estado, Paginador, useConexionReal, usePagina } from './controles'
import { fechaDominicana } from './visitas-fechas'
import { avisoPerfilCuidador, responsablesVisita } from './visitas-responsables'
import type { AdultoNombre, Candidato, Visita } from './visitas'

type Opcion = { id: string; etiqueta: string; detalle?: string }
function SelectorEquipo({ titulo, opciones, seleccionadas, maximo, cambiar, pagina }: {
  titulo: string; opciones: Opcion[]; seleccionadas: Opcion[]; maximo: number; cambiar: (valor: Opcion[]) => void
  pagina?: { actual: number; total: number; cambiar: (n: number) => void }
}) {
  const [busqueda, setBusqueda] = useState('')
  const visibles = opciones.filter((opcion) => opcion.etiqueta.toLocaleLowerCase('es').includes(busqueda.toLocaleLowerCase('es')))
  return <fieldset className="grid min-w-0 content-start gap-3 rounded-md border border-line-soft bg-surface p-3">
    <legend className="px-1 text-sm font-semibold text-ink">{titulo}</legend>
    <p className="text-xs text-ink-2">{seleccionadas.length} de {maximo} seleccionados</p>
    {!!seleccionadas.length && <ul aria-label={`${titulo} seleccionados`} className="grid gap-1">{seleccionadas.map((opcion) => <li key={opcion.id} className="min-w-0"><button type="button" onClick={() => cambiar(seleccionadas.filter((item) => item.id !== opcion.id))} aria-label={`Quitar ${opcion.etiqueta}`} className="flex min-h-12 w-full min-w-0 items-center justify-between gap-2 rounded-sm bg-blue-100 px-3 py-2 text-left text-sm font-medium text-navy"><span className="wrap-anywhere">{opcion.etiqueta}</span><X size={16} className="shrink-0" aria-hidden /></button></li>)}</ul>}
    {opciones.length > 6 && <label className="relative block"><span className="sr-only">Filtrar {titulo.toLowerCase()} de esta página</span><Search size={16} className="absolute top-4 left-3 text-ink-2" aria-hidden /><input type="search" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Filtrar esta página" className="min-h-12 w-full min-w-0 rounded-sm border border-line-soft bg-bg pr-3 pl-9 text-base text-ink" /></label>}
    <div className="grid max-h-64 content-start gap-1 overflow-y-auto pr-1">
      {visibles.map((opcion) => {
        const marcado = seleccionadas.some((item) => item.id === opcion.id)
        return <label key={opcion.id} className={cn('flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border px-3 py-2 text-sm transition has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue', marcado ? 'border-navy bg-blue-100' : 'border-line-soft bg-bg hover:border-blue')}>
          <input type="checkbox" className="size-5 shrink-0 accent-navy" checked={marcado} disabled={!marcado && seleccionadas.length >= maximo} onChange={() => cambiar(marcado ? seleccionadas.filter((item) => item.id !== opcion.id) : [...seleccionadas, opcion])} />
          <span className="grid min-w-0 gap-0.5"><span className="font-medium wrap-anywhere">{opcion.etiqueta}</span>{opcion.detalle && <span className="text-xs text-ink-2">{opcion.detalle}</span>}</span>
        </label>
      })}
      {!!busqueda && !visibles.length && <p className="py-3 text-sm text-ink-2">No hay coincidencias en esta página.</p>}
    </div>
    {pagina && <Paginador pagina={pagina.actual} total={pagina.total} cambiar={pagina.cambiar} />}
  </fieldset>
}

export function ProgramarVisita({ base, token, cuenta, fechaInicial, listo, volver, solicitudes }: {
  base: string; token: string; cuenta: CuentaMe; fechaInicial?: string
  listo: (visita: Visita, cantidad?: number) => void; volver: () => void; solicitudes: () => void
}) {
  const hoy = fechaDominicana()
  const [paso, setPaso] = useState(1)
  const [datos, setDatos] = useState({ fecha: fechaInicial && fechaInicial >= hoy ? fechaInicial : hoy, hora: '', fin: '', razon: '', notas: '', hasta: '' })
  const [frecuencia, setFrecuencia] = useState<Repeticion>('ninguna')
  const [dias, setDias] = useState<string[]>([])
  const [seleccionAdultos, setAdultos] = useState<Opcion[]>([])
  const [seleccionPersonas, setPersonas] = useState<Opcion[]>([])
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mostrarAgenda, setMostrarAgenda] = useState(() => window.matchMedia('(min-width: 1100px)').matches)
  const ocupado = useRef(false)
  const titulo = useRef<HTMLHeadingElement>(null)
  const enLinea = useConexionReal()
  const recurrentes = cuenta.funcionalidades?.includes('visitas_recurrentes')
  const adultos = usePagina<AdultoNombre>(`${base}/envejecientes`, token, 0, { filters: { estado: 'activo' } })
  const personas = usePagina<Candidato>(`${base}/candidatos/visita`, token)
  const { disponibles, faltanPerfiles } = responsablesVisita(personas.datos?.data)
  useEffect(() => { titulo.current?.focus() }, [paso])
  const cambiar = (campo: keyof typeof datos, valor: string) => { setDatos((actual) => ({ ...actual, [campo]: valor })); setError('') }
  const duracion = datos.hora && datos.fin && datos.fin > datos.hora ? (() => {
    const minutos = (valor: string) => Number(valor.slice(0, 2)) * 60 + Number(valor.slice(3, 5))
    const total = minutos(datos.fin) - minutos(datos.hora)
    return `${Math.floor(total / 60) ? `${Math.floor(total / 60)} h ` : ''}${total % 60 ? `${total % 60} min` : ''}`.trim()
  })() : null
  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    if (ocupado.current || !enLinea) return
    if (datos.fin <= datos.hora) { setError('La hora de fin debe ser posterior a la de inicio, en el mismo día.'); return }
    if (datos.razon.trim().length < 3) { setError('Describe el motivo con al menos 3 caracteres.'); return }
    const diasSemana = dias.map(Number)
    const fechas = fechasDeSerie({ fechaProgramada: datos.fecha, fechaFin: datos.hasta, repeticion: frecuencia, diasSemana })
    if (!fechas.length || fechas.length > MAX_OCURRENCIAS) { setError(`Elige un intervalo de 1 a ${MAX_OCURRENCIAS} visitas y revisa los días de repetición.`); return }
    if (paso === 1) { setError(''); setPaso(2); return }
    if (!seleccionAdultos.length || !seleccionPersonas.length) return
    ocupado.current = true; setGuardando(true); setError('')
    try {
      const entrada = { fecha: datos.fecha, hora_programada: datos.hora, hora_fin_programada: datos.fin, razon: datos.razon.trim(), notas: datos.notas.trim() || undefined,
        envejeciente_ids: seleccionAdultos.map((adulto) => adulto.id), participante_ids: seleccionPersonas.map((persona) => persona.id) }
      if (frecuencia === 'ninguna') listo(await api<Visita>(`${base}/visitas`, token, 'POST', { ...entrada, autorizar: false }))
      else {
        const serie = await api<{ visitas: Visita[] }>(`${base}/visitas/recurrentes`, token, 'POST', { ...entrada, repeticion: { frecuencia, hasta: datos.hasta, ...(frecuencia === 'semanal' ? { dias_semana: diasSemana.map((dia) => dia || 7) } : {}) } })
        if (!serie.visitas[0]) throw new Error('No se recibió la serie programada.')
        listo(serie.visitas[0], serie.visitas.length)
      }
    } catch (issue) { setError(issue instanceof ApiError ? mensajeDeError(issue) : issue instanceof Error ? issue.message : 'No se pudo programar la visita.') }
    finally { ocupado.current = false; setGuardando(false) }
  }
  return <section aria-labelledby="titulo-programacion" className="grid min-w-0 gap-4 [&_label]:text-sm [&_button]:text-sm">
    <header><p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-2">Nueva cita · {cuenta.nombre}</p><h2 ref={titulo} tabIndex={-1} id="titulo-programacion" className="mt-1 text-2xl font-bold text-navy focus:outline-none">Programar visita</h2><p className="mt-2 text-sm text-ink-2">Define el horario, elige las personas y revisa quién será responsable.</p></header>
    {!enLinea && <p role="status" className="rounded-sm bg-warning-100 px-4 py-3 text-sm text-ink">Para programar necesitas conexión. Los datos que ya escribiste se conservan mientras mantengas este formulario abierto.</p>}
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <form onSubmit={enviar} aria-label="Programar visita" aria-busy={guardando} className="min-w-0 rounded-md border border-line-soft bg-surface">
        <ol aria-label="Pasos de programación" className="grid grid-cols-2 border-b border-line-soft px-4 sm:px-5">
          {['Horario y motivo', 'Personas y confirmación'].map((etiqueta, n) => <li key={etiqueta} aria-current={paso === n + 1 ? 'step' : undefined} className={cn('flex min-h-16 items-center gap-2 border-b-2 py-3 text-xs font-semibold sm:text-sm', paso === n + 1 ? 'border-navy text-navy' : 'border-transparent text-ink-2')}><span className={cn('grid size-6 shrink-0 place-items-center rounded-sm', paso > n + 1 ? 'bg-success-100 text-success-700' : paso === n + 1 ? 'bg-navy text-white' : 'bg-bg')}>{paso > n + 1 ? <Check size={15} aria-hidden /> : n + 1}</span>{etiqueta}</li>)}
        </ol>
        <fieldset disabled={guardando} className="grid min-w-0 gap-5 p-4 sm:p-5">
          {paso === 1 ? <>
            <section aria-labelledby="horario-programacion" className="grid gap-4">
              <h3 id="horario-programacion" className="flex items-center gap-2 text-base font-semibold text-ink"><Clock3 size={18} className="text-navy" aria-hidden />Horario de la visita</h3>
              <div className="grid grid-cols-2 gap-3"><div className="col-span-2"><TextField label="Fecha de la visita" type="date" required min={hoy} value={datos.fecha} onChange={(event) => cambiar('fecha', event.target.value)} /></div><TextField label="Hora de inicio" type="time" required value={datos.hora} onChange={(event) => cambiar('hora', event.target.value)} /><TextField label="Hora de fin" type="time" required value={datos.fin} onChange={(event) => cambiar('fin', event.target.value)} /></div>
              <p className="text-xs text-ink-2">Hora de República Dominicana{duracion ? ` · Duración: ${duracion}` : '. Define la hora de inicio y de fin.'}</p>
            </section>
            <TextField label="Motivo de la visita" required minLength={3} maxLength={120} value={datos.razon} placeholder="Ej.: acompañamiento y seguimiento" onChange={(event) => cambiar('razon', event.target.value)} />
            <details className="rounded-sm border border-line-soft px-3"><summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold text-navy">Agregar notas para el equipo (opcional)</summary><div className="pb-3"><TextareaField label="Notas para el equipo" maxLength={300} rows={3} value={datos.notas} onChange={(event) => cambiar('notas', event.target.value)} hint="Solo información necesaria para coordinar la visita." /></div></details>
            {recurrentes && <section className="grid gap-3 border-t border-line-soft pt-4"><SelectField label="Repetición" value={frecuencia} onChange={(event) => { setFrecuencia(event.target.value as Repeticion); setError('') }} options={[{ value: 'ninguna', label: 'No se repite' }, { value: 'diaria', label: 'Diaria' }, { value: 'semanal', label: 'Semanal' }]} />
              {frecuencia !== 'ninguna' && <TextField label="Se repite hasta" type="date" required min={datos.fecha} value={datos.hasta} onChange={(event) => cambiar('hasta', event.target.value)} hint={`Máximo ${MAX_OCURRENCIAS} visitas.`} />}
              {frecuencia === 'semanal' && <CheckboxGroup label="Días de la semana" options={DIAS_SEMANA.map((dia) => ({ value: String(dia.value), label: dia.largo }))} value={dias} onChange={setDias} />}
            </section>}
          </> : <>
            <div><h3 className="flex items-center gap-2 text-base font-semibold text-ink"><Users size={18} className="text-navy" aria-hidden />Personas y equipo responsable</h3><p className="mt-2 text-sm text-ink-2">Selecciona hasta 4 personas mayores y 3 cuidadores o voluntarios.</p></div>
            <div className="grid min-w-0 items-start gap-4 sm:grid-cols-2">
              <div className="grid min-w-0 gap-2"><Estado consulta={adultos} vacio={adultos.datos?.data.length === 0 ? 'Sin adultos activos disponibles.' : undefined} /><SelectorEquipo titulo="Adultos de la visita" opciones={adultos.datos?.data.map((adulto) => ({ id: adulto.envejeciente_id, etiqueta: `${adulto.nombres} ${adulto.apellidos}` })) ?? []} seleccionadas={seleccionAdultos} maximo={4} cambiar={setAdultos} pagina={adultos.datos ? { actual: adultos.pagina, total: adultos.datos.meta.totalPages, cambiar: adultos.cambiar } : undefined} /></div>
              <div className="grid min-w-0 gap-2"><Estado consulta={personas} vacio={personas.datos && !disponibles.length ? 'No hay responsables disponibles en esta página.' : undefined} /><SelectorEquipo titulo="Cuidadores o voluntarios responsables" opciones={disponibles.map((persona) => ({ id: persona.usuario_id, etiqueta: persona.nombre, detalle: persona.rol === 'cuidador' ? 'Cuidador' : 'Voluntario' }))} seleccionadas={seleccionPersonas} maximo={3} cambiar={setPersonas} pagina={personas.datos ? { actual: personas.pagina, total: personas.datos.meta.totalPages, cambiar: personas.cambiar } : undefined} /></div>
            </div>
            {faltanPerfiles && <p className="rounded-sm bg-blue-100 p-3 text-sm text-ink-2">{avisoPerfilCuidador}</p>}
            <p className="rounded-sm border-l-4 border-warning-700 bg-warning-100 p-3 text-sm text-ink">{frecuencia === 'ninguna' ? 'Se guardará pendiente de autorización. El equipo podrá iniciar la visita después de que sea autorizada.' : 'Las visitas de la serie se programarán con sus participantes autorizados.'}</p>
          </>}
        </fieldset>
        {error && <p role="alert" className="mx-4 mb-4 rounded-sm bg-danger-100 p-3 text-sm text-danger">{error}</p>}
        <footer className="flex flex-wrap gap-2 border-t border-line-soft bg-surface p-4 sm:px-5">
          <Button size="sm" type="submit" loading={guardando} disabled={!enLinea || (paso === 2 && (!seleccionAdultos.length || !seleccionPersonas.length))} icon={paso === 1 ? <ChevronRight size={17} aria-hidden /> : <CalendarCheck2 size={17} aria-hidden />}>{paso === 1 ? 'Continuar con personas' : frecuencia === 'ninguna' ? 'Guardar visita pendiente' : 'Programar serie'}</Button>
          <Button size="sm" variant="outline" disabled={guardando} onClick={() => paso === 2 ? setPaso(1) : volver()}>{paso === 2 ? 'Volver a horario' : 'Cancelar'}</Button>
        </footer>
      </form>
      <aside className="grid min-w-0 gap-4">
        <section aria-label="Resumen de programación" className="rounded-md border border-line-soft bg-surface p-4"><h3 className="text-base font-semibold text-ink">Tu programación</h3><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-xs text-ink-2">Fecha y horario</dt><dd className="mt-1 font-medium text-ink">{datos.fecha ? fechaCorta(datos.fecha) : 'Por definir'}<br />{datos.hora ? hhmmA12(datos.hora) : 'Inicio por definir'}{datos.fin ? ` – ${hhmmA12(datos.fin)}` : ''}</dd></div>{datos.razon && <div><dt className="text-xs text-ink-2">Motivo</dt><dd className="mt-1 wrap-anywhere">{datos.razon}</dd></div>}<div className="border-t border-line-soft pt-3"><dt className="text-xs text-ink-2">Personas seleccionadas</dt><dd className="mt-1">{seleccionAdultos.length} {seleccionAdultos.length === 1 ? 'persona mayor' : 'personas mayores'} · {seleccionPersonas.length} {seleccionPersonas.length === 1 ? 'responsable' : 'responsables'}</dd></div></dl></section>
        <details open={mostrarAgenda} onToggle={(event) => setMostrarAgenda(event.currentTarget.open)} className="rounded-md border border-line-soft bg-surface px-4"><summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold text-navy">Consultar agenda de esta fecha</summary>{mostrarAgenda && <div className="pb-4"><CalendarioVisitas base={base} token={token} fecha={datos.fecha} /></div>}</details>
        <div className="rounded-md border border-line-soft bg-bg p-4"><p className="text-sm font-semibold text-ink">¿Una institución o grupo?</p><p className="mt-2 text-xs leading-relaxed text-ink-2">Agenda su solicitud externa para conservar los datos del grupo, la cantidad de visitantes y el aporte previsto.</p><button type="button" onClick={solicitudes} className="mt-2 min-h-12 text-left text-sm font-semibold text-navy underline underline-offset-4">Abrir solicitudes externas</button></div>
      </aside>
    </div>
  </section>
}
