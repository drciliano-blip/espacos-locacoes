'use client'

// Pedido de orçamento público — embutido no WordPress (iframe) e também
// acessível direto. Cada envio vira um registro em pedidos_orcamento com data
// e hora: é a prova de que o cliente foi apresentado pela plataforma.
// ?espaco=<slug ou nome> já deixa o espaço escolhido (botão da página do espaço).

import { useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { maskPhone } from '@/lib/utils'
import {
  BotaoEnviar, Campo, Enviado, IscaRobo, Opcoes, Pagina, Secao, inputCls, lerOrigem, useAlturaParaIframe,
} from '@/components/publico/FormPublico'

const TIPOS_EVENTO = ['Festa ou show', 'Corporativo', 'Casamento', 'Aniversário', 'Formatura', 'Gravação ou ensaio', 'Palestra ou workshop', 'Outro']

const SERVICOS = [
  { valor: 'buffet_bar', label: 'Buffet e bar' },
  { valor: 'ingressos', label: 'Venda de ingressos' },
  { valor: 'producao', label: 'Produção / promotor' },
  { valor: 'staff', label: 'Segurança e equipe' },
]

interface EspacoOpcao { id: string; nome: string; slug: string }

export default function OrcamentoPage() {
  useAlturaParaIframe()
  const [espacos, setEspacos] = useState<EspacoOpcao[]>([])
  const [espacoId, setEspacoId] = useState('')
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [dataEvento, setDataEvento] = useState('')
  const [dataFlexivel, setDataFlexivel] = useState(false)
  const [pessoas, setPessoas] = useState('')
  const [tipoEvento, setTipoEvento] = useState('')
  const [servicos, setServicos] = useState<string[]>([])
  const [mensagem, setMensagem] = useState('')
  const [isca, setIsca] = useState('')
  const [tentou, setTentou] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    createClient()
      .from('espacos')
      .select('id, nome, slug')
      .eq('status', 'ativo')
      .order('nome')
      .then(({ data }) => {
        const lista = (data as EspacoOpcao[] | null) ?? []
        setEspacos(lista)
        const pedido = lerOrigem().params.get('espaco')?.toLowerCase()
        const achado = pedido && lista.find(e => e.slug.toLowerCase() === pedido || e.nome.toLowerCase() === pedido)
        if (achado) setEspacoId(achado.id)
      })
  }, [])

  const hoje = new Date().toISOString().split('T')[0]
  const erros = {
    nome: !nome.trim(),
    telefone: telefone.replace(/\D/g, '').length < 10,
    pessoas: !(Number(pessoas) > 0),
    tipoEvento: !tipoEvento,
    dataEvento: !dataEvento && !dataFlexivel,
  }
  const temErro = Object.values(erros).some(Boolean)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (temErro) return
    if (isca) { setEnviado(true); return }
    setEnviando(true)
    setErro(null)
    const { origem, paginaOrigem } = lerOrigem()
    const espaco = espacos.find(x => x.id === espacoId)
    const { error } = await createClient().from('pedidos_orcamento').insert({
      origem,
      pagina_origem: paginaOrigem,
      espaco_id: espaco?.id ?? null,
      espaco_nome: espaco?.nome ?? null,
      nome: nome.trim(),
      telefone,
      email: email.trim() || null,
      data_evento: dataEvento || null,
      data_flexivel: dataFlexivel,
      numero_pessoas: Number(pessoas),
      tipo_evento: tipoEvento,
      servicos,
      mensagem: mensagem.trim() || null,
    })
    setEnviando(false)
    if (error) {
      setErro('Não foi possível enviar agora. Tente de novo ou chame no WhatsApp (11) 95080-0033.')
      return
    }
    setEnviado(true)
  }

  if (enviado) {
    return <Enviado titulo="Pedido recebido!" texto="Nossa equipe vai falar com você pelo WhatsApp em até 24 horas com as opções de espaço e a proposta." />
  }

  return (
    <Pagina titulo="Peça um orçamento" subtitulo="Conte sobre o seu evento e receba a proposta em até 24 horas.">
      <form onSubmit={enviar} className="space-y-5" noValidate>
        <IscaRobo valor={isca} onChange={setIsca} />

        <Secao titulo="Seu evento">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo label="Espaço">
              <select value={espacoId} onChange={e => setEspacoId(e.target.value)} className={inputCls}>
                <option value="">Ainda não sei — me ajudem a escolher</option>
                {espacos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </Campo>
            <Campo label="Tipo de evento" required erro={tentou && erros.tipoEvento}>
              <select value={tipoEvento} onChange={e => setTipoEvento(e.target.value)} className={inputCls}>
                <option value="">Selecione</option>
                {TIPOS_EVENTO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Campo>
            <Campo label="Data do evento" required={!dataFlexivel} erro={tentou && erros.dataEvento}>
              <input type="date" min={hoje} value={dataEvento} onChange={e => setDataEvento(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Número de pessoas" required erro={tentou && erros.pessoas}>
              <input type="number" min={1} inputMode="numeric" value={pessoas} onChange={e => setPessoas(e.target.value)} placeholder="Ex.: 500" className={inputCls} />
            </Campo>
          </div>
          <label className="flex items-center gap-2 text-xs text-stone-600">
            <input type="checkbox" checked={dataFlexivel} onChange={e => setDataFlexivel(e.target.checked)} className="accent-[#25D366]" />
            Ainda não tenho data fechada / a data é flexível
          </label>
        </Secao>

        <Secao titulo="Serviços que você também precisa (opcional)">
          <Opcoes opcoes={SERVICOS} valores={servicos} onChange={setServicos} />
        </Secao>

        <Secao titulo="Seu contato">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo label="Nome" required erro={tentou && erros.nome}>
              <input value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" className={inputCls} />
            </Campo>
            <Campo label="WhatsApp" required erro={tentou && erros.telefone}>
              <input value={telefone} onChange={e => setTelefone(maskPhone(e.target.value))} inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" className={inputCls} />
            </Campo>
            <div className="sm:col-span-2">
              <Campo label="E-mail">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" className={inputCls} />
              </Campo>
            </div>
            <div className="sm:col-span-2">
              <Campo label="Algo mais que devemos saber?">
                <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} rows={3} className={inputCls} placeholder="Horário, estilo do evento, orçamento previsto…" />
              </Campo>
            </div>
          </div>
        </Secao>

        {erro && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{erro}</p>}
        <BotaoEnviar enviando={enviando} label="Pedir orçamento" />
        <p className="text-[11px] text-stone-500 text-center">
          Ao enviar, você autoriza a Espaços &amp; Locações a usar estes dados para falar com você sobre este evento.
        </p>
      </form>
    </Pagina>
  )
}
