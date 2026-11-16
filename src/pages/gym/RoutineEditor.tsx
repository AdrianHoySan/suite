import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, Trash2 } from 'lucide-react';
import { remove, save, type Routine, type RoutineExercise } from '../../lib/store';
import type { KnownExercise } from '../../lib/gym';
import { DAY_NAMES } from '../../lib/dates';
import { AddExercise, ExerciseCard } from './Exercise';

export default function RoutineEditor({ routine, known, onClose }: { routine?: Routine; known: KnownExercise[]; onClose: () => void }) {
  const [name, setName] = useState(routine?.name ?? '');
  const [weekday, setWeekday] = useState<number | null>(routine?.weekday ?? null);
  const [exercises, setExercises] = useState<RoutineExercise[]>(routine?.exercises ?? []);

  const move = (i: number, by: number) => {
    const next = [...exercises];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setExercises(next);
  };

  const submit = () => {
    save('routine', { ...(routine ? { id: routine.id } : {}), name: name.trim() || 'Rutina sin nombre', weekday, exercises });
    onClose();
  };

  return (
    <>
      <header className="mb-5 flex items-center gap-2">
        <button className="icon-btn -ml-2" aria-label="Volver sin guardar" onClick={onClose}><ChevronLeft className="size-5" /></button>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight">{routine ? 'Editar rutina' : 'Nueva rutina'}</h1>
        <button className="btn btn-primary" onClick={submit}>Guardar</button>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        <input className="input min-w-40 flex-1" aria-label="Nombre de la rutina" placeholder="Nombre (p. ej. Pierna)" value={name} onChange={e => setName(e.target.value)} />
        <select className="input w-auto" aria-label="Día de la semana" value={weekday ?? ''} onChange={e => setWeekday(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">Sin día fijo</option>
          {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
      </div>

      <ul className="space-y-2">
        {exercises.map((e, i) => (
          <ExerciseCard
            key={e.exId}
            exercise={e}
            onChange={sets => setExercises(exercises.map((x, j) => (j === i ? { ...x, sets } : x)))}
            onRemove={() => setExercises(exercises.filter((_, j) => j !== i))}
            extra={
              <>
                <button className="icon-btn size-8 shrink-0" aria-label={`Subir ${e.name}`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></button>
                <button className="icon-btn size-8 shrink-0" aria-label={`Bajar ${e.name}`} disabled={i === exercises.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></button>
              </>
            }
          />
        ))}
      </ul>

      <AddExercise
        known={known.filter(k => !exercises.some(e => e.exId === k.exId))}
        onAdd={k => setExercises([...exercises, { ...k, sets: Array.from({ length: 3 }, () => ({ weight: 0, reps: 10 })) }])}
      />

      {routine && (
        <button
          className="btn btn-ghost mt-8 text-red-500 dark:text-red-400"
          onClick={() => { if (confirm(`¿Borrar la rutina «${routine.name}»? El historial de entrenamientos se conserva.`)) { remove('routine', routine.id); onClose(); } }}
        >
          <Trash2 className="size-4" /> Borrar rutina
        </button>
      )}
    </>
  );
}
