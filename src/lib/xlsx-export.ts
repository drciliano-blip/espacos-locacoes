import * as XLSX from 'xlsx'

export interface ExportSheet {
  name: string
  rows: (string | number)[][]
}

// Gera e baixa um .xlsx com uma aba por item de `sheets` — usado para que a
// exportação em Excel traga exatamente os mesmos dados exibidos na tela.
export function downloadWorkbook(sheets: ExportSheet[], filename: string) {
  const wb = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows)
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31))
  }
  XLSX.writeFile(wb, filename)
}
