// Piezas compartidas por el entrenamiento en curso y el editor de rutinas.
import { useState, type FormEvent, type ReactNode } from 'react';
import { Check, Minus, Plus, X } from 'lucide-react';
import Num from '../../components/Num';
import { GROUPS, type KnownExercise } from '../../lib/gym';
import type { SetTpl } from '../../lib/store';

interface AnyExercise<S extends SetTpl> { exId: string; name: string; group: string; unit?: string; optional?: boolean; sets: S[] }

/**
 * Tarjeta de un ejercicio con sus series editables. Con `onToggle` cada serie lleva un botón
 * para marcarla como hecha (entrenamiento); sin él solo se editan peso y repeticiones (rutina).
 */
export function ExerciseCard<S extends SetTpl & { done?: boolean }>({ exercise, onChange, onRemove, onToggle, hint, extra }: {
  exercise: AnyExercise<S>;
  onChange: (sets: S[]) => void;
  onRemove: () => void;
  onToggle?: (index: number) => void;
  hint?: (index: number) => string | undefined;
  extra?: ReactNode;
}) {
  const { sets, unit = 'reps' } = exercise;
  const patch = (i: number, p: Partial<SetTpl>) => onChange(sets.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const addSet = () => {
    const last = sets.at(-1);
    onChange([...sets, { weight: last?.weight ?? 0, reps: last?.reps ?? 10, ...(onToggle ? { done: false } : {}) } as S]);
  };

  return (
    <li className="card p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: GROUPS[exercise.group] ?? GROUPS.Otro }} />
        <div className="min-w-0 flex-1">
          <span className="block truncate font-medium">{exercise.name}</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{exercise.group}{exercise.optional && ' · opcional'}</span>
        </div>
        {extra}
        <button className="icon-btn size-8 shrink-0" aria-label={`Quitar ${exercise.name}`} onClick={onRemove}><X className="size-4" /></button>
      </div>

      <ul className="space-y-1.5">
        {sets.map((s, i) => (
          <li key={i} className={`flex items-center gap-2 ${s.done ? 'opacity-60' : ''}`}>
            <span className="w-5 text-center text-xs font-medium text-zinc-400">{i + 1}</span>
            <Num className="w-20" label={`Peso de la serie ${i + 1}`} value={s.weight} onCommit={weight => patch(i, { weight })} />
            <span className="text-xs text-zinc-400">kg ×</span>
            <Num className="w-16" label={`Repeticiones de la serie ${i + 1}`} value={s.reps} onCommit={reps => patch(i, { reps })} />
            <span className="text-xs text-zinc-400">{unit}</span>
            <span className="min-w-0 flex-1 truncate text-right text-xs text-zinc-400">{hint?.(i)}</span>
            {onToggle && (
              <button
                aria-label={`Serie ${i + 1} hecha`}
                aria-pressed={!!s.done}
                onClick={() => onToggle(i)}
                className={`flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors ${
                  s.done ? 'bg-emerald-500 text-white' : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700'
                }`}
              >
                <Check className="size-5" strokeWidth={3} />
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-2 flex gap-1">
        <button className="btn btn-ghost px-2 py-1 text-xs" onClick={addSet}><Plus className="size-3.5" /> Serie</button>
        {sets.length > 1 && (
          <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => onChange(sets.slice(0, -1))}><Minus className="size-3.5" /> Serie</button>
        )}
      </div>
    </li>
  );
}

/** Formulario para añadir un ejercicio: sugiere los ya conocidos para reutilizar su historial. */
export function AddExercise({ known, onAdd }: { known: KnownExercise[]; onAdd: (e: KnownExercise) => void }) {
  const [name, setName] = useState('');
  const [group, setGroup] = useState('Otro');
  const match = known.find(k => k.name.toLowerCase() === name.trim().toLowerCase());

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(match ?? { exId: crypto.randomUUID(), name: name.trim(), group });
    setName('');
  };

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2">
      <input className="input min-w-40 flex-1" list="ejercicios" aria-label="Nuevo ejercicio" placeholder="Añadir ejercicio…" value={name} onChange={e => setName(e.target.value)} />
      <datalist id="ejercicios">{known.map(k => <option key={k.exId} value={k.name} />)}</datalist>
      <select className="input w-auto" aria-label="Grupo muscular" value={match?.group ?? group} disabled={!!match} onChange={e => setGroup(e.target.value)}>
        {Object.keys(GROUPS).map(g => <option key={g}>{g}</option>)}
      </select>
      <button className="btn btn-primary shrink-0" disabled={!name.trim()} aria-label="Añadir ejercicio"><Plus className="size-5" /></button>
    </form>
  );
}
