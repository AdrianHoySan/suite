import { useEffect, useState, type FormEvent } from 'react';
import { FileText, PenLine, Plus, Search } from 'lucide-react';
import { useAll, type Doc, type Practice, type Subject, type Topic } from '../../lib/store';
import { useSyncStatus } from '../../lib/sync';
import { cleanupFiles, usePendingUploads } from '../../lib/files';
import { byDate, countdown, daysUntil, practiceEvents, subjectByName, TYPES } from '../../lib/calendar';
import { norm, STATUS, STATUS_ORDER } from '../../lib/study';
import { today } from '../../lib/dates';
import SubjectView from './SubjectView';
import DocView from './DocView';

/** Rutas: #/estudio · #/estudio/<asignatura> · #/estudio/<asignatura>/<documento> */
export default function Estudio({ path }: { path: string[] }) {
  const [subjectId, docId] = path;
  if (subjectId && docId) return <DocView key={docId} docId={docId} />;
  if (subjectId) return <SubjectView key={subjectId} subjectId={subjectId} />;
  return <Home />;
}

function Home() {
  const subjects = useAll('subject');
  const topics = useAll('topic');
  const docs = useAll('doc');
  const practices = useAll('practice');
  const events = useAll('event');
  const sync = useSyncStatus();
  const uploading = Object.values(usePendingUploads()).filter(op => op === 'up').length;
  const [q, setQ] = useState('');
  const [name, setName] = useState('');

  // Una vez por visita: limpiar archivos locales de documentos borrados en otro dispositivo.
  useEffect(() => { cleanupFiles(docs).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const now = today();
  const sorted = [...subjects].sort((a, b) => a.name.localeCompare(b.name));
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    subjectByName(subjects, name);
    setName('');
  };

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Estudio</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {subjects.length ? `${subjects.length} ${subjects.length === 1 ? 'asignatura' : 'asignaturas'}` : 'Empieza creando una asignatura'}
        </p>
      </header>

      <label className="relative mb-5 block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
        <input className="input pl-9" type="search" aria-label="Buscar" placeholder="Buscar en temas, archivos y resúmenes…" value={q} onChange={e => setQ(e.target.value)} />
      </label>

      {q.trim() ? <Results q={q} subjects={subjects} topics={topics} practices={practices} docs={docs} /> : (
        <>
          <ul className="grid gap-2 sm:grid-cols-2">
            {sorted.map(s => {
              const ts = topics.filter(t => t.subjectId === s.id);
              const count = (st: string) => ts.filter(t => t.status === st).length;
              const files = docs.filter(d => d.subjectId === s.id).length;
              const pendingPractices = practices.filter(p => p.subjectId === s.id && !p.done).length;
              const exam = [...events, ...practiceEvents(practices)]
                .filter(e => e.subjectId === s.id && e.date >= now && e.type !== 'evento').sort(byDate)[0];
              return (
                <li key={s.id}>
                  <a href={`#/estudio/${s.id}`} className="card block p-4 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                      <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                      {exam && (
                        <span className={`shrink-0 text-xs font-semibold ${daysUntil(exam.date) <= 7 ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-400'}`}>
                          {exam.practiceId ? 'Práctica' : TYPES[exam.type].label} {countdown(exam.date).toLowerCase()}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                      {ts.length > 0 && [...STATUS_ORDER].reverse().slice(0, 3).map(st => (
                        <span key={st} style={{ width: `${(count(st) / ts.length) * 100}%`, background: STATUS[st].color }} />
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {ts.length} {ts.length === 1 ? 'tema' : 'temas'} · {count('repasado')} repasados · {files} {files === 1 ? 'documento' : 'documentos'}
                      {pendingPractices > 0 && ` · ${pendingPractices} ${pendingPractices === 1 ? 'práctica pendiente' : 'prácticas pendientes'}`}
                    </p>
                  </a>
                </li>
              );
            })}
          </ul>

          <form onSubmit={add} className="mt-3 flex gap-2">
            <input className="input" aria-label="Nueva asignatura" placeholder="Nueva asignatura…" value={name} onChange={e => setName(e.target.value)} />
            <button className="btn btn-primary shrink-0" disabled={!name.trim()}><Plus className="size-4" /> Añadir</button>
          </form>
        </>
      )}

      <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
        {sync.state === 'off'
          ? 'Los archivos solo están en este dispositivo hasta que conectes la sincronización en Ajustes.'
          : uploading ? `Subiendo ${uploading} ${uploading === 1 ? 'archivo' : 'archivos'}…` : ''}
      </p>
    </>
  );
}

function Results({ q, subjects, topics, practices, docs }: { q: string; subjects: Subject[]; topics: Topic[]; practices: Practice[]; docs: Doc[] }) {
  const n = norm(q.trim());
  const subjectName = (id: string) => subjects.find(s => s.id === id)?.name ?? '';
  const hits: { key: string; href: string; title: string; sub: string; snippet?: string; note?: boolean }[] = [];

  for (const s of subjects) if (norm(s.name).includes(n)) hits.push({ key: s.id, href: `#/estudio/${s.id}`, title: s.name, sub: 'Asignatura' });
  for (const t of topics) if (norm(t.name).includes(n)) hits.push({ key: t.id, href: `#/estudio/${t.subjectId}`, title: t.name, sub: `Tema · ${subjectName(t.subjectId)}` });
  for (const p of practices) if (norm(p.name).includes(n)) hits.push({ key: p.id, href: `#/estudio/${p.subjectId}`, title: p.name, sub: `Práctica${p.done ? ' finalizada' : ''} · ${subjectName(p.subjectId)}` });
  for (const d of docs) {
    const inName = norm(d.name).includes(n);
    const at = d.text ? norm(d.text).indexOf(n) : -1;
    if (!inName && at < 0) continue;
    const snippet = at >= 0 && d.text
      ? `${at > 40 ? '…' : ''}${d.text.slice(Math.max(0, at - 40), at + n.length + 60).replace(/\s+/g, ' ')}…`
      : undefined;
    hits.push({ key: d.id, href: `#/estudio/${d.subjectId}/${d.id}`, title: d.name, sub: `${d.kind === 'note' ? 'Resumen' : 'Archivo'} · ${subjectName(d.subjectId)}`, snippet, note: d.kind === 'note' });
  }

  if (!hits.length) return <p className="card p-6 text-center text-sm text-zinc-500">Sin resultados. Se busca en los nombres y en el texto de los resúmenes.</p>;

  return (
    <ul className="space-y-2">
      {hits.map(h => (
        <li key={h.key}>
          <a href={h.href} className="card flex gap-3 p-3">
            {h.note ? <PenLine className="mt-0.5 size-4 shrink-0 text-amber-500" /> : <FileText className="mt-0.5 size-4 shrink-0 text-zinc-400" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{h.title}</span>
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">{h.sub}</span>
              {h.snippet && <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-300">{h.snippet}</span>}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
