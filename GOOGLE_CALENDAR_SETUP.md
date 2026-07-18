# Google Calendar — Configuração

Este guia explica como configurar a integração do dashboard com o Google Calendar.

## Pré-requisitos

- Conta Google com acesso ao [Google Cloud Console](https://console.cloud.google.com/)

## Passo a passo

### 1. Criar projeto no Google Cloud Console

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/)
2. Clique em **Selecionar projeto** → **Novo projeto**
3. Dê um nome (ex: `Espacos Locacoes`) e clique em **Criar**

### 2. Ativar a Google Calendar API

1. No menu lateral, vá em **APIs e Serviços** → **Biblioteca**
2. Pesquise por **Google Calendar API**
3. Clique em **Ativar**

### 3. Criar credenciais OAuth 2.0

1. Vá em **APIs e Serviços** → **Credenciais**
2. Clique em **+ Criar credenciais** → **ID do cliente OAuth**
3. Se solicitado, configure a **tela de consentimento OAuth**:
   - Tipo de usuário: **Externo**
   - Preencha nome do app e e-mail de suporte
   - Adicione o escopo: `https://www.googleapis.com/auth/calendar`
4. De volta em Credenciais, escolha tipo: **Aplicativo da Web**
5. Em **Origens JavaScript autorizadas**, adicione:
   ```
   http://localhost:3000
   http://localhost:3001
   ```
6. Clique em **Criar**
7. Copie o **ID do cliente** (formato: `xxxxxx.apps.googleusercontent.com`)

### 4. Configurar o .env.local

No arquivo `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=seu-client-id-aqui.apps.googleusercontent.com
```

### 5. Reiniciar o servidor

```bash
npm run dev
```

O botão "Conectar com Google Calendar" na Agenda ficará ativo.

## Como funciona

- A autenticação usa **Google Identity Services (GIS)** — fluxo client-side, sem armazenar tokens no servidor
- O token de acesso expira em 1 hora; basta clicar em "Conectar" novamente
- Eventos criados no dashboard são sincronizados com o calendário primário da conta Google conectada

## Observações

- Em produção, adicione também o domínio real nas origens autorizadas
- O escopo `calendar` permite leitura e escrita — se quiser apenas leitura, use `calendar.readonly`
