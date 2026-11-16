import { useMemo, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { remove, save, useAll, type CalEvent, type Subject } from '../lib/store';
import { addDays, longDate, parse, shortDate, today, weekdayIndex, ymd } from '../lib/dates';
import { byDate, countdown, daysUntil, subjectByName, TYPES, type EventType } from '../lib/calendar';

const WEEK = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** 'AAAA-MM' desplazado n meses. */
const shiftMonth = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number);
  return ymd(new Date(y, m - 1 + n, 1)).slice(0, 7);
};

export default function Calendario() {
  const events = useAll('event');
  const subjects = useAll('subject');
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [editing, setEditing] = useState<string | null>(null); // id del evento, o 'new'

  const now = today();
  const sorted = useMemo(() => [...events].sort(byDate), [events]);
  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of sorted) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [sorted]);
  const subjectOf = (e: CalEvent) => subjects.find(s => s.id === e.subjectId);

  if (editing) {
    return (
      <EventEditor
        key={editing}
        event={events.find(e => e.id === editing)}
        date={selected}
        subjects={subjects}
        onClose={day => {
          setEditing(null);
          if (day) { setSelected(day); setMonth(day.slice(0, 7)); }
        }}
      />
    );
  }

  const pick = (day: string) => { setSelected(day); setMonth(day.slice(0, 7)); };
  const first = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const cells = Math.ceil((weekdayIndex(first) + new Date(y, m, 0).getDate()) / 7) * 7;
  const grid = Array.from({ length: cells }, (_, i) => addDays(first, i - weekdayIndex(first)));
  const dayEvents = byDay.get(selected) ?? [];
  const upcoming = sorted.filter(e => e.date >= now).slice(0, 8);

  return (
    <>
      <header className="mb-5 flex items-center gap-2">
        <h1 className="flex-1 text-2xl font-semibold tracking-tight">Calendario</h1>
        <button className="btn btn-primary" onClick={() => setEditing('new')}><Plus className="size-4" /> Nuevo</button>
      </header>

      <section className="card mb-6 p-3">
        <div className="mb-2 flex items-center gap-1">
          <h2 className="flex-1 pl-1 font-medium first-letter:uppercase">
            {parse(first).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </h2>
          {month !== now.slice(0, 7) && <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => pick(now)}>Hoy</button>}
          <button className="icon-btn size-9" aria-label="Mes anterior" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft className="size-5" /></button>
          <button className="icon-btn size-9" aria-label="Mes siguiente" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight className="size-5" /></button>
        </div>
        <div className="mb-1 grid grid-cols-7 text-center text-xs text-zinc-400" aria-hidden>
          {WEEK.map(d => <span key={d}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map(day => {
            const evs = byDay.get(day) ?? [];
            const isSel = day === selected;
            return (
              <button
                key={day}
                onClick={() => pick(day)}
                aria-pressed={isSel}
                aria-label={`${longDate(day)}${evs.length ? `, ${evs.length} ${evs.length === 1 ? 'evento' : 'eventos'}` : ''}`}
                className={`flex h-12 cursor-pointer flex-col items-center gap-1 rounded-lg pt-1.5 text-sm tabular-nums transition-colors ${
                  isSel ? 'bg-indigo-600 text-white' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                } ${day.startsWith(month) ? '' : 'opacity-35'} ${day === now && !isSel ? 'font-bold text-indigo-600 dark:text-indigo-400' : ''}`}
              >
                {parse(day).getDate()}
                <span className="flex gap-0.5">
                  {evs.slice(0, 3).map(e => (
                    <span key={e.id} className="size-1.5 rounded-full" style={{ background: isSel ? '#fff' : TYPES[e.type].color }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-6">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{longDate(selected)}</h2>
          {selected !== now && <span className="text-xs text-zinc-400">{countdown(selected)}</span>}
        </div>
        {dayEvents.length ? (
          <ul className="space-y-2">
            {dayEvents.map(e => <EventRow key={e.id} event={e} subject={subjectOf(e)} onClick={() => setEditing(e.id)} />)}
          </ul>
        ) : (
          <button className="card flex w-full cursor-pointer items-center gap-2 p-3 text-sm text-indigo-600 dark:text-indigo-400" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Nada este día. Añadir
          </button>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">Próximos</h2>
        {upcoming.length ? (
          <ul className="space-y-2">
            {upcoming.map(e => <EventRow key={e.id} event={e} subject={subjectOf(e)} showDate onClick={() => setEditing(e.id)} />)}
          </ul>
        ) : (
          <p className="card p-6 text-center text-sm text-zinc-500">No tienes nada por delante. Añade tus exámenes y entregas.</p>
        )}
      </section>
    </>
  );
}

export function EventRow({ event: e, subject, showDate = false, onClick }: {
  event: CalEvent; subject?: Subject; showDate?: boolean; onClick?: () => void;
}) {
  const soon = daysUntil(e.date) <= 3 && e.type !== 'evento';
  const body = (
    <>
      <span className="w-1 self-stretch rounded-full" style={{ background: TYPES[e.type].color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{e.title}</span>
        <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
          {TYPES[e.type].label}
          {subject && <> · <span style={{ color: subject.color }}>●</span> {subject.name}</>}
          {showDate && ` · ${shortDate(e.date)}`}
          {e.time && ` · ${e.time}`}
        </span>
      </span>
      {showDate && (
        <span className={`shrink-0 text-sm font-semibold tabular-nums ${soon ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-400'}`}>{countdown(e.date)}</span>
      )}
    </>
  );
  const cls = 'card flex w-full items-center gap-3 p-3 text-left';
  return (
    <li>
      {onClick
        ? <button className={`${cls} cursor-pointer`} onClick={onClick}>{body}</button>
        : <a href="#/calendario" className={cls}>{body}</a>}
    </li>
  );
}

function EventEditor({ event, date, subjects, onClose }: {
  event?: CalEvent; date: string; subjects: Subject[]; onClose: (day?: string) => void;
}) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [type, setType] = useState<EventType>(event?.type ?? 'examen');
  const [day, setDay] = useState(event?.date ?? date);
  const [time, setTime] = useState(event?.time ?? '');
  const [subject, setSubject] = useState(subjects.find(s => s.id === event?.subjectId)?.name ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !day) return;
    save('event', {
      ...(event ? { id: event.id } : {}),
      title: title.trim(), type, date: day, time: time || undefined,
      subjectId: subjectByName(subjects, subject), notes: notes.trim() || undefined,
    });
    onClose(day);
  };

  return (
    <form onSubmit={submit}>
      <header className="mb-5 flex items-center gap-2">
        <button type="button" className="icon-btn -ml-2" aria-label="Volver sin guardar" onClick={() => onClose()}><ChevronLeft className="size-5" /></button>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight">{event ? 'Editar' : 'Nuevo'}</h1>
        <button className="btn btn-primary" disabled={!title.trim() || !day}>Guardar</button>
      </header>

      <div className="space-y-4">
        <div className="flex gap-1 rounded-xl bg-zinc-200/70 p-1 dark:bg-zinc-800" role="radiogroup" aria-label="Tipo">
          {(Object.keys(TYPES) as EventType[]).map(t => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg py-1.5 text-sm font-medium transition-colors ${
                type === t ? 'bg-white shadow-sm dark:bg-zinc-950' : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              <span className="size-2 rounded-full" style={{ background: TYPES[t].color }} /> {TYPES[t].label}
            </button>
          ))}
        </div>

        <input className="input" aria-label="Título" placeholder={type === 'examen' ? 'Examen parcial de…' : type === 'entrega' ? 'Práctica 2…' : 'Título'} value={title} onChange={e => setTitle(e.target.value)} autoFocus={!event} />

        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-zinc-500 dark:text-zinc-400">
            Día
            <input className="input mt-1" type="date" required value={day} onChange={e => setDay(e.target.value)} />
          </label>
          <label className="block text-xs text-zinc-500 dark:text-zinc-400">
            Hora (opcional)
            <input className="input mt-1" type="time" value={time} onChange={e => setTime(e.target.value)} />
          </label>
        </div>

        <label className="block text-xs text-zinc-500 dark:text-zinc-400">
          Asignatura (opcional)
          <input className="input mt-1" list="asignaturas" placeholder="Física, Historia…" value={subject} onChange={e => setSubject(e.target.value)} />
          <datalist id="asignaturas">{subjects.map(s => <option key={s.id} value={s.name} />)}</datalist>
        </label>

        <label className="block text-xs text-zinc-500 dark:text-zinc-400">
          Notas
          <textarea className="input mt-1 min-h-24" placeholder="Temas que entran, aula, material…" value={notes} onChange={e => setNotes(e.target.value)} />
        </label>
      </div>

      {event && (
        <button
          type="button"
          className="btn btn-ghost mt-8 text-red-500 dark:text-red-400"
          onClick={() => { if (confirm(`¿Borrar «${event.title}»?`)) { remove('event', event.id); onClose(); } }}
        >
          <Trash2 className="size-4" /> Borrar
        </button>
      )}
    </form>
  );
}
