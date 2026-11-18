import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.PAGES_BASE_PATH ? `${process.env.PAGES_BASE_PATH.replace(/\/$/, '')}/` : '/',
  build: {
    rollupOptions: { input: { agenda: 'index.html', profile: 'perfil/index.html', admin: 'admin/index.html', professores: 'professores/index.html', notas: 'notas/index.html', signature: 'assinatura/index.html' } },
  },
  server: {
    // Desenvolvimento local: com VITE_API_URL=/tech2d-api no .env.local, o Vite
    // repassa as chamadas ao Worker de produção sem o bloqueio de CORS.
    // Leituras funcionam; gravações continuam exigindo a origem do site publicado.
    proxy: {
      '/tech2d-api': {
        target: 'https://tech-2d-agenda-sql.tech-2d-auth-email.workers.dev',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/tech2d-api/, ''),
      },
      '/tech2d-qa-api': {
        target: 'https://tech-2d-agenda-qa.tech-2d-auth-email.workers.dev',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/tech2d-qa-api/, ''),
        configure: proxy => proxy.on('proxyReq', request => request.setHeader('Origin', 'https://tech-2d.github.io')),
      },
    },
  },
  test: {
    // Os testes sempre usam a URL de produção de src/apiBase.ts, mesmo que o
    // .env.local de alguém aponte para o proxy de desenvolvimento.
    env: { VITE_API_URL: '' },
  },
})
