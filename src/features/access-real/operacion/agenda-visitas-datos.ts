/*
 * agenda-visitas-datos.ts — Fechas, estados y consulta completa de la agenda autorizada.
 * Módulo: access-real · visitas. © 2026 Equipo CuidaRed – INTEC.
 */
import { useEffect, useState } from 'react'
import { apiPage } from '../client'
import { useConexionReal } from './controles'
import type { Visita } from './visitas'

export const aFechaAgenda = (iso: string) => new Date(`${iso}T12:00:00Z`)
export function sumarDiaAgenda(iso: string, dias: number) {
  const fecha = aFechaAgenda(iso)
  fecha.setUTCDate(fecha.getUTCDate() + dias)
  return fecha.toISOString().slice(0, 10)
}
export function moverMesAgenda(iso: string, cantidad: number) {
  const fecha = aFechaAgenda(iso)
  const ultimo = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + cantidad + 1, 0)).getUTCDate()
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + cantidad, Math.min(fecha.getUTCDate(), ultimo), 12)).toISOString().slice(0, 10)
}
export function diasSemanaAgenda(iso: string) {
  const lunes = sumarDiaAgenda(iso, -((aFechaAgenda(iso).getUTCDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, n) => sumarDiaAgenda(lunes, n))
}
export function periodoAgenda(iso: string) {
  const primero = `${iso.slice(0, 7)}-01`
  const ultimo = sumarDiaAgenda(moverMesAgenda(primero, 1), -1)
  const desde = diasSemanaAgenda(primero)[0]!
  const hasta = diasSemanaAgenda(ultimo)[6]!
  const cantidad = Math.round((aFechaAgenda(hasta).getTime() - aFechaAgenda(desde).getTime()) / 86_400_000) + 1
  return { primero, ultimo, desde, hasta, dias: Array.from({ length: cantidad }, (_, n) => sumarDiaAgenda(desde, n)) }
}
const formatoMes = new Intl.DateTimeFormat('es-DO', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const formatoDia = new Intl.DateTimeFormat('es-DO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
export const mesAgenda = (iso: string) => formatoMes.format(aFechaAgenda(iso))
export const diaAgenda = (iso: string) => formatoDia.format(aFechaAgenda(iso))
export const tituloCita = (visita: Visita) => visita.entidad_visitante || (visita.adultos?.length ? visita.adultos.map((adulto) => `${adulto.nombres} ${adulto.apellidos}`).join(', ') : visita.razon)
export const responsableCita = (visita: Visita) => visita.participantes.map((persona) => persona.nombre || [persona.nombres, persona.apellidos].filter(Boolean).join(' ')).filter(Boolean).join(', ')

export function estadoCita(visita: Pick<Visita, 'estado' | 'pendiente_autorizacion'>) {
  if (visita.estado === 'cancelada') return { texto: 'Cancelada', clase: 'border-danger bg-danger-100 text-danger', punto: 'bg-danger' }
  if (visita.estado === 'completada') return { texto: 'Realizada', clase: 'border-success-700 bg-success-100 text-success-700', punto: 'bg-success-700' }
  if (visita.estado === 'en_curso') return { texto: 'En curso', clase: 'border-navy bg-navy text-white', punto: 'bg-navy' }
  if (visita.pendiente_autorizacion) return { texto: 'Por autorizar', clase: 'border-warning-700 bg-warning-100 text-warning-700', punto: 'bg-warning-700' }
  return { texto: 'Autorizada', clase: 'border-blue bg-blue-100 text-navy', punto: 'bg-blue' }
}

export function useRevisionAgenda(revision: number) {
  const [ciclo, setCiclo] = useState(0)
  useEffect(() => {
    const actualizar = () => { if (document.visibilityState === 'visible') setCiclo((n) => n + 1) }
    const timer = window.setInterval(actualizar, 30_000)
    window.addEventListener('focus', actualizar)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', actualizar) }
  }, [])
  return { revision: revision + ciclo, actualizar: () => setCiclo((n) => n + 1) }
}

type ResultadoAgenda = { clave: string; token: string; visitas?: Visita[]; actualizada?: Date; error?: true }
export function useAgendaCompleta(base: string, token: string, fecha: string, revision: number) {
  const { desde, hasta } = periodoAgenda(fecha)
  const clave = `${base}|${desde}|${hasta}`
  const enLinea = useConexionReal()
  const [resultado, setResultado] = useState<ResultadoAgenda>()
  const [cargando, setCargando] = useState(true)
  useEffect(() => {
    if (!enLinea) return
    let vigente = true
    const cargar = async () => {
      setCargando(true)
      try {
        const consulta = { limit: 100, filters: { desde, hasta }, sort: ['fecha', 'hora_programada'] }
        const primera = await apiPage<Visita>(`${base}/visitas`, token, { ...consulta, page: 1 })
        const visitas = [...primera.data]
        for (let page = 2; page <= primera.meta.totalPages; page++) {
          if (!vigente) return
          const siguiente = await apiPage<Visita>(`${base}/visitas`, token, { ...consulta, page })
          if (siguiente.meta.total !== primera.meta.total) throw new Error('La agenda cambió durante la consulta.')
          visitas.push(...siguiente.data)
        }
        if (new Set(visitas.map((visita) => visita.visita_id)).size !== primera.meta.total) throw new Error('La agenda requiere otra consulta.')
        if (vigente) setResultado({ clave, token, visitas, actualizada: new Date() })
      } catch {
        if (vigente) setResultado((anterior) => ({ ...(anterior?.clave === clave && anterior.token === token ? anterior : { clave, token }), error: true }))
      } finally { if (vigente) setCargando(false) }
    }
    void cargar()
    return () => { vigente = false }
  }, [base, token, clave, desde, hasta, revision, enLinea])
  const actual = resultado?.clave === clave && resultado.token === token ? resultado : undefined
  return { visitas: actual?.visitas, actualizada: actual?.actualizada, error: actual?.error, cargando, sinConexion: !enLinea }
}
