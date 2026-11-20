/*
 * visitas-dashboard.spec.ts — Agenda, prioridades, totales completos y programación adaptable.
 * Módulo: pruebas · visitas conectadas. Datos sintéticos; API interceptada.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { expect, test, type Page } from '@playwright/test'
import { API, cuentaActiva, iniciarSesion, simular } from './ayudas-fase2'

const cuentaId = '9007199254740993'
const backend = `${API}/api/v1/cuentas/${cuentaId}`
const ruta = `/operacion/${cuentaId}/visitas`
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santo_Domingo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const dia = (cantidad: number) => new Date(new Date(`${hoy}T12:00:00Z`).getTime() + cantidad * 86_400_000).toISOString().slice(0, 10)
const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`
const adulto = { envejeciente_id: id(900), nombres: 'Lucía', apellidos: 'Peña' }
const responsable = { usuario_id: id(901), nombre: 'María Ramírez', nombres: 'María', apellidos: 'Ramírez', rol: 'cuidador', cuidador_id: '1' }
const cita = (n: number, fecha: string, estado = 'programada', extra: object = {}) => ({
  visita_id: id(n), fecha, hora_programada: '09:00', hora_fin_programada: '10:00', razon: `Seguimiento ${n}`,
  estado, fecha_actualizacion: `${hoy}T12:00:00Z`, autorizada_por: { usuario_id: id(990) },
  adultos: [adulto], participantes: [responsable], ...extra,
})
const visitas = [
  cita(1, hoy, 'programada', { tipo_visita: 'institucional', entidad_visitante: 'Fundación Manos Cercanas', cantidad_visitantes: 12, adultos: [], razon: 'Encuentro de acompañamiento' }),
  cita(2, hoy, 'completada', { hora_programada: '11:00', hora_fin_programada: '12:00' }),
  cita(3, hoy, 'en_curso', { hora_programada: '15:00', hora_fin_programada: '16:00' }),
  cita(4, dia(1), 'programada', { pendiente_autorizacion: true, autorizada_por: null, razon: 'Acompañamiento familiar' }),
  cita(5, dia(-5), 'cancelada'),
  cita(6, dia(2), 'programada', { tipo_visita: 'institucional', entidad_visitante: 'Universidad del Encuentro', cantidad_visitantes: 8, adultos: [] }),
]
const solicitudes = [
  { solicitud_visita_id: id(50), estado: 'pendiente', tipo_visita: 'institucional', entidad_visitante: 'Iglesia Buen Camino', cantidad_visitantes: 15, aporte_previsto: 'Taller de música y convivencia', persona_a_visitar: null, visitante: { nombres: 'Elena', apellidos: 'Vargas' }, fecha_propuesta: dia(2), hora_propuesta: '10:00', motivo: 'Actividad de acompañamiento' },
  { solicitud_visita_id: id(51), estado: 'pendiente', tipo_visita: 'personal', cantidad_visitantes: 1, persona_a_visitar: 'Lucía Peña', visitante: { nombres: 'Daniel', apellidos: 'Peña' }, fecha_propuesta: dia(1), hora_propuesta: '15:00', motivo: 'Visita a mi madre' },
  { solicitud_visita_id: id(52), estado: 'pendiente', tipo_visita: 'institucional', entidad_visitante: 'Grupo comunitario Los Pinos', cantidad_visitantes: 6, persona_a_visitar: null, visitante: { nombres: 'Clara', apellidos: 'Reyes' }, fecha_propuesta: dia(3), hora_propuesta: '11:00', motivo: 'Jornada de lectura' },
]

async function preparar(page: Page, datos = visitas) {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Fundación Encuentro', rol: 'administrador', permisos: ['visitas:ver', 'visitas:autorizar', 'visitas:programar'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  const paginas: number[] = []
  await page.route(`${backend}/**`, (r) => {
    const url = new URL(r.request().url())
    const path = url.pathname
    const page = Number(url.searchParams.get('page') ?? 1)
    const limit = Number(url.searchParams.get('limit') ?? 20)
    const pagina = (items: unknown[]) => ({ data: items.slice((page - 1) * limit, page * limit), meta: { page, limit, total: items.length, totalPages: Math.ceil(items.length / limit) } })
    if (path.endsWith('/contexto')) return r.fulfill({ json: { data: cuenta } })
    if (path.endsWith('/solicitudes-visita')) return r.fulfill({ json: pagina(solicitudes) })
    if (path.endsWith('/candidatos/visita')) return r.fulfill({ json: pagina([responsable]) })
    if (path.endsWith('/envejecientes')) return r.fulfill({ json: pagina([adulto]) })
    if (path.endsWith('/visitas')) {
      paginas.push(page)
      const desde = url.searchParams.get('filter[desde]') ?? ''
      const hasta = url.searchParams.get('filter[hasta]') ?? '9999-12-31'
      const estado = url.searchParams.get('filter[estado]')
      return r.fulfill({ json: pagina(datos.filter((v) => v.fecha >= desde && v.fecha <= hasta && (!estado || v.estado === estado))) })
    }
    const visita = datos.find((v) => path.endsWith(`/${v.visita_id}`))
    if (visita) return r.fulfill({ json: { data: visita } })
    return r.fallback()
  })
  await iniciarSesion(page, sim.correo)
  await page.goto(ruta)
  await expect(page.getByRole('heading', { name: 'Visitas de la organización' })).toBeVisible()
  return { paginas }
}

test('el panel muestra pendientes, agenda real y gráficos sin desbordarse', async ({ page, isMobile }, testInfo) => {
  if (!isMobile) await page.setViewportSize({ width: 1440, height: 1000 })
  await preparar(page)
  await expect(page.getByLabel('Indicadores de visitas')).toContainText('Solicitudes por revisar3')
  await expect(page.getByRole('heading', { name: 'Solicitudes pendientes' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Comparación semanal de visitas por realizar, realizadas y canceladas' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Agenda del día' })).toContainText('3 visitas')
  await expect(page.getByRole('region', { name: 'Agenda del día' }).getByText('Fundación Manos Cercanas', { exact: true })).toBeVisible()
  if (isMobile) {
    await expect(page.getByLabel('Fecha del calendario')).toBeVisible()
    await page.getByLabel('Fecha del calendario').fill(dia(1))
    await expect(page.getByRole('region', { name: 'Agenda del día' })).toContainText('Por autorizar')
  } else {
    await page.getByRole('button', { name: 'Mes', exact: true }).click()
    await expect(page.getByRole('group', { name: /^Calendario de/ })).toBeVisible()
    await page.getByRole('button', { name: 'Semana', exact: true }).click()
  }
  await page.screenshot({ path: testInfo.outputPath('panel-visitas.png'), fullPage: true, scale: 'css' })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  if (isMobile) {
    await page.setViewportSize({ width: 320, height: 640 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  }
  await page.getByRole('button', { name: 'Revisar solicitud', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Autorizar solicitud de visita' })).toBeVisible()
  await expect(page.getByText('Iglesia Buen Camino', { exact: false }).last()).toBeVisible()
  await expect(page.getByRole('combobox', { name: /Persona mayor de la organización/ })).toHaveCount(0)
})

test('el calendario abre el detalle y permite navegar el período', async ({ page, isMobile }) => {
  await preparar(page)
  if (isMobile) {
    await page.getByRole('region', { name: 'Agenda del día' }).getByRole('button', { name: /Fundación Manos Cercanas/ }).click()
  } else {
    await page.getByRole('button', { name: /^Abrir visita: Fundación Manos Cercanas/ }).click()
  }
  await expect(page.getByRole('heading', { name: 'Detalle de visita' })).toBeVisible()
  await page.getByRole('button', { name: 'Volver a visitas', exact: true }).click()
  await page.getByRole('button', { name: 'Ampliar calendario' }).click()
  await expect(page.getByRole('heading', { name: 'Agenda de visitas' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Solicitudes pendientes' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Semana siguiente' }).click()
  await page.getByRole('button', { name: 'Hoy', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Agenda del día' })).toContainText('3 visitas')
})

test('los indicadores y el gráfico incluyen todas las páginas del período', async ({ page }) => {
  const cantidad = 105
  const datos = Array.from({ length: cantidad }, (_, n) => cita(n + 100, hoy))
  const { paginas } = await preparar(page, datos)
  await expect(page.getByLabel('Indicadores de visitas')).toContainText(`Visitas del mes${cantidad}`)
  expect(paginas).toContain(2)
  await expect(page.getByRole('region', { name: 'Agenda del día' })).toContainText(`${cantidad} visitas`)
})

test('programar conserva los datos entre pasos y valida el horario', async ({ page, isMobile }, testInfo) => {
  await preparar(page)
  await page.getByRole('button', { name: 'Programar visita', exact: true }).click()
  await page.getByLabel(/^Hora de inicio/).fill('11:00')
  await page.getByLabel(/^Hora de fin/).fill('10:00')
  await page.getByLabel(/^Motivo de la visita/).fill('Acompañamiento semanal')
  await page.getByRole('button', { name: 'Continuar con personas' }).click()
  await expect(page.getByRole('alert')).toContainText('La hora de fin debe ser posterior')
  await page.getByLabel(/^Hora de fin/).fill('12:00')
  await page.getByRole('button', { name: 'Continuar con personas' }).click()
  await page.getByRole('checkbox', { name: 'Lucía Peña' }).check()
  await page.getByRole('checkbox', { name: /María Ramírez/ }).check()
  await expect(page.getByRole('button', { name: 'Guardar visita pendiente' })).toBeEnabled()
  await page.getByRole('button', { name: 'Volver a horario' }).click()
  await expect(page.getByLabel(/^Hora de inicio/)).toHaveValue('11:00')
  await expect(page.getByLabel(/^Motivo de la visita/)).toHaveValue('Acompañamiento semanal')
  await page.screenshot({ path: testInfo.outputPath('programar-visita.png'), fullPage: true, scale: 'css' })
  await page.getByRole('button', { name: 'Continuar con personas' }).click()
  await expect(page.getByRole('checkbox', { name: 'Lucía Peña' })).toBeChecked()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  if (isMobile) {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.getByRole('button', { name: 'Volver a horario' }).click()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  }
})
