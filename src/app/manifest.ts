import type { MetadataRoute } from 'next'

// Ícone/nome usados ao "Adicionar à Tela de Início" (Android/Chrome). No
// iPhone o ícone vem de app/apple-icon.png e o nome de metadata.appleWebApp.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Espaços & Locações',
    short_name: 'Espaços',
    description: 'Painel Administrativo',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#FAF7F2',
    theme_color: '#072A43',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
