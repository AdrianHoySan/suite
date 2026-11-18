import { useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { Check, ChevronLeft, FileText, Image, PenLine, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { save, useAll, type Doc, type Practice, type Topic } from '../../lib/store';
import { byDate, countdown, daysUntil } from '../../lib/calendar';
import {
  addFiles, byDue, deletePractice, deleteSubject, deleteTopic, fileSize, nextStatus, STATUS, SUBJECT_COLORS, type DocTarget,
} from '../../lib/study';
import { shortDate, today } from '../../lib/dates';
import { EventRow } from '../Calendario';

export default function SubjectView({ subjectId }: { subjectId: string }) {
  const subjects = useAll('subject');
  const topics = useAll('topic');
  const practices = useAll('practice');
  const docs = useAll('doc');
  const events = useAll('event');
  const [tab, setTab] = useState<'temas' | 'practicas'>('temas');
  const [editing, setEditing] = useState(false);

  const subject = subjects.find(s => s.id === subjectId);
  if (!subject) {
    return (
      <p className="card p-6 text-center text-sm text-zinc-500">
        Esta asignatura ya no existe. <a href="#/estudio" className="text-indigo-600 dark:text-indigo-400">Volver a Estudio</a>
      </p>
    );
  }

  const ts = topics.filter(t => t.subjectId === subjectId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const ps = practices.filter(p => p.subjectId === subjectId).sort(byDue);
  const mine = docs.filter(d => d.subjectId === subjectId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  // Un documento cuyo tema o práctica se borró en otro dispositivo cae en "General".
  const inPractice = (d: Doc) => !!d.practiceId && ps.some(p => p.id === d.practiceId);
  const docsOfTopic = (topicId: string | null) => mine.filter(d => !inPractice(d)
    && (topicId ? d.topicId === topicId : !d.topicId || !ts.some(t => t.id === d.topicId)));
  const docsOfPractice = (practiceId: string) => mine.filter(d => d.practiceId === practiceId);
  const upcoming = events.filter(e => e.subjectId === subjectId && e.date >= today()).sort(byDate).slice(0, 3);
  const pending = ps.filter(p => !p.done).length;

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
              if (!confirm(`¿Borrar «${subject.name}» con sus ${ts.length} temas, ${ps.length} prácticas y ${mine.length} documentos? Los eventos del calendario se conservan.`)) return;
              deleteSubject(subject.id, topics, practices, docs);
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

      <div className="mb-4 flex gap-1 rounded-xl bg-zinc-200/70 p-1 dark:bg-zinc-800" role="tablist">
        {([['temas', `Temas · ${ts.length}`], ['practicas', `Prácticas${pending ? ` · ${pending} pendiente${pending === 1 ? '' : 's'}` : ps.length ? ' · al día' : ''}`]] as const).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 cursor-pointer rounded-lg py-1.5 text-sm font-medium transition-colors ${tab === id ? 'bg-white shadow-sm dark:bg-zinc-950' : 'text-zinc-500 dark:text-zinc-400'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'temas' ? (
        <>
          <ul className="space-y-3">
            {ts.map(t => (
              <DocGroup key={t.id} subjectId={subjectId} target={{ topicId: t.id, practiceId: null }} docs={docsOfTopic(t.id)} noteName={`Resumen de ${t.name}`}>
                <TopicHeader topic={t} editing={editing} docs={docsOfTopic(t.id)} allDocs={docs} />
              </DocGroup>
            ))}
            <DocGroup subjectId={subjectId} target={{ topicId: null, practiceId: null }} docs={docsOfTopic(null)} noteName="Resumen">
              <span className="flex-1 font-medium text-zinc-500 dark:text-zinc-400">General</span>
            </DocGroup>
          </ul>
          <NewTopic subjectId={subjectId} />
        </>
      ) : (
        <>
          {ps.length === 0 && (
            <p className="card mb-3 p-6 text-center text-sm text-zinc-500">
              Sin prácticas. Crea una y guarda dentro el enunciado y el material que necesitas para hacerla.
            </p>
          )}
          <ul className="space-y-3">
            {ps.map(p => (
              <DocGroup
                key={p.id}
                subjectId={subjectId}
                target={{ topicId: null, practiceId: p.id }}
                docs={docsOfPractice(p.id)}
                noteName={`Notas de ${p.name}`}
                dim={p.done && !editing}
              >
                <PracticeHeader practice={p} editing={editing} docs={docsOfPractice(p.id)} allDocs={docs} />
              </DocGroup>
            ))}
          </ul>
          <NewPractice subjectId={subjectId} />
        </>
      )}
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">En el ordenador puedes arrastrar archivos encima de un tema o una práctica.</p>
    </>
  );
}

function NewTopic({ subjectId }: { subjectId: string }) {
  const [name, setName] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    save('topic', { subjectId, name: name.trim(), status: 'pendiente' });
    setName('');
  };
  return (
    <form onSubmit={submit} className="mt-3 flex gap-2">
      <input className="input" aria-label="Nuevo tema" placeholder="Nuevo tema…" value={name} onChange={e => setName(e.target.value)} />
      <button className="btn btn-primary shrink-0" disabled={!name.trim()}><Plus className="size-4" /> Tema</button>
    </form>
  );
}

function NewPractice({ subjectId }: { subjectId: string }) {
  const [name, setName] = useState('');
  const [due, setDue] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    save('practice', { subjectId, name: name.trim(), dueDate: due || null, done: false, doneAt: null });
    setName('');
    setDue('');
  };
  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2">
      <input className="input min-w-40 flex-1" aria-label="Nueva práctica" placeholder="Nueva práctica…" value={name} onChange={e => setName(e.target.value)} />
      <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        Entrega
        <input className="input w-auto" type="date" aria-label="Fecha de entrega (opcional)" value={due} onChange={e => setDue(e.target.value)} />
      </label>
      <button className="btn btn-primary shrink-0" disabled={!name.trim()}><Plus className="size-4" /> Práctica</button>
    </form>
  );
}

function TopicHeader({ topic, editing, docs, allDocs }: { topic: Topic; editing: boolean; docs: Doc[]; allDocs: Doc[] }) {
  if (editing) {
    return (
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
    );
  }
  return (
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
  );
}

function PracticeHeader({ practice: p, editing, docs, allDocs }: { practice: Practice; editing: boolean; docs: Doc[]; allDocs: Doc[] }) {
  if (editing) {
    return (
      <>
        <input
          className="input min-w-0 py-1.5"
          aria-label="Nombre de la práctica"
          defaultValue={p.name}
          onBlur={e => { const v = e.target.value.trim(); if (v && v !== p.name) save('practice', { id: p.id, name: v }); }}
        />
        <input
          className="input w-auto shrink-0 py-1.5"
          type="date"
          aria-label="Fecha de entrega"
          value={p.dueDate ?? ''}
          onChange={e => save('practice', { id: p.id, dueDate: e.target.value || null })}
        />
        <button
          className="icon-btn shrink-0 hover:text-red-500"
          aria-label={`Borrar ${p.name}`}
          onClick={() => { if (confirm(`¿Borrar la práctica «${p.name}»?${docs.length ? ' Su material pasa a General, en Temas.' : ''}`)) deletePractice(p, allDocs); }}
        >
          <Trash2 className="size-4" />
        </button>
      </>
    );
  }

  const late = !p.done && p.dueDate && daysUntil(p.dueDate) <= 3;
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-medium ${p.done ? 'text-zinc-500 line-through dark:text-zinc-400' : ''}`}>{p.name}</span>
        <span className={`block text-xs ${late ? 'font-medium text-red-500' : 'text-zinc-500 dark:text-zinc-400'}`}>
          {p.done
            ? `Finalizada${p.doneAt ? ` el ${shortDate(p.doneAt)}` : ''}`
            : p.dueDate ? `Entrega ${shortDate(p.dueDate)} · ${countdown(p.dueDate).toLowerCase()}` : 'Sin fecha de entrega'}
        </span>
      </span>
      <button
        aria-pressed={p.done}
        onClick={() => save('practice', { id: p.id, done: !p.done, doneAt: p.done ? null : today() })}
        className={`btn shrink-0 px-3 py-1.5 text-xs ${p.done ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}
      >
        <Check className="size-3.5" strokeWidth={3} /> {p.done ? 'Finalizada' : 'Finalizar'}
      </button>
    </>
  );
}

/** Tarjeta con una cabecera (tema, práctica o "General") y sus documentos, para añadir archivos o notas. */
function DocGroup({ subjectId, target, docs, noteName, dim = false, children }: {
  subjectId: string; target: DocTarget; docs: Doc[]; noteName: string; dim?: boolean; children: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      await addFiles(files, subjectId, target);
    } catch (e) {
      alert('No se pudo guardar el archivo: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const newNote = () => {
    const d = save('doc', { subjectId, ...target, kind: 'note', name: noteName, text: '' });
    location.hash = `#/estudio/${subjectId}/${d.id}`;
  };

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    upload([...e.dataTransfer.files]);
  };

  return (
    <li
      className={`card overflow-hidden transition-shadow ${over ? 'ring-2 ring-indigo-500' : ''} ${dim ? 'opacity-70' : ''}`}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={drop}
    >
      <div className="flex items-center gap-2 p-3">{children}</div>

      {docs.length > 0 && (
        <ul className="divide-y divide-zinc-200 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {docs.map(d => {
            const Icon = d.kind === 'note' ? PenLine : d.mime?.startsWith('image/') ? Image : FileText;
            return (
              <li key={d.id}>
                <a href={`#/estudio/${subjectId}/${d.id}`} className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <Icon className={`size-4 shrink-0 ${d.kind === 'note' ? 'text-amber-500' : d.mime === 'application/pdf' ? 'text-red-500' : 'text-zinc-400'}`} />
                  <span className="min-w-0 flex-1 truncate">{d.name}</span>
                  <span className="shrink-0 text-xs text-zinc-400 tabular-nums">{d.kind === 'note' ? 'Nota' : fileSize(d.size ?? 0)}</span>
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
        <button className="btn btn-ghost px-2 py-1 text-xs" onClick={newNote}>
          <PenLine className="size-3.5" /> {target.practiceId ? 'Nota' : 'Resumen'}
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept=".pdf,application/pdf,image/*,.txt,.md,.doc,.docx,.ppt,.pptx,.odt,.xls,.xlsx,.zip"
          onChange={e => { const files = [...(e.target.files ?? [])]; e.target.value = ''; upload(files); }}
        />
      </div>
    </li>
  );
}
