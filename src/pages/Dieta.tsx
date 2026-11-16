import { useState, type FormEvent } from 'react';
import { Check, Plus, X } from 'lucide-react';
import DayNav from '../components/DayNav';
import Num from '../components/Num';
import { remove, save, useAll, type Food, type Meals } from '../lib/store';
import { eaten, goalOf, MACROS, MEAL_ORDER, mealsOf, sum, type Macros } from '../lib/diet';
import { DAY_NAMES, today, weekdayIndex } from '../lib/dates';

export default function Dieta() {
  const days = useAll('dietDay');
  const plans = useAll('dietPlan');
  const goals = useAll('dietGoal');
  const [date, setDate] = useState(today);
  const [notice, setNotice] = useState('');

  const weekday = weekdayIndex(date);
  const plan = plans.find(p => p.weekday === weekday);
  const logged = days.some(d => d.id === date);
  const meals = mealsOf(date, days, plans);
  const goal = goalOf(goals);
  const totals = eaten(meals);
  const names = [...MEAL_ORDER, ...Object.keys(meals).filter(m => !MEAL_ORDER.includes(m))];

  // El día se guarda la primera vez que se toca; hasta entonces solo se muestra el plan.
  const setMeal = (meal: string, foods: Food[]) => save('dietDay', { id: date, date, meals: { ...meals, [meal]: foods } });

  const saveAsPlan = () => {
    if (!confirm(`¿Usar las comidas de este día como plan de todos los ${DAY_NAMES[weekday].toLowerCase()}?`)) return;
    const clean: Meals = Object.fromEntries(Object.entries(meals).map(([m, foods]) => [m, foods.map(({ done: _, ...f }) => f)]));
    save('dietPlan', { id: `plan-${weekday}`, weekday, meals: clean });
    setNotice(`Guardado como plan de los ${DAY_NAMES[weekday].toLowerCase()}.`);
  };

  return (
    <>
      <DayNav title="Dieta" date={date} onChange={d => { setDate(d); setNotice(''); }} future />

      <section className="card mb-4 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-semibold tabular-nums">{Math.round(totals.calories).toLocaleString('es-ES')}</span>
          <span className="text-sm text-zinc-500 tabular-nums dark:text-zinc-400">de {goal.calories.toLocaleString('es-ES')} kcal</span>
        </div>
        <Bar value={totals.calories} max={goal.calories} className="mt-2 h-2.5" />
        <div className="mt-4 grid grid-cols-3 gap-3">
          {MACROS.slice(1).map(([key, label]) => (
            <div key={key}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
                <span className="tabular-nums">{Math.round(totals[key])}<span className="text-zinc-400">/{goal[key]} g</span></span>
              </div>
              <Bar value={totals[key]} max={goal[key]} className="mt-1 h-1.5" />
            </div>
          ))}
        </div>
      </section>

      {plan?.note && !logged && <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">{plan.note}</p>}

      <div className="space-y-4">
        {names.map(meal => <Meal key={meal} name={meal} foods={meals[meal] ?? []} onChange={foods => setMeal(meal, foods)} />)}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button className="btn btn-ghost border border-zinc-300 dark:border-zinc-700" onClick={saveAsPlan}>Guardar como plan de los {DAY_NAMES[weekday].toLowerCase()}</button>
        {logged && (
          <button className="btn btn-ghost" onClick={() => { if (confirm('¿Volver al plan? Se pierde lo marcado y añadido este día.')) remove('dietDay', date); }}>
            Volver al plan
          </button>
        )}
      </div>
      {notice && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{notice}</p>}

      <section className="card mt-6 p-4">
        <h2 className="font-medium">Objetivos diarios</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {MACROS.map(([key, label, unit]) => (
            <label key={key} className="block text-xs text-zinc-500 dark:text-zinc-400">
              {label} ({unit})
              <Num className="mt-1" label={label} value={goal[key]} onCommit={n => save('dietGoal', { ...goal, id: 'goals', [key]: n })} />
            </label>
          ))}
        </div>
      </section>
    </>
  );
}

function Bar({ value, max, className = '' }: { value: number; max: number; className?: string }) {
  const over = value > max;
  return (
    <div className={`overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800 ${className}`}>
      <div className={`h-full rounded-full transition-all ${over ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }} />
    </div>
  );
}

const macroLine = (m: Macros) => `${Math.round(m.calories)} kcal · ${Math.round(m.protein)}P ${Math.round(m.carbs)}H ${Math.round(m.fats)}G`;

function Meal({ name, foods, onChange }: { name: string; foods: Food[]; onChange: (foods: Food[]) => void }) {
  const [adding, setAdding] = useState(false);
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{name}</h2>
        {foods.length > 0 && <span className="text-xs text-zinc-400 tabular-nums">{macroLine(sum(foods))}</span>}
      </div>
      <ul className="card divide-y divide-zinc-200 dark:divide-zinc-800">
        {foods.map((f, i) => (
          <li key={i} className="flex items-center">
            <button
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 p-3 text-left"
              aria-pressed={!!f.done}
              onClick={() => onChange(foods.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
            >
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${f.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-zinc-300 dark:border-zinc-600'}`}>
                {f.done && <Check className="size-4" strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className={`block truncate ${f.done ? 'text-zinc-500 dark:text-zinc-400' : ''}`}>{f.name}</span>
                <span className="text-xs text-zinc-400 tabular-nums">{macroLine(f)}</span>
              </span>
            </button>
            <button className="icon-btn mr-1 size-8 shrink-0" aria-label={`Quitar ${f.name}`} onClick={() => onChange(foods.filter((_, j) => j !== i))}><X className="size-4" /></button>
          </li>
        ))}
        <li>
          {adding
            ? <NewFood onAdd={f => onChange([...foods, f])} onClose={() => setAdding(false)} />
            : <button className="flex w-full cursor-pointer items-center gap-2 p-3 text-sm text-indigo-600 dark:text-indigo-400" onClick={() => setAdding(true)}><Plus className="size-4" /> Añadir alimento</button>}
        </li>
      </ul>
    </section>
  );
}

// Lo que se añade a mano se da por comido: se apunta al momento, no se planifica.
function NewFood({ onAdd, onClose }: { onAdd: (f: Food) => void; onClose: () => void }) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const num = (k: string) => Math.max(0, parseFloat(String(data.get(k)).replace(',', '.')) || 0);
    const name = String(data.get('name')).trim();
    if (!name) return;
    onAdd({ name, calories: num('calories'), protein: num('protein'), carbs: num('carbs'), fats: num('fats'), done: true });
    form.reset();
    (form.elements.namedItem('name') as HTMLInputElement).focus();
  };
  return (
    <form onSubmit={submit} className="space-y-2 p-3">
      <input className="input" name="name" aria-label="Alimento" placeholder="Alimento" required autoFocus />
      <div className="grid grid-cols-4 gap-2">
        {MACROS.map(([key, label, unit]) => (
          <input key={key} className="input px-2 text-center" name={key} inputMode="decimal" aria-label={`${label} (${unit})`} placeholder={key === 'calories' ? 'kcal' : `${label.slice(0, 4)}. g`} />
        ))}
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary">Añadir</button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cerrar</button>
      </div>
    </form>
  );
}
