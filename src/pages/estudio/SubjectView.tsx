import { useRef, useState, type DragEvent, type FormEvent } from 'react';
import { ChevronLeft, FileText, Image, PenLine, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { save, useAll, type Doc, type Topic } from '../../lib/store';
import { byDate } from '../../lib/calendar';
import { addFiles, deleteSubject, deleteTopic, fileSize, nextStatus, STATUS, SUBJECT_COLORS } from '../../lib/study';
import { today } from '../../lib/dates';
import { EventRow } from '../Calendario';

export default function SubjectView({ subjectId }: { subjectId: string }) {
  const subjects = useAll('subject');
  const topics = useAll('topic');
  const docs = useAll('doc');
  const events = useAll('event');
  const [editing, setEditing] = useState(false);
  const [topicName, setTopicName] = useState('');

  const subject = subjects.find(s => s.id === subjectId);
  if (!subject) {
    return (
      <p className="card p-6 text-center text-sm text-zinc-500">
        Esta asignatura ya no existe. <a href="#/estudio" className="text-indigo-600 dark:text-indigo-400">Volver a Estudio</a>
      </p>
    );
  }

  const ts = topics.filter(t => t.subjectId === subjectId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const mine = docs.filter(d => d.subjectId === subjectId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  // Un documento cuyo tema se borró en otro dispositivo cae en "General".
  const docsOf = (topicId: string | null) =>
    mine.filter(d => (topicId ? d.topicId === topicId : !d.topicId || !ts.some(t => t.id === d.topicId)));
  const upcoming = events.filter(e => e.subjectId === subjectId && e.date >= today()).sort(byDate).slice(0, 3);

  const addTopic = (e: FormEvent) => {
    e.preventDefault();
    if (!topicName.trim()) return;
    save('topic', { subjectId, name: topicName.trim(), status: 'pendiente' });
    setTopicName('');
  };

  return (
    <>
      <header className="mb-5 flex items-center gap-2">
        <a href="#/estudio" className="icon-btn -ml-2 shrink-0" aria-label="Volver a asignaturas"><ChevronLeft className="size-5" /></a>
        {editing ? (
          <input
            className="input text-lg font-semibold"
            aria-label="Nombre de la asignatura"
            defaultValue={subject.name}
            onBlur={e => { const v = e.target.value.trim(); if (v && v !== subject.name) save('subject', { id: subject.id, name: v }); }}
          />
        ) : (
          <h1 className="flex min-w-0 flex-1 items-center gap-2 text-2xl font-semibold tracking-tight">
            <span className="size-3 shrink-0 rounded-full" style={{ background: subject.color }} />
            <span className="truncate">{subject.name}</span>
          </h1>
        )}
        <button className="btn btn-ghost shrink-0 px-2" onClick={() => setEditing(!editing)}>
          {editing ? 'Hecho' : <><Pencil className="size-3.5" /> Editar</>}
        </button>
      </header>

      {editing && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {SUBJECT_COLORS.map(c => (
            <button
              key={c}
              aria-label={`Color ${c}`}
              aria-pressed={subject.color === c}
              onClick={() => save('subject', { id: subject.id, color: c })}
              className={`size-7 cursor-pointer rounded-full ${subject.color === c ? 'ring-2 ring-zinc-900 ring-offset-2 dark:ring-white dark:ring-offset-zinc-950' : ''}`}
              style={{ background: c }}
            />
          ))}
          <button
            className="btn btn-ghost ml-auto text-red-500 dark:text-red-400"
            onClick={() => {
              if (!confirm(`¿Borrar «${subject.name}» con sus ${ts.length} temas y ${mine.length} documentos? Los eventos del calendario se conservan.`)) return;
              deleteSubject(subject.id, topics, docs);
              location.hash = '#/estudio';
            }}
          >
            <Trash2 className="size-4" /> Borrar asignatura
          </button>
        </div>
      )}

      {upcoming.length > 0 && (
        <ul className="mb-6 space-y-2">
          {upcoming.map(e => <EventRow key={e.id} event={e} subject={subject} showDate />)}
        </ul>
      )}

      <ul className="space-y-3">
        {ts.map(t => <TopicCard key={t.id} topic={t} subjectId={subjectId} docs={docsOf(t.id)} allDocs={docs} editing={editing} />)}
        <TopicCard topic={null} subjectId={subjectId} docs={docsOf(null)} allDocs={docs} editing={editing} />
      </ul>

      <form onSubmit={addTopic} className="mt-3 flex gap-2">
        <input className="input" aria-label="Nuevo tema" placeholder="Nuevo tema…" value={topicName} onChange={e => setTopicName(e.target.value)} />
        <button className="btn btn-primary shrink-0" disabled={!topicName.trim()}><Plus className="size-4" /> Tema</button>
      </form>
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">En el ordenador puedes arrastrar archivos encima de un tema.</p>
    </>
  );
}

function TopicCard({ topic, subjectId, docs, allDocs, editing }: {
  topic: Topic | null; subjectId: string; docs: Doc[]; allDocs: Doc[]; editing: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const topicId = topic?.id ?? null;

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      await addFiles(files, subjectId, topicId);
    } catch (e) {
      alert('No se pudo guardar el archivo: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const newNote = () => {
    const d = save('doc', { subjectId, topicId, kind: 'note', name: topic ? `Resumen de ${topic.name}` : 'Resumen', text: '' });
    location.hash = `#/estudio/${subjectId}/${d.id}`;
  };

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    upload([...e.dataTransfer.files]);
  };

  return (
    <li
      className={`card overflow-hidden transition-shadow ${over ? 'ring-2 ring-indigo-500' : ''}`}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={drop}
    >
      <div className="flex items-center gap-2 p-3">
        {!topic ? (
          <span className="flex-1 font-medium text-zinc-500 dark:text-zinc-400">General</span>
        ) : editing ? (
          <>
            <input
              className="input py-1.5"
              aria-label="Nombre del tema"
              defaultValue={topic.name}
              onBlur={e => { const v = e.target.value.trim(); if (v && v !== topic.name) save('topic', { id: topic.id, name: v }); }}
            />
            <button
              className="icon-btn shrink-0 hover:text-red-500"
              aria-label={`Borrar ${topic.name}`}
              onClick={() => { if (confirm(`¿Borrar el tema «${topic.name}»?${docs.length ? ' Sus documentos pasan a General.' : ''}`)) deleteTopic(topic, allDocs); }}
            >
              <Trash2 className="size-4" />
            </button>
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate font-medium">{topic.name}</span>
            <button
              title="Cambiar estado"
              onClick={() => save('topic', { id: topic.id, status: nextStatus(topic.status) })}
              className="shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ background: `${STATUS[topic.status].color}22`, color: STATUS[topic.status].color }}
            >
              {STATUS[topic.status].label}
            </button>
          </>
        )}
      </div>

      {docs.length > 0 && (
        <ul className="divide-y divide-zinc-200 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {docs.map(d => {
            const Icon = d.kind === 'note' ? PenLine : d.mime?.startsWith('image/') ? Image : FileText;
            return (
              <li key={d.id}>
                <a href={`#/estudio/${subjectId}/${d.id}`} className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <Icon className={`size-4 shrink-0 ${d.kind === 'note' ? 'text-amber-500' : d.mime === 'application/pdf' ? 'text-red-500' : 'text-zinc-400'}`} />
                  <span className="min-w-0 flex-1 truncate">{d.name}</span>
                  <span className="shrink-0 text-xs text-zinc-400 tabular-nums">{d.kind === 'note' ? 'Resumen' : fileSize(d.size ?? 0)}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-1 border-t border-zinc-200 px-2 py-1.5 dark:border-zinc-800">
        <button className="btn btn-ghost px-2 py-1 text-xs" disabled={busy} onClick={() => input.current?.click()}>
          <Upload className="size-3.5" /> {busy ? 'Guardando…' : 'Archivo'}
        </button>
        <button className="btn btn-ghost px-2 py-1 text-xs" onClick={newNote}><PenLine className="size-3.5" /> Resumen</button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept=".pdf,application/pdf,image/*,.txt,.md,.doc,.docx,.ppt,.pptx,.odt"
          onChange={e => { const files = [...(e.target.files ?? [])]; e.target.value = ''; upload(files); }}
        />
      </div>
    </li>
  );
}
