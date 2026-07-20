'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Plus, Edit2, ShieldCheck, Eye, Briefcase, DollarSign, CheckCircle2, XCircle, X, Save, Info, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { NivelAcesso } from '@/types'

interface Profile {
  id: string
  nome: string
  email: string
  role: NivelAcesso
  ativo: boolean
  ultimo_acesso: string | null
  created_at: string
}

const roleConfig: Record<NivelAcesso, { label: string; color: string; icon: React.ElementType; desc: string }> = {
  admin: {
    label: 'Admin', color: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
    icon: ShieldCheck, desc: 'Acesso total ao sistema',
  },
  financeiro: {
    label: 'Financeiro', color: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
    icon: DollarSign, desc: 'Dashboard, Pagamentos, Eventos, Relatórios, Contas a Pagar',
  },
  operacional: {
    label: 'Operacional', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    icon: Briefcase, desc: 'Dashboard, Agenda, Eventos, Espaços',
  },
  visualizador: {
    label: 'Visualizador', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
    icon: Eye, desc: 'Somente Dashboard (leitura)',
  },
}

const permissionsMatrix: Record<NivelAcesso, string[]> = {
  admin: ['Dashboard', 'Agenda', 'Pagamentos', 'Eventos', 'Relatórios', 'Contas a Pagar', 'Usuários', 'Espaços'],
  financeiro: ['Dashboard', 'Pagamentos', 'Eventos', 'Relatórios', 'Contas a Pagar'],
  operacional: ['Dashboard', 'Agenda', 'Eventos', 'Espaços'],
  visualizador: ['Dashboard'],
}

const allPages = ['Dashboard', 'Agenda', 'Pagamentos', 'Eventos', 'Relatórios', 'Contas a Pagar', 'Usuários', 'Espaços']

export default function UsuariosPage() {
  const [lista, setLista] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [draft, setDraft] = useState<{ nome: string; role: NivelAcesso; ativo: boolean }>({
    nome: '', role: 'operacional', ativo: true,
  })
  const [novoUsuarioOpen, setNovoUsuarioOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'usuarios' | 'permissoes'>('usuarios')

  const loadUsuarios = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('profiles').select('*').order('nome')
    setLista((data as Profile[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadUsuarios() }, [loadUsuarios])

  function openEdit(user: Profile) {
    setEditingUser(user)
    setDraft({ nome: user.nome, role: user.role, ativo: user.ativo })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!editingUser || !draft.nome) return
    const supabase = createClient()
    await supabase
      .from('profiles')
      .update({ nome: draft.nome, role: draft.role, ativo: draft.ativo })
      .eq('id', editingUser.id)
    setModalOpen(false)
    loadUsuarios()
  }

  async function toggleAtivo(user: Profile) {
    const supabase = createClient()
    await supabase.from('profiles').update({ ativo: !user.ativo }).eq('id', user.id)
    loadUsuarios()
  }

  const ativos = lista.filter((u) => u.ativo).length

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/20">
            <Users className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-app-text">{lista.length} usuários cadastrados</p>
            <p className="text-xs text-app-muted">{ativos} ativos · {lista.length - ativos} inativos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadUsuarios}
            title="Atualizar lista"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-app-border2 text-app-muted hover:bg-app-surface2 hover:text-app-text transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setNovoUsuarioOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Usuário
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-app-border bg-app-surface">
        <div className="flex border-b border-app-border px-5">
          {(['usuarios', 'permissoes'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-app-muted hover:text-app-text'
              }`}
            >
              {t === 'usuarios' ? 'Usuários' : 'Matriz de Permissões'}
            </button>
          ))}
        </div>

        {activeTab === 'usuarios' && (
          <div className="divide-y divide-app-border/40">
            {loading && lista.length === 0 && (
              <p className="px-5 py-6 text-sm text-app-muted">Carregando usuários...</p>
            )}
            {!loading && lista.length === 0 && (
              <p className="px-5 py-6 text-sm text-app-muted">Nenhum usuário cadastrado ainda.</p>
            )}
            {lista.map((user) => {
              const RoleIcon = roleConfig[user.role].icon
              return (
                <div key={user.id} className={`flex items-center justify-between px-5 py-4 transition-colors hover:bg-app-surface2/30 ${!user.ativo ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-app-surface2 border border-app-border2 shrink-0">
                      <span className="text-sm font-bold text-app-text2">
                        {user.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-app-text">{user.nome}</p>
                        {!user.ativo && (
                          <span className="text-xs text-app-subtle bg-app-surface2 rounded-full px-2 py-0.5 border border-app-border2">
                            Inativo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-app-muted">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="hidden md:block text-right">
                      <p className="text-xs text-app-subtle">Último acesso</p>
                      <p className="text-xs text-app-text2">{user.ultimo_acesso ? user.ultimo_acesso.split('-').reverse().join('/') : '—'}</p>
                    </div>

                    <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${roleConfig[user.role].color}`}>
                      <RoleIcon className="h-3 w-3" />
                      {roleConfig[user.role].label}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleAtivo(user)}
                        title={user.ativo ? 'Desativar' : 'Ativar'}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-app-surface2 hover:text-app-text transition-colors"
                      >
                        {user.ativo ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => openEdit(user)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-app-surface2 hover:text-violet-400 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'permissoes' && (
          <div className="p-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-app-border">
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-app-subtle uppercase tracking-wider">Página / Módulo</th>
                  {(Object.keys(roleConfig) as NivelAcesso[]).map((role) => {
                    const RoleIcon = roleConfig[role].icon
                    return (
                      <th key={role} className="py-2 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${roleConfig[role].color}`}>
                          <RoleIcon className="h-3 w-3" />
                          {roleConfig[role].label}
                        </span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/30">
                {allPages.map((page) => (
                  <tr key={page} className="hover:bg-app-surface2/30 transition-colors">
                    <td className="py-2.5 pr-4 text-sm text-app-text2">{page}</td>
                    {(Object.keys(roleConfig) as NivelAcesso[]).map((role) => (
                      <td key={role} className="py-2.5 px-4 text-center">
                        {permissionsMatrix[role].includes(page) ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                        ) : (
                          <span className="text-app-border2 text-lg leading-none">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              {(Object.keys(roleConfig) as NivelAcesso[]).map((role) => {
                const RoleIcon = roleConfig[role].icon
                return (
                  <div key={role} className={`rounded-lg border p-3 ${roleConfig[role].color.replace('text-', 'border-').split(' ')[0]}/20`}>
                    <div className={`flex items-center gap-1.5 mb-1 ${roleConfig[role].color.split(' ')[1]}`}>
                      <RoleIcon className="h-3.5 w-3.5" />
                      <span className="text-xs font-semibold">{roleConfig[role].label}</span>
                    </div>
                    <p className="text-xs text-app-muted">{roleConfig[role].desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal: como adicionar um novo usuário (criação real acontece no Supabase Dashboard) */}
      {novoUsuarioOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setNovoUsuarioOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-app-border bg-app-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-app-text flex items-center gap-2">
                <Info className="h-4 w-4 text-violet-400" />
                Como adicionar um usuário
              </h3>
              <button onClick={() => setNovoUsuarioOpen(false)} className="text-app-subtle hover:text-app-text">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ol className="space-y-2 text-sm text-app-text2 list-decimal list-inside">
              <li>No painel do Supabase, vá em <strong>Authentication → Users → Add user</strong> e cadastre e-mail e senha.</li>
              <li>Volte aqui e clique em atualizar (<RefreshCw className="inline h-3 w-3" />) — o novo usuário aparece automaticamente com o papel &quot;Visualizador&quot;.</li>
              <li>Clique no ícone de editar para ajustar nome e nível de acesso.</li>
            </ol>
            <button
              onClick={() => setNovoUsuarioOpen(false)}
              className="mt-5 w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {/* Modal editar */}
      {modalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-app-border bg-app-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-app-text">Editar Usuário</h3>
              <button onClick={() => setModalOpen(false)} className="text-app-subtle hover:text-app-text">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-app-text2 mb-1">Nome completo</label>
                <input
                  value={draft.nome}
                  onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
                  placeholder="Ex: Mariana Costa"
                  className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-3 py-2 text-sm text-app-text focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-app-text2 mb-1">E-mail</label>
                <input
                  value={editingUser.email}
                  disabled
                  className="w-full rounded-lg border border-app-border2 bg-app-surface3 px-3 py-2 text-sm text-app-subtle cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-app-subtle">E-mail é gerenciado no Supabase Auth, não pode ser editado aqui.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-app-text2 mb-2">Nível de acesso</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(roleConfig) as NivelAcesso[]).map((role) => {
                    const RoleIcon = roleConfig[role].icon
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, role }))}
                        className={`flex items-start gap-2 rounded-lg border p-2.5 text-left transition-all ${
                          draft.role === role
                            ? `border-violet-500 bg-violet-500/10`
                            : 'border-app-border2 hover:border-app-border'
                        }`}
                      >
                        <RoleIcon className={`h-4 w-4 mt-0.5 shrink-0 ${draft.role === role ? 'text-violet-400' : 'text-app-muted'}`} />
                        <div>
                          <p className={`text-xs font-semibold ${draft.role === role ? 'text-violet-300' : 'text-app-text2'}`}>
                            {roleConfig[role].label}
                          </p>
                          <p className="text-xs text-app-subtle leading-tight mt-0.5">
                            {roleConfig[role].desc}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, ativo: !d.ativo }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${draft.ativo ? 'bg-emerald-500' : 'bg-app-surface3'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${draft.ativo ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm text-app-text2">{draft.ativo ? 'Usuário ativo' : 'Usuário inativo'}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!draft.nome}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                Salvar alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
