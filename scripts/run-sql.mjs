#!/usr/bin/env node
// Roda SQL direto no Postgres do Supabase pela Management API — o mesmo caminho
// que o SQL Editor do painel usa. Existe para que migrations não precisem ser
// coladas à mão no navegador.
//
//   node scripts/run-sql.mjs supabase/migrations/0036_xxx.sql
//   node scripts/run-sql.mjs -e "select count(*) from eventos"
//
// Precisa de SUPABASE_ACCESS_TOKEN (token pessoal, começa com sbp_) no .env.local.
// Crie em https://supabase.com/dashboard/account/tokens — e revogue por lá quando quiser.

import { readFileSync } from 'node:fs'

const ENV_PATH = new URL('../.env.local', import.meta.url)

function lerEnv() {
  const env = {}
  for (const linha of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const env = lerEnv()
const token = env.SUPABASE_ACCESS_TOKEN
if (!token) {
  console.error('Falta SUPABASE_ACCESS_TOKEN no .env.local (token pessoal sbp_… do Supabase).')
  process.exit(1)
}

// O project ref é o subdomínio da URL do projeto.
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]

const args = process.argv.slice(2)
const inline = args[0] === '-e'
if (args.length === 0 || (inline && !args[1])) {
  console.error('uso: node scripts/run-sql.mjs <arquivo.sql> | -e "<sql>"')
  process.exit(1)
}
const sql = inline ? args[1] : readFileSync(args[0], 'utf8')

const resp = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
})

const corpo = await resp.text()
if (!resp.ok) {
  console.error(`ERRO ${resp.status}: ${corpo}`)
  process.exit(1)
}
console.log(corpo)
