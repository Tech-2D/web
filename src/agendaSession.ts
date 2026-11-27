import type { ClosureScreen } from './agendaClosure'
import type { ClassCatalog } from './classLink'
import type { AdminProfile } from './types'

export type AgendaSession = {
  profile: AdminProfile | null
  classLink: ClassCatalog
  screen: ClosureScreen | null
}
