import { CalendarDays, CheckSquare, Link2, UserRound } from 'lucide-react'
import { dateKey } from './calendar'
import { PRIORITIES, taskOverdue, type KanbanColumn, type KanbanTask } from './kanban'

export function KanbanCardFace({task,column,assignees}:{task:KanbanTask;column:Pick<KanbanColumn, 'done'>;assignees:{uid:string;name:string}[]}) {
  const overdue=taskOverdue(task,column,dateKey(new Date()))
  return <div className="kb-card-face"><span className="kb-card-labels">{task.labels.map((label,i)=><span key={i}>{label}</span>)}</span><strong>{task.title}</strong>{task.description && <p>{task.description}</p>}<span className="kb-card-meta">{task.assigneeId && <span className="kb-assignee"><UserRound size={13}/>{assignees.find(p=>p.uid===task.assigneeId)?.name || 'Participante indisponível'}</span>}{task.priority!=='none' && <span className={`kb-priority kb-priority-${task.priority}`}>{PRIORITIES[task.priority]}</span>}{task.dueDate && <span className={overdue ? 'kb-overdue' : ''}><CalendarDays size={13}/>{new Date(task.dueDate+'T12:00:00').toLocaleDateString('pt-BR')}{overdue ? ' · atrasada' : ''}</span>}{Boolean(task.activityIds?.length) && <span><Link2 size={13}/>{task.activityIds!.length} {task.activityIds!.length===1 ? 'atividade vinculada' : 'atividades vinculadas'}</span>}{task.checklist.length>0 && <span><CheckSquare size={13}/>{task.checklist.filter(i=>i.done).length}/{task.checklist.length}</span>}</span></div>
}
