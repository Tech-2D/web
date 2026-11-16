// Endereço do Worker tech-2d-agenda-sql, que atende todos os dados do portal.
// VITE_API_URL só é necessário para apontar a outro ambiente ou para o proxy
// de desenvolvimento do Vite (ex.: /tech2d-api). Ver README, "Rodar localmente".
const PRODUCTION_API = 'https://tech-2d-agenda-sql.tech-2d-auth-email.workers.dev'

export const API_BASE = (import.meta.env.VITE_API_URL?.trim() || PRODUCTION_API).replace(/\/$/, '')

// Aceita API_BASE absoluto ou relativo à página (proxy de desenvolvimento).
export function apiUrl(path: string): URL {
  return new URL(API_BASE + path, globalThis.location?.origin)
}
