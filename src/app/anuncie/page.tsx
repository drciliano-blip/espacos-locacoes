'use client'

// "Anuncie seu espaço" — cadastro inicial do dono que quer entrar na
// plataforma (Plano 2027). Vira um registro em espacos_candidatos, NÃO um
// espaço: só passa a espaço depois do checklist de documentos e da aprovação
// da equipe. Embutido no WordPress (iframe) e acessível direto.
// Planos sem preço de propósito: valores ainda em validação com os sócios.

import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { maskCNPJ, maskPhone } from '@/lib/utils'
import {
  BotaoEnviar, Campo, Enviado, IscaRobo, Opcoes, Pagina, Secao, inputCls, lerOrigem, useAlturaParaIframe,
} from '@/components/publico/FormPublico'

const ESTILOS = [
  { valor: 'festas_shows', label: 'Festas e shows' },
  { valor: 'corporativo', label: 'Corporativo' },
  { valor: 'casamentos', label: 'Casamentos' },
  { valor: 'gravacoes', label: 'Gravações' },
  { valor: 'palestras', label: 'Palestras e workshops' },
]

const DOCUMENTOS = [
  { valor: 'avcb', label: 'AVCB vigente' },
  { valor: 'alvara', label: 'Alvará de funcionamento' },
  { valor: 'seguranca_pf', label: 'Segurança autorizada pela Polícia Federal' },
  { valor: 'brigada', label: 'Brigada / bombeiro civil' },
  { valor: 'planta', label: 'Planta e ficha técnica' },
  { valor: 'fotos', label: 'Fotos e vídeos do espaço' },
]

const PLANOS = [
  { valor: 'vitrine', nome: 'Vitrine', texto: 'Seu espaço no site, sem mensalidade. Pagamento só por data vendida.' },
  { valor: 'destaque', nome: 'Destaque', texto: 'Destaque na busca, conteúdo mensal e anúncios, com garantia de retorno.' },
  { valor: 'exclusivo', nome: 'Exclusivo', texto: 'Topo da busca, gravação profissional e gestão completa do espaço.' },
  { valor: 'nao_sei', nome: 'Ainda não sei', texto: 'Quero conversar antes de escolher.' },
]

export default function AnunciePage() {
  useAlturaParaIframe()
  const [nomeEspaco, setNomeEspaco] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('São Paulo')
  const [capacidade, setCapacidade] = useState('')
  const [estilos, setEstilos] = useState<string[]>([])
  const [plano, setPlano] = useState('')
  const [documentos, setDocumentos] = useState<string[]>([])
  const [siteInstagram, setSiteInstagram] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [isca, setIsca] = useState('')
  const [tentou, setTentou] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const erros = {
    nomeEspaco: !nomeEspaco.trim(),
    responsavel: !responsavel.trim(),
    telefone: telefone.replace(/\D/g, '').length < 10,
    email: !/^\S+@\S+\.\S+$/.test(email.trim()),
    bairro: !bairro.trim(),
    capacidade: !(Number(capacidade) > 0),
  }
  const temErro = Object.values(erros).some(Boolean)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (temErro) return
    if (isca) { setEnviado(true); return }
    setEnviando(true)
    setErro(null)
    const { paginaOrigem } = lerOrigem()
    const { error } = await createClient().from('espacos_candidatos').insert({
      pagina_origem: paginaOrigem,
      nome_espaco: nomeEspaco.trim(),
      responsavel_nome: responsavel.trim(),
      telefone,
      email: email.trim(),
      cnpj: cnpj || null,
      bairro: bairro.trim(),
      cidade: cidade.trim() || 'São Paulo',
      capacidade: Number(capacidade),
      estilos,
      plano_interesse: plano || null,
      documentos,
      site_instagram: siteInstagram.trim() || null,
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
    return <Enviado titulo="Cadastro recebido!" texto="Nossa equipe vai falar com você em até 2 dias úteis para conhecer o espaço e explicar os próximos passos." />
  }

  return (
    <Pagina titulo="Anuncie seu espaço" subtitulo="Venda mais datas com a Espaços & Locações. Conte sobre o seu espaço e entramos em contato.">
      <form onSubmit={enviar} className="space-y-5" noValidate>
        <IscaRobo valor={isca} onChange={setIsca} />

        <Secao titulo="O espaço">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo label="Nome do espaço" required erro={tentou && erros.nomeEspaco}>
              <input value={nomeEspaco} onChange={e => setNomeEspaco(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Capacidade máxima (pessoas)" required erro={tentou && erros.capacidade}>
              <input type="number" min={1} inputMode="numeric" value={capacidade} onChange={e => setCapacidade(e.target.value)} placeholder="Ex.: 800" className={inputCls} />
            </Campo>
            <Campo label="Bairro" required erro={tentou && erros.bairro}>
              <input value={bairro} onChange={e => setBairro(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Cidade">
              <input value={cidade} onChange={e => setCidade(e.target.value)} className={inputCls} />
            </Campo>
            <div className="sm:col-span-2">
              <Campo label="Site ou Instagram do espaço">
                <input value={siteInstagram} onChange={e => setSiteInstagram(e.target.value)} placeholder="@seuespaco" className={inputCls} />
              </Campo>
            </div>
          </div>
          <p className="text-xs text-stone-600">Para que tipo de evento?</p>
          <Opcoes opcoes={ESTILOS} valores={estilos} onChange={setEstilos} />
        </Secao>

        <Secao titulo="Documentos que já estão em dia">
          <p className="text-xs text-stone-500 -mt-1">Só publicamos espaços com a documentação em dia. Se faltar algo, ajudamos a regularizar.</p>
          <Opcoes opcoes={DOCUMENTOS} valores={documentos} onChange={setDocumentos} />
        </Secao>

        <Secao titulo="Plano de interesse">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PLANOS.map(p => (
              <button
                key={p.valor}
                type="button"
                onClick={() => setPlano(p.valor)}
                className={`text-left rounded-xl border p-3 transition-colors ${plano === p.valor ? 'border-[#25D366] bg-[#25D366]/10' : 'border-stone-300 hover:bg-stone-50'}`}
              >
                <p className="text-sm font-semibold">{p.nome}</p>
                <p className="text-xs text-stone-600 mt-0.5">{p.texto}</p>
              </button>
            ))}
          </div>
        </Secao>

        <Secao titulo="Responsável">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo label="Nome" required erro={tentou && erros.responsavel}>
              <input value={responsavel} onChange={e => setResponsavel(e.target.value)} autoComplete="name" className={inputCls} />
            </Campo>
            <Campo label="WhatsApp" required erro={tentou && erros.telefone}>
              <input value={telefone} onChange={e => setTelefone(maskPhone(e.target.value))} inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" className={inputCls} />
            </Campo>
            <Campo label="E-mail" required erro={tentou && erros.email}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" className={inputCls} />
            </Campo>
            <Campo label="CNPJ">
              <input value={cnpj} onChange={e => setCnpj(maskCNPJ(e.target.value))} inputMode="numeric" placeholder="00.000.000/0000-00" className={inputCls} />
            </Campo>
            <div className="sm:col-span-2">
              <Campo label="Algo mais que devemos saber?">
                <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} rows={3} className={inputCls} placeholder="Ambientes, estrutura inclusa, datas mais livres…" />
              </Campo>
            </div>
          </div>
        </Secao>

        {erro && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{erro}</p>}
        <BotaoEnviar enviando={enviando} label="Quero anunciar meu espaço" />
        <p className="text-[11px] text-stone-500 text-center">
          Ao enviar, você autoriza a Espaços &amp; Locações a usar estes dados para falar com você sobre a parceria.
        </p>
      </form>
    </Pagina>
  )
}
