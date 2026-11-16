import { useMemo, useState, type FormEvent } from 'react';
import { Check, ChevronLeft, ChevronRight, Dumbbell, Flame, Pencil, Plus, Trash2, Utensils } from 'lucide-react';
import { remove, save, useAll, type Habit } from '../lib/store';
import { addDays, longDate, today, weekdayIndex, weekdayLetter } from '../lib/dates';
import { eaten, goalOf, mealsOf } from '../lib/diet';
import { byDate } from '../lib/calendar';
import { EventRow } from './Calendario';

export default function Hoy() {
  const habits = useAll('habit');
  const logs = useAll('habitLog');
  const [date, setDate] = useState(today);
  const [editing, setEditing] = useState(false);

  const now = today();
  const isToday = date === now;
  const sorted = useMemo(
    () => [...habits].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name)),
    [habits],
  );
  const doneSet = useMemo(() => new Set(logs.filter(l => l.done).map(l => l.id)), [logs]);
  const isDone = (habitId: string, day: string) => doneSet.has(`${habitId}:${day}`);

  const toggle = (h: Habit) =>
    save('habitLog', { id: `${h.id}:${date}`, habitId: h.id, date, done: !isDone(h.id, date) });

  // Días seguidos cumpliendo. Si hoy aún no está marcado, la racha de ayer sigue viva.
  const streak = (habitId: string) => {
    let day = isDone(habitId, now) ? now : addDays(now, -1);
    let n = 0;
    while (isDone(habitId, day)) { n++; day = addDays(day, -1); }
    return n;
  };

  const week = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6));
  const doneCount = sorted.filter(h => isDone(h.id, date)).length;

  return (
    <>
      <header className="mb-6 flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{isToday ? 'Hoy' : longDate(date)}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isToday ? longDate(date) : <button className="cursor-pointer text-indigo-600 dark:text-indigo-400" onClick={() => setDate(now)}>Volver a hoy</button>}
          </p>
        </div>
        <button className="icon-btn" aria-label="Día anterior" onClick={() => setDate(addDays(date, -1))}><ChevronLeft className="size-5" /></button>
        <button className="icon-btn" aria-label="Día siguiente" disabled={isToday} onClick={() => setDate(addDays(date, 1))}><ChevronRight className="size-5" /></button>
      </header>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Hábitos{sorted.length > 0 && <> · {doneCount} de {sorted.length}</>}
          </h2>
          <button className="btn btn-ghost -mr-2 px-2 py-1" onClick={() => setEditing(!editing)}>
            {editing ? 'Hecho' : <><Pencil className="size-3.5" /> Editar</>}
          </button>
        </div>

        {sorted.length === 0 && !editing && (
          <p className="card p-6 text-center text-sm text-zinc-500">No tienes hábitos. Pulsa «Editar» para añadir el primero.</p>
        )}

        <ul className="space-y-2">
          {sorted.map(h => editing ? <HabitEditor key={h.id} habit={h} /> : (
            <li key={h.id}>
              <button
                onClick={() => toggle(h)}
                aria-pressed={isDone(h.id, date)}
                className={`card flex w-full cursor-pointer items-center gap-3 p-3 text-left transition-colors ${
                  isDone(h.id, date) ? 'border-emerald-500/40 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10' : ''
                }`}
              >
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-xl transition-colors ${
                    isDone(h.id, date) ? 'bg-emerald-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800'
                  }`}
                >
                  {isDone(h.id, date) ? <Check className="size-6" strokeWidth={3} /> : h.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{h.name}</span>
                  <span className="mt-1 flex gap-1" aria-hidden>
                    {week.map(day => (
                      <span
                        key={day}
                        title={longDate(day)}
                        className={`flex size-4 items-center justify-center rounded text-[9px] font-semibold ${
                          isDone(h.id, day) ? 'bg-emerald-500 text-white' : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500'
                        } ${day === date ? 'ring-2 ring-indigo-500/60' : ''}`}
                      >
                        {weekdayLetter(day)}
                      </span>
                    ))}
                  </span>
                </span>
                {streak(h.id) > 0 && (
                  <span className="flex items-center gap-1 text-sm font-semibold text-orange-500" title="Días seguidos">
                    <Flame className="size-4" /> {streak(h.id)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {editing && <NewHabit />}
      </section>

      {isToday && <Resumen />}
    </>
  );
}

/** Accesos a lo que toca hoy en el resto de módulos. */
function Resumen() {
  const routines = useAll('routine');
  const workouts = useAll('workout');
  const days = useAll('dietDay');
  const plans = useAll('dietPlan');
  const goals = useAll('dietGoal');
  const events = useAll('event');
  const subjects = useAll('subject');

  const now = today();
  const active = workouts.find(w => !w.finishedAt);
  const trained = workouts.find(w => w.finishedAt && w.date === now);
  const todays = routines.find(r => r.weekday === weekdayIndex(now));
  const gym = active ? `${active.name} en curso` : trained ? `${trained.name} hecho` : todays ? `Toca ${todays.name}` : 'Descanso';
  const kcal = Math.round(eaten(mealsOf(now, days, plans)).calories);
  const limit = addDays(now, 14);
  const upcoming = [...events].filter(e => e.date >= now && e.date <= limit).sort(byDate).slice(0, 5);

  return (
    <>
    {upcoming.length > 0 && (
      <section className="mt-8">
        <h2 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">Próximas dos semanas</h2>
        <ul className="space-y-2">
          {upcoming.map(e => <EventRow key={e.id} event={e} subject={subjects.find(s => s.id === e.subjectId)} showDate />)}
        </ul>
      </section>
    )}
    <section className="mt-8 grid grid-cols-2 gap-2">
      <a href="#/gym" className={`card p-3 ${active ? 'border-indigo-500/50' : ''}`}>
        <span className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400"><Dumbbell className="size-4" /> Gym</span>
        <span className="mt-1 block truncate font-medium">{gym}</span>
      </a>
      <a href="#/dieta" className="card p-3">
        <span className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400"><Utensils className="size-4" /> Dieta</span>
        <span className="mt-1 block truncate font-medium tabular-nums">{kcal.toLocaleString('es-ES')} / {goalOf(goals).calories.toLocaleString('es-ES')} kcal</span>
      </a>
    </section>
    </>
  );
}

function HabitEditor({ habit }: { habit: Habit }) {
  return (
    <li className="card flex items-center gap-2 p-2">
      <input
        className="input w-14 px-0 text-center"
        aria-label="Emoji"
        defaultValue={habit.emoji}
        maxLength={4}
        onBlur={e => { const v = e.target.value.trim(); if (v && v !== habit.emoji) save('habit', { id: habit.id, emoji: v }); }}
      />
      <input
        className="input"
        aria-label="Nombre"
        defaultValue={habit.name}
        onBlur={e => { const v = e.target.value.trim(); if (v && v !== habit.name) save('habit', { id: habit.id, name: v }); }}
      />
      <button
        className="icon-btn shrink-0 hover:text-red-500"
        aria-label={`Borrar ${habit.name}`}
        onClick={() => { if (confirm(`¿Borrar el hábito «${habit.name}»?`)) remove('habit', habit.id); }}
      >
        <Trash2 className="size-4.5" />
      </button>
    </li>
  );
}

function NewHabit() {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    save('habit', { name: name.trim(), emoji: emoji.trim() || '✅' });
    setName('');
    setEmoji('');
  };
  return (
    <form onSubmit={submit} className="mt-3 flex items-center gap-2">
      <input className="input w-14 px-0 text-center" aria-label="Emoji" placeholder="✅" maxLength={4} value={emoji} onChange={e => setEmoji(e.target.value)} />
      <input className="input" aria-label="Nuevo hábito" placeholder="Nuevo hábito…" value={name} onChange={e => setName(e.target.value)} />
      <button className="btn btn-primary shrink-0" disabled={!name.trim()}><Plus className="size-4" /> Añadir</button>
    </form>
  );
}
