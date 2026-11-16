import { remove, save, type Doc, type Topic, type TopicStatus } from './store';
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

export async function addFiles(files: File[], subjectId: string, topicId: string | null) {
  for (const f of files) {
    const fileId = await putFile(f);
    save('doc', {
      subjectId, topicId, kind: 'file', fileId, fileName: f.name,
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

/** Borra la asignatura con sus temas y documentos. Los eventos del calendario se quedan, sin asignatura. */
export function deleteSubject(id: string, topics: Topic[], docs: Doc[]) {
  docs.filter(d => d.subjectId === id).forEach(deleteDoc);
  remove('topic', ...topics.filter(t => t.subjectId === id).map(t => t.id));
  remove('subject', id);
}
