import { deleteActivityWithAttachments } from './attachments'
import { collection, deleteDoc, doc, getDocs, query, updateDoc, where, writeBatch } from './dataClient'
import { db } from './firebase'
import type { RecurringActivity } from './types'

export async function deleteRecurrence(item: RecurringActivity) {
  const template = doc(db, 'recurringActivities', item.id)
  // Pause first; a failed cleanup remains visible and can safely be retried.
  await updateDoc(template, { active: false })
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const snapshot = await getDocs(query(collection(db, 'activities'), where('turmaId', '==', item.turmaId), where('recurringId', '==', item.id)))
  const future = snapshot.docs.filter(row => row.data().date >= today)
  const withoutAttachments = []
  for (const row of future) {
    if (row.data().attachments?.length) await deleteActivityWithAttachments(row.id)
    else withoutAttachments.push(row)
  }
  for (let offset = 0; offset < withoutAttachments.length; offset += 200) {
    const batch = writeBatch(db)
    for (const row of withoutAttachments.slice(offset, offset + 200)) batch.delete(row.ref)
    await batch.commit()
  }
  await deleteDoc(template)
}
