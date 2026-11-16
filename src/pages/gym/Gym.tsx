import { useMemo, useState } from 'react';
import { Pencil, Play, Plus } from 'lucide-react';
import { useAll } from '../../lib/store';
import { catalog, startWorkout } from '../../lib/gym';
import { DAY_NAMES, today, weekdayIndex } from '../../lib/dates';
import WorkoutView from './WorkoutView';
import RoutineEditor from './RoutineEditor';
import { History, Progress } from './History';

const TABS = [['rutinas', 'Rutinas'], ['historial', 'Historial'], ['progreso', 'Progreso']] as const;

export default function Gym() {
  const routines = useAll('routine');
  const workouts = useAll('workout');
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('rutinas');
  const [editing, setEditing] = useState<string | null>(null); // id de la rutina, o 'new'

  const sorted = useMemo(
    () => [...routines].sort((a, b) => (a.weekday ?? 7) - (b.weekday ?? 7) || a.name.localeCompare(b.name)),
    [routines],
  );
  // Si dos dispositivos empezaron uno sin conexión, manda el más reciente.
  const active = useMemo(
    () => workouts.filter(w => !w.finishedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0],
    [workouts],
  );

  if (active) return <WorkoutView workout={active} routines={sorted} workouts={workouts} />;
  if (editing) {
    return <RoutineEditor key={editing} routine={routines.find(r => r.id === editing)} known={catalog(routines, workouts)} onClose={() => setEditing(null)} />;
  }

  const todayIdx = weekdayIndex(today());
  const todays = sorted.find(r => r.weekday === todayIdx);

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Gym</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{todays ? `Hoy toca ${todays.name}` : 'Hoy toca descanso'}</p>
      </header>

      <div className="mb-4 flex gap-1 rounded-xl bg-zinc-200/70 p-1 dark:bg-zinc-800" role="tablist">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 cursor-pointer rounded-lg py-1.5 text-sm font-medium transition-colors ${
              tab === id ? 'bg-white shadow-sm dark:bg-zinc-950' : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'historial' && <History workouts={workouts} />}
      {tab === 'progreso' && <Progress workouts={workouts} />}
      {tab === 'rutinas' && (
        <>
          <ul className="space-y-2">
            {sorted.map(r => (
              <li key={r.id} className={`card flex items-center gap-2 p-3 ${r === todays ? 'border-indigo-500/50' : ''}`}>
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {r.weekday == null ? 'Sin día fijo' : DAY_NAMES[r.weekday]} · {r.exercises.length} ejercicios
                    {r === todays && <span className="font-medium text-indigo-600 dark:text-indigo-400"> · hoy</span>}
                  </span>
                </div>
                <button className="icon-btn shrink-0" aria-label={`Editar ${r.name}`} onClick={() => setEditing(r.id)}><Pencil className="size-4" /></button>
                <button className={`btn shrink-0 ${r === todays ? 'btn-primary' : 'btn-ghost border border-zinc-300 dark:border-zinc-700'}`} onClick={() => startWorkout(r, workouts)}>
                  <Play className="size-4" /> Empezar
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-ghost" onClick={() => setEditing('new')}><Plus className="size-4" /> Nueva rutina</button>
            <button className="btn btn-ghost" onClick={() => startWorkout(null, workouts)}><Play className="size-4" /> Entrenamiento libre</button>
          </div>
        </>
      )}
    </>
  );
}
