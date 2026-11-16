import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { remove, type Workout } from '../../lib/store';
import { doneSets, fmt, GROUPS, minutes, volume } from '../../lib/gym';
import { shortDate } from '../../lib/dates';

export function History({ workouts }: { workouts: Workout[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const list = useMemo(() => workouts.filter(w => w.finishedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt)), [workouts]);

  if (!list.length) return <p className="card p-6 text-center text-sm text-zinc-500">Aún no has terminado ningún entrenamiento.</p>;

  return (
    <ul className="space-y-2">
      {list.map(w => (
        <li key={w.id} className="card">
          <button className="flex w-full cursor-pointer items-center gap-3 p-3 text-left" aria-expanded={open === w.id} onClick={() => setOpen(open === w.id ? null : w.id)}>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{w.name}</span>
              <span className="text-xs text-zinc-500 capitalize dark:text-zinc-400">{shortDate(w.date)}</span>
            </span>
            <span className="text-right text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
              <span className="block">{minutes(w)} min · {doneSets(w).length} series</span>
              <span>{Math.round(volume(w)).toLocaleString('es-ES')} kg</span>
            </span>
          </button>
          {open === w.id && (
            <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
              <ul className="space-y-1.5 text-sm">
                {w.exercises.map(e => (
                  <li key={e.exId} className="flex gap-2">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: GROUPS[e.group] ?? GROUPS.Otro }} />
                    <span className="min-w-0 flex-1">{e.name}</span>
                    <span className="text-right text-zinc-500 tabular-nums dark:text-zinc-400">{e.sets.map(s => `${fmt(s.weight)}×${s.reps}`).join('  ')}</span>
                  </li>
                ))}
              </ul>
              <button
                className="btn btn-ghost mt-3 -ml-2 px-2 py-1 text-xs text-red-500 dark:text-red-400"
                onClick={() => { if (confirm('¿Borrar este entrenamiento del historial?')) remove('workout', w.id); }}
              >
                <Trash2 className="size-3.5" /> Borrar
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Evolución de un ejercicio: mejor serie de cada entrenamiento. */
export function Progress({ workouts }: { workouts: Workout[] }) {
  // exId → puntos en orden cronológico
  const byExercise = useMemo(() => {
    const map = new Map<string, { name: string; unit?: string; points: { date: string; weight: number; reps: number; rm: number }[] }>();
    const list = workouts.filter(w => w.finishedAt).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    for (const w of list) for (const e of w.exercises) {
      if (!e.sets.length) continue;
      // Mejor serie: la de más peso y, a igual peso, más repeticiones.
      const best = e.sets.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a));
      const rm = Math.max(...e.sets.map(s => s.weight * (1 + s.reps / 30))); // 1RM estimado (Epley)
      const entry = map.get(e.exId) ?? { name: e.name, unit: e.unit, points: [] };
      entry.points.push({ date: w.date, weight: best.weight, reps: best.reps, rm });
      map.set(e.exId, entry);
    }
    return map;
  }, [workouts]);

  const options = [...byExercise.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  const [picked, setPicked] = useState('');
  const exId = byExercise.has(picked) ? picked : options[0]?.[0];
  const current = exId ? byExercise.get(exId)! : null;

  if (!current) return <p className="card p-6 text-center text-sm text-zinc-500">Cuando termines entrenamientos verás aquí tu progreso por ejercicio.</p>;

  // Sin peso (plancha, dominadas…): se sigue la evolución de las repeticiones.
  const byReps = current.points.every(p => p.weight === 0);
  const values = current.points.map(p => (byReps ? p.reps : p.weight));
  const unit = byReps ? (current.unit ?? 'reps') : 'kg';
  const record = Math.max(...values);
  const lo = Math.min(...values), span = record - lo || 1;
  const W = 300, H = 110, pad = 8;
  const xy = values.map((v, i) => [
    values.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (values.length - 1),
    H - pad - ((v - lo) * (H - 2 * pad)) / span,
  ]);

  return (
    <>
      <select className="input mb-3" aria-label="Ejercicio" value={exId} onChange={e => setPicked(e.target.value)}>
        {options.map(([id, e]) => <option key={id} value={id}>{e.name}</option>)}
      </select>

      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        {[
          ['Récord', `${fmt(record)} ${unit}`],
          ['1RM estimado', byReps ? '—' : `${fmt(Math.round(Math.max(...current.points.map(p => p.rm))))} kg`],
          ['Sesiones', String(values.length)],
        ].map(([label, value]) => (
          <div key={label} className="card p-3">
            <div className="text-lg font-semibold tabular-nums">{value}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="card p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full text-indigo-500" role="img" aria-label={`Evolución de ${current.name}: de ${fmt(values[0])} a ${fmt(values.at(-1)!)} ${unit}`}>
          <polyline points={xy.map(p => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="currentColor"><title>{`${shortDate(current.points[i].date)}: ${fmt(values[i])} ${unit}`}</title></circle>)}
        </svg>
        <div className="mt-1 flex justify-between text-xs text-zinc-500 capitalize tabular-nums dark:text-zinc-400">
          <span>{shortDate(current.points[0].date)} · {fmt(values[0])} {unit}</span>
          <span>{shortDate(current.points.at(-1)!.date)} · {fmt(values.at(-1)!)} {unit}</span>
        </div>
      </div>
    </>
  );
}
