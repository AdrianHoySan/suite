import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { remove, save, type Routine, type Workout, type WorkoutExercise } from '../../lib/store';
import { catalog, doneSets, finishWorkout, fmt, lastSets, switchRoutine } from '../../lib/gym';
import { AddExercise, ExerciseCard } from './Exercise';

// Hora actual, refrescada cada segundo, para los cronómetros.
function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(s % 60).padStart(2, '0')}`;
};

export default function WorkoutView({ workout, routines, workouts }: { workout: Workout; routines: Routine[]; workouts: Workout[] }) {
  const now = useNow();
  const { exercises } = workout;
  const done = doneSets(workout).length;
  const total = exercises.reduce((n, e) => n + e.sets.length, 0);

  const setExercises = (next: WorkoutExercise[], extra: Partial<Workout> = {}) => save('workout', { id: workout.id, exercises: next, ...extra });
  const patch = (i: number, sets: WorkoutExercise['sets'], extra?: Partial<Workout>) =>
    setExercises(exercises.map((e, j) => (j === i ? { ...e, sets } : e)), extra);

  const toggle = (i: number, k: number) => {
    const turningOn = !exercises[i].sets[k].done;
    patch(i, exercises[i].sets.map((s, j) => (j === k ? { ...s, done: turningOn } : s)), turningOn ? { lastSetAt: new Date().toISOString() } : {});
  };

  const changeRoutine = (id: string) => {
    const routine = routines.find(r => r.id === id);
    if (routine) switchRoutine(workout, routine, workouts);
  };

  const finish = () => {
    if (done < total && !confirm(`Te quedan ${total - done} series sin marcar. ¿Terminar igualmente? Solo se guardan las hechas.`)) return;
    if (!finishWorkout(workout)) remove('workout', workout.id); // sin ninguna serie hecha no hay nada que guardar
  };

  return (
    <>
      <header className="mb-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{workout.name}</h1>
            <p className="flex flex-wrap items-center gap-x-3 text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
              <span className="flex items-center gap-1"><Timer className="size-4" /> {clock(now - Date.parse(workout.startedAt))}</span>
              <span>{done} de {total} series</span>
              {workout.lastSetAt && <span className="font-medium text-indigo-600 dark:text-indigo-400">Descanso {clock(now - Date.parse(workout.lastSetAt))}</span>}
            </p>
          </div>
          <button className="btn btn-primary shrink-0" onClick={finish}>Terminar</button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="shrink-0">Rutina</span>
            <select className="input min-w-0 py-2" value={workout.routineId ?? ''} onChange={e => changeRoutine(e.target.value)}>
              {!routines.some(r => r.id === workout.routineId) && <option value="">{workout.name}</option>}
              {routines.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <button
            className="btn btn-ghost shrink-0 text-red-500 dark:text-red-400"
            onClick={() => { if (confirm('¿Descartar este entrenamiento? No se guardará nada.')) remove('workout', workout.id); }}
          >
            Descartar
          </button>
        </div>
      </header>

      <ul className="space-y-2">
        {exercises.map((e, i) => {
          const last = lastSets(workouts, e.exId);
          return (
            <ExerciseCard
              key={e.exId}
              exercise={e}
              onChange={sets => patch(i, sets)}
              onToggle={k => toggle(i, k)}
              onRemove={() => { if (!e.sets.some(s => s.done) || confirm(`¿Quitar ${e.name} con sus series hechas?`)) setExercises(exercises.filter((_, j) => j !== i)); }}
              hint={k => (last?.[k] ? `antes ${fmt(last[k].weight)}×${last[k].reps}` : undefined)}
            />
          );
        })}
      </ul>

      {exercises.length === 0 && <p className="card p-6 text-center text-sm text-zinc-500">Añade el primer ejercicio o elige una rutina.</p>}

      <AddExercise
        known={catalog(routines, workouts).filter(k => !exercises.some(e => e.exId === k.exId))}
        onAdd={k => {
          const last = lastSets(workouts, k.exId);
          const sets = last?.map(s => ({ ...s, done: false })) ?? Array.from({ length: 3 }, () => ({ weight: 0, reps: 10, done: false }));
          setExercises([...exercises, { ...k, sets }]);
        }}
      />
    </>
  );
}
