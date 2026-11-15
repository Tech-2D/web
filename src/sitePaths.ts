const base = import.meta.env.BASE_URL

export const sitePaths = {
  agenda: base,
  kanban: `${base}#kanban`,
  profile: `${base}perfil/`,
  signature: `${base}assinatura/`,
  admin: `${base}admin/`,
  professores: `${base}professores/`,
  pegaki: `${base}notas/`,
}
