'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { checkDemoLogin } from '@/lib/auth'

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    await new Promise((r) => setTimeout(r, 600))

    if (checkDemoLogin(email, password)) {
      document.cookie = 'auth=demo; path=/; max-age=86400'
      router.push('/dashboard')
    } else {
      setError('E-mail ou senha incorretos.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 border border-violet-500/25 mb-4">
            <Building2 className="h-7 w-7 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-app-text">Espaços & Locações</h1>
          <p className="text-sm text-app-muted mt-1">Painel Administrativo</p>
        </div>

        <div className="rounded-2xl border border-app-border bg-app-surface p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-app-text2 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-app-subtle" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@espacoslocacoes.com.br"
                  required
                  className="w-full rounded-lg border border-app-border2 bg-app-surface2 py-2.5 pl-10 pr-4 text-sm text-app-text placeholder-app-subtle focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-app-text2 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-app-subtle" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-lg border border-app-border2 bg-app-surface2 py-2.5 pl-10 pr-10 text-sm text-app-text placeholder-app-subtle focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-app-subtle hover:text-app-text2 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-app-subtle">
            Demo: admin@espacoslocacoes.com.br / admin123
          </p>
        </div>
      </div>
    </div>
  )
}
