function pad(n: number) { return String(n).padStart(2, '0') }

export function getPeriodRange(periodo: string): { inicio: string; fim: string } {
  const hoje = new Date()
  const ty = hoje.getFullYear()
  const tm = hoje.getMonth() + 1
  const td = hoje.getDate()
  const TODAY = `${ty}-${pad(tm)}-${pad(td)}`

  if (periodo === 'semanal') {
    const d = new Date(ty, tm - 1, td - 7)
    return { inicio: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, fim: TODAY }
  }
  if (periodo === 'mensal') {
    return { inicio: `${ty}-${pad(tm)}-01`, fim: TODAY }
  }
  if (periodo === 'trimestral') {
    const start = tm - 3 <= 0
      ? `${ty - 1}-${pad(12 + (tm - 3))}-01`
      : `${ty}-${pad(tm - 3)}-01`
    return { inicio: start, fim: TODAY }
  }
  if (periodo === 'semestral') {
    const start = tm - 6 <= 0
      ? `${ty - 1}-${pad(12 + (tm - 6))}-01`
      : `${ty}-${pad(tm - 6)}-01`
    return { inicio: start, fim: TODAY }
  }
  // anual (default)
  return { inicio: `${ty - 1}-${pad(tm)}-01`, fim: TODAY }
}
