/* Cálculo de períodos del calendario y etiquetas de autorización. © 2026 Equipo CuidaRed – INTEC. */
import { describe, expect, it } from 'vitest'
import { diasSemanaAgenda, estadoCita, moverMesAgenda, periodoAgenda, sumarDiaAgenda } from '../../src/features/access-real/operacion/agenda-visitas-datos'

describe('fechas de la agenda de visitas', () => {
  it('cambia de mes sin saltarse febrero al partir de un día 31', () => {
    expect(moverMesAgenda('2026-03-31', -1)).toBe('2026-02-28')
    expect(moverMesAgenda('2028-03-31', -1)).toBe('2028-02-29')
    expect(moverMesAgenda('2026-12-31', 1)).toBe('2027-01-31')
  })
  it('consulta semanas completas alrededor de un mes sin perder días en los límites', () => {
    const periodo = periodoAgenda('2026-11-19')
    expect(periodo.primero).toBe('2026-11-01')
    expect(periodo.ultimo).toBe('2026-11-30')
    expect(periodo.desde).toBe('2026-10-26')
    expect(periodo.hasta).toBe('2026-12-06')
    expect(periodo.dias).toHaveLength(42)
    expect(new Set(periodo.dias).size).toBe(42)
    expect(diasSemanaAgenda('2026-11-22')).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'])
    expect(sumarDiaAgenda('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('distingue una reserva pendiente de una autorización y de una cancelación', () => {
    expect(estadoCita({ estado: 'programada', pendiente_autorizacion: true }).texto).toBe('Por autorizar')
    expect(estadoCita({ estado: 'programada', pendiente_autorizacion: false }).texto).toBe('Autorizada')
    expect(estadoCita({ estado: 'cancelada', pendiente_autorizacion: true }).texto).toBe('Cancelada')
  })
})
