const saoPaulo = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

export function canCreateActivityCard(activity: { date: string; time?: string | null }, now = new Date()): boolean {
  const parts = Object.fromEntries(saoPaulo.formatToParts(now).map(part => [part.type, part.value]))
  const today = `${parts.year}-${parts.month}-${parts.day}`
  if (!/^\d{4}-\d{2}-\d{2}$/.test(activity.date) || activity.date < today) return false
  if (activity.date > today) return true
  return !activity.time || /^\d{2}:\d{2}$/.test(activity.time) && activity.time > `${parts.hour}:${parts.minute}`
}
