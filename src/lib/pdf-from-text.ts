// Converte texto puro num PDF simples — usado tanto pra gerar o PDF de um
// contrato redigido por IA quanto pra transformar um texto colado (ex: de
// WhatsApp) num documento anexável, sem precisar de arquivo nenhum de origem.
export async function gerarPdfFile(texto: string, nomeArquivo: string): Promise<File> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 48
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const maxWidth = pageWidth - margin * 2
  const lineHeight = 14

  doc.setFont('times', 'normal')
  doc.setFontSize(11)
  const lines = doc.splitTextToSize(texto, maxWidth) as string[]

  let y = margin
  for (const line of lines) {
    if (y > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
    doc.text(line, margin, y)
    y += lineHeight
  }

  const blob = doc.output('blob')
  return new File([blob], nomeArquivo, { type: 'application/pdf' })
}
