import { save, type Routine, type Workout, type WorkoutExercise, type WorkoutSet } from './store';
import { today } from './dates';

export const GROUPS: Record<string, string> = {
  Pierna: '#34d399', Pecho: '#f472b6', Espalda: '#60a5fa', Hombro: '#fbbf24',
  Bíceps: '#a78bfa', Tríceps: '#fb7185', Abdomen: '#2dd4bf', Final: '#94a3b8', Otro: '#94a3b8',
};

export const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

const finished = (workouts: Workout[]) =>
  workouts.filter(w => w.finishedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt));

/** Series hechas la última vez que se entrenó este ejercicio. */
export function lastSets(workouts: Workout[], exId: string): WorkoutSet[] | null {
  for (const w of finished(workouts)) {
    const done = w.exercises.find(e => e.exId === exId)?.sets.filter(s => s.done);
    if (done?.length) return done;
  }
  return null;
}

// Cada serie arranca con lo que se hizo la última vez; si no hay historial, con lo de la rutina.
function fromRoutine(routine: Routine, workouts: Workout[]): WorkoutExercise[] {
  return routine.exercises.map(({ sets, ...e }) => {
    const last = lastSets(workouts, e.exId);
    return {
      ...e,
      sets: sets.map((s, i) => ({
        weight: last?.[i]?.weight ?? last?.at(-1)?.weight ?? s.weight,
        reps: last?.[i]?.reps ?? s.reps,
        done: false,
      })),
    };
  });
}

export function startWorkout(routine: Routine | null, workouts: Workout[]) {
  return save('workout', {
    routineId: routine?.id ?? null,
    name: routine?.name ?? 'Entrenamiento libre',
    date: today(),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exercises: routine ? fromRoutine(routine, workouts) : [],
  });
}

/** Cambia de rutina a mitad de entrenamiento: lo ya hecho se conserva y el resto se sustituye. */
export function switchRoutine(workout: Workout, routine: Routine, workouts: Workout[]) {
  const kept = workout.exercises.filter(e => e.sets.some(s => s.done));
  const fresh = fromRoutine(routine, workouts).filter(e => !kept.some(k => k.exId === e.exId));
  save('workout', { id: workout.id, routineId: routine.id, name: routine.name, exercises: [...kept, ...fresh] });
}

/** Termina el entrenamiento guardando solo las series hechas. Devuelve false si no había ninguna. */
export function finishWorkout(workout: Workout): boolean {
  const exercises = workout.exercises
    .map(e => ({ ...e, sets: e.sets.filter(s => s.done) }))
    .filter(e => e.sets.length);
  if (!exercises.length) return false;
  save('workout', { id: workout.id, exercises, finishedAt: new Date().toISOString() });
  return true;
}

export const doneSets = (w: Workout) => w.exercises.flatMap(e => e.sets.filter(s => s.done));
export const volume = (w: Workout) => doneSets(w).reduce((sum, s) => sum + s.weight * s.reps, 0);
export const minutes = (w: Workout, until = w.finishedAt ?? new Date().toISOString()) =>
  Math.max(0, Math.round((Date.parse(until) - Date.parse(w.startedAt)) / 60000));

export interface KnownExercise { exId: string; name: string; group: string; unit?: string }

/** Todos los ejercicios que aparecen en alguna rutina o entrenamiento, sin repetir. */
export function catalog(routines: Routine[], workouts: Workout[]): KnownExercise[] {
  const map = new Map<string, KnownExercise>();
  for (const src of [...routines, ...workouts])
    for (const { exId, name, group, unit } of src.exercises) if (!map.has(exId)) map.set(exId, { exId, name, group, unit });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
