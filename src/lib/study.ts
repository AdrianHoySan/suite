import { remove, save, type Doc, type Practice, type Topic, type TopicStatus } from './store';
import { deleteFile, putFile } from './files';

export const STATUS: Record<TopicStatus, { label: string; color: string }> = {
  pendiente: { label: 'Sin empezar', color: '#a1a1aa' },
  leido: { label: 'Leído', color: '#38bdf8' },
  resumido: { label: 'Resumido', color: '#f59e0b' },
  repasado: { label: 'Repasado', color: '#10b981' },
};
export const STATUS_ORDER: TopicStatus[] = ['pendiente', 'leido', 'resumido', 'repasado'];
export const nextStatus = (s: TopicStatus) => STATUS_ORDER[(STATUS_ORDER.indexOf(s) + 1) % STATUS_ORDER.length];

export const SUBJECT_COLORS = ['#6366f1', '#10b981', '#f43f5e', '#0ea5e9', '#f59e0b', '#8b5cf6', '#14b8a6', '#ec4899'];

export const fileSize = (n: number) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1).replace('.', ',')} MB`;

/** Para buscar sin que importen mayúsculas ni tildes. */
export const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Dónde va un documento: un tema, una práctica o ninguno de los dos ("General"). */
export interface DocTarget { topicId: string | null; practiceId: string | null }

export async function addFiles(files: File[], subjectId: string, target: DocTarget) {
  for (const f of files) {
    const fileId = await putFile(f);
    save('doc', {
      subjectId, ...target, kind: 'file', fileId, fileName: f.name,
      name: f.name.replace(/\.[^.]+$/, ''), size: f.size, mime: f.type || 'application/octet-stream',
    });
  }
}

export function deleteDoc(doc: Doc) {
  if (doc.fileId) deleteFile(doc.fileId);
  remove('doc', doc.id);
}

/** Borra el tema; sus archivos y resúmenes pasan a "General" en vez de perderse. */
export function deleteTopic(topic: Topic, docs: Doc[]) {
  for (const d of docs) if (d.topicId === topic.id) save('doc', { id: d.id, topicId: null });
  remove('topic', topic.id);
}

/** Borra la práctica; su material pasa a "General" en vez de perderse. */
export function deletePractice(practice: Practice, docs: Doc[]) {
  for (const d of docs) if (d.practiceId === practice.id) save('doc', { id: d.id, practiceId: null });
  remove('practice', practice.id);
}

/** Pendientes primero, por fecha de entrega (las que no tienen, al final); luego las finalizadas. */
export const byDue = (a: Practice, b: Practice) =>
  Number(a.done) - Number(b.done)
  || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
  || a.createdAt.localeCompare(b.createdAt);

/** Borra la asignatura con sus temas, prácticas y documentos. Los eventos del calendario se quedan, sin asignatura. */
export function deleteSubject(id: string, topics: Topic[], practices: Practice[], docs: Doc[]) {
  docs.filter(d => d.subjectId === id).forEach(deleteDoc);
  remove('topic', ...topics.filter(t => t.subjectId === id).map(t => t.id));
  remove('practice', ...practices.filter(p => p.subjectId === id).map(p => p.id));
  remove('subject', id);
}
