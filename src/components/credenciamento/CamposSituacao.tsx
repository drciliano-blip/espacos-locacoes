'use client'

import type { Avaliacao, StatusCredenciamento } from '@/types'
import { INPUT_CLASS } from './dados'

interface Props {
  status: StatusCredenciamento
  motivoVeto: string
  avaliacao: Avaliacao | ''
  // Mostra o erro de motivo em branco só depois da tentativa de salvar.
  erroMotivo: boolean
  onStatus: (v: StatusCredenciamento) => void
  onMotivoVeto: (v: string) => void
  onAvaliacao: (v: Avaliacao | '') => void
}

// Situação (com o motivo quando vetado) e avaliação — os mesmos campos na
// ficha da pessoa e no cadastro da empresa.
export default function CamposSituacao({ status, motivoVeto, avaliacao, erroMotivo, onStatus, onMotivoVeto, onAvaliacao }: Props) {
  return (
    <>
      <div>
        <label className="block text-xs text-app-muted mb-1">Situação</label>
        <select value={status} onChange={e => onStatus(e.target.value as StatusCredenciamento)} className={`${INPUT_CLASS} cursor-pointer`}>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
          <option value="vetado">Vetado</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-app-muted mb-1">Avaliação</label>
        <select value={avaliacao} onChange={e => onAvaliacao(e.target.value as Avaliacao | '')} className={`${INPUT_CLASS} cursor-pointer`}>
          <option value="">Sem avaliação</option>
          <option value="otimo">Ótimo</option>
          <option value="bom">Bom</option>
          <option value="regular">Regular</option>
        </select>
      </div>
      {status === 'vetado' && (
        <div className="sm:col-span-2">
          <label className="block text-xs text-app-muted mb-1">Motivo do veto *</label>
          <textarea value={motivoVeto} onChange={e => onMotivoVeto(e.target.value)} rows={2}
            placeholder="O que aconteceu — fica registrado no histórico"
            className={erroMotivo ? `${INPUT_CLASS} border-red-500/50` : INPUT_CLASS} />
          {erroMotivo && <p className="text-xs text-red-400 mt-0.5">Informe o motivo do veto</p>}
        </div>
      )}
    </>
  )
}
