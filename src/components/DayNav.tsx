import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, longDate, today } from '../lib/dates';

/** Cabecera con título y flechas para moverse por días. `future` permite pasar de hoy. */
export default function DayNav({ title, date, onChange, future = false }: {
  title: string; date: string; onChange: (date: string) => void; future?: boolean;
}) {
  const now = today();
  const isToday = date === now;
  return (
    <header className="mb-6 flex items-center gap-1">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {longDate(date)}
          {!isToday && <> · <button className="cursor-pointer text-indigo-600 dark:text-indigo-400" onClick={() => onChange(now)}>Volver a hoy</button></>}
        </p>
      </div>
      <button className="icon-btn" aria-label="Día anterior" onClick={() => onChange(addDays(date, -1))}><ChevronLeft className="size-5" /></button>
      <button className="icon-btn" aria-label="Día siguiente" disabled={isToday && !future} onClick={() => onChange(addDays(date, 1))}><ChevronRight className="size-5" /></button>
    </header>
  );
}
