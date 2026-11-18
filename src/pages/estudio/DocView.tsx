import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, Download, ExternalLink, FileText, Trash2 } from 'lucide-react';
import { save, useAll, type Doc, type Topic } from '../../lib/store';
import { getFile } from '../../lib/files';
import { byDue, deleteDoc, fileSize } from '../../lib/study';

export default function DocView({ docId }: { docId: string }) {
  const docs = useAll('doc');
  const topics = useAll('topic');
  const doc = docs.find(d => d.id === docId);
  if (!doc) {
    return (
      <p className="card p-6 text-center text-sm text-zinc-500">
        Este documento ya no existe. <a href="#/estudio" className="text-indigo-600 dark:text-indigo-400">Volver a Estudio</a>
      </p>
    );
  }
  return doc.kind === 'note' ? <NoteView doc={doc} topics={topics} /> : <FileView doc={doc} topics={topics} />;
}

function DocHeader({ doc, topics, children }: { doc: Doc; topics: Topic[]; children?: ReactNode }) {
  const ts = topics.filter(t => t.subjectId === doc.subjectId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const ps = useAll('practice').filter(p => p.subjectId === doc.subjectId).sort(byDue);
  return (
    <header className="mb-4">
      <div className="flex items-center gap-2">
        <a href={`#/estudio/${doc.subjectId}`} className="icon-btn -ml-2 shrink-0" aria-label="Volver a la asignatura"><ChevronLeft className="size-5" /></a>
        <input
          key={doc.name}
          className="-mx-1 min-w-0 flex-1 rounded-lg bg-transparent px-1 text-xl font-semibold tracking-tight outline-none focus:ring-2 focus:ring-indigo-500/30"
          aria-label="Nombre"
          defaultValue={doc.name}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          onBlur={e => { const v = e.target.value.trim(); if (v && v !== doc.name) save('doc', { id: doc.id, name: v }); else e.target.value = doc.name; }}
        />
        <button
          className="icon-btn shrink-0 hover:text-red-500"
          aria-label="Borrar"
          onClick={() => {
            if (!confirm(`¿Borrar «${doc.name}»?`)) return;
            deleteDoc(doc);
            location.hash = `#/estudio/${doc.subjectId}`;
          }}
        >
          <Trash2 className="size-4.5" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          className="input w-auto max-w-full py-1.5 text-sm"
          aria-label="Tema o práctica"
          value={doc.practiceId && ps.some(p => p.id === doc.practiceId) ? `p:${doc.practiceId}` : doc.topicId ? `t:${doc.topicId}` : ''}
          onChange={e => {
            const [kind, id] = [e.target.value.slice(0, 2), e.target.value.slice(2)];
            save('doc', { id: doc.id, topicId: kind === 't:' ? id : null, practiceId: kind === 'p:' ? id : null });
          }}
        >
          <option value="">General</option>
          {ts.length > 0 && <optgroup label="Temas">{ts.map(t => <option key={t.id} value={`t:${t.id}`}>{t.name}</option>)}</optgroup>}
          {ps.length > 0 && <optgroup label="Prácticas">{ps.map(p => <option key={p.id} value={`p:${p.id}`}>{p.name}</option>)}</optgroup>}
        </select>
        {children}
      </div>
    </header>
  );
}

function FileView({ doc, topics }: { doc: Doc; topics: Topic[] }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    getFile(doc)
      .then(blob => {
        if (!alive) return;
        if (!blob) { setError('El archivo no está en este dispositivo. Conecta la sincronización en Ajustes para traerlo.'); return; }
        made = URL.createObjectURL(blob);
        setUrl(made);
      })
      .catch(e => { if (alive) setError((e as Error).message); });
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [doc.fileId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPdf = doc.mime === 'application/pdf';
  const isImage = doc.mime?.startsWith('image/');

  return (
    <>
      <DocHeader doc={doc} topics={topics}>
        <span className="text-xs text-zinc-400 tabular-nums">{fileSize(doc.size ?? 0)}</span>
        {url && (
          <>
            <a className="btn btn-ghost px-2 py-1 text-xs" href={url} target="_blank" rel="noopener"><ExternalLink className="size-3.5" /> Abrir</a>
            <a className="btn btn-ghost px-2 py-1 text-xs" href={url} download={doc.fileName ?? doc.name}><Download className="size-3.5" /> Descargar</a>
          </>
        )}
      </DocHeader>

      {error ? <p className="card p-6 text-center text-sm text-red-500">{error}</p>
        : !url ? <p className="card p-6 text-center text-sm text-zinc-500">Cargando…</p>
        : isPdf ? (
          <>
            {/* Los móviles no muestran PDFs dentro de la página: allí se abre en su visor. */}
            <iframe src={url} title={doc.name} className="hidden h-[calc(100dvh-11rem)] w-full rounded-2xl border border-zinc-200 bg-white md:block dark:border-zinc-800" />
            <a href={url} target="_blank" rel="noopener" className="card flex flex-col items-center gap-2 p-8 text-center md:hidden">
              <FileText className="size-10 text-red-500" />
              <span className="font-medium">Abrir PDF</span>
              <span className="text-xs text-zinc-500">Se abre en el visor del móvil</span>
            </a>
          </>
        )
        : isImage ? <img src={url} alt={doc.name} className="w-full rounded-2xl" />
        : <p className="card p-6 text-center text-sm text-zinc-500">Este tipo de archivo no se puede ver aquí. Usa «Abrir» o «Descargar».</p>}
    </>
  );
}

function NoteView({ doc, topics }: { doc: Doc; topics: Topic[] }) {
  const [text, setText] = useState(doc.text ?? '');
  const [saved, setSaved] = useState(true);
  const latest = useRef(text);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Se guarda al dejar de escribir un momento, al salir del campo y al cerrar la vista.
  const flush = () => {
    clearTimeout(timer.current);
    if (dirty.current) { save('doc', { id: doc.id, text: latest.current }); dirty.current = false; }
    setSaved(true);
  };
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Si llega un cambio de otro dispositivo y aquí no se está escribiendo, mostrarlo.
  useEffect(() => {
    if (!dirty.current && doc.text !== undefined && doc.text !== latest.current) {
      latest.current = doc.text;
      setText(doc.text);
    }
  }, [doc.text]);

  const change = (v: string) => {
    setText(v);
    latest.current = v;
    dirty.current = true;
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  };

  return (
    <>
      <DocHeader doc={doc} topics={topics}>
        <span className="text-xs text-zinc-400">{saved ? 'Guardado' : 'Guardando…'}</span>
      </DocHeader>
      <textarea
        className="input min-h-[calc(100dvh-14rem)] resize-y leading-relaxed"
        aria-label="Resumen"
        placeholder="Escribe tu resumen…"
        value={text}
        onChange={e => change(e.target.value)}
        onBlur={flush}
        autoFocus={!doc.text}
      />
    </>
  );
}
