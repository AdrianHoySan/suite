import { useMemo, useState, type FormEvent } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { remove, save, useAll, type ShopItem } from '../lib/store';

export default function Compra() {
  const items = useAll('shopItem');
  const [name, setName] = useState('');

  // Pendientes: en el orden en que se apuntaron. Comprados: el último tachado, arriba.
  const todo = useMemo(() => items.filter(i => !i.done).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)), [items]);
  const done = useMemo(() => items.filter(i => i.done).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [items]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = name.trim();
    if (!text) return;
    // Si ya estaba en la lista (aunque sea tachado), se reutiliza en vez de duplicarlo.
    const same = items.find(i => i.name.toLowerCase() === text.toLowerCase());
    if (same) save('shopItem', { id: same.id, done: false });
    else save('shopItem', { name: text, done: false });
    setName('');
  };

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Lista de la compra</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {todo.length === 0 ? 'Nada pendiente' : `${todo.length} ${todo.length === 1 ? 'cosa pendiente' : 'cosas pendientes'}`}
        </p>
      </header>

      <form onSubmit={submit} className="mb-5 flex gap-2">
        <input className="input" aria-label="Añadir a la lista" placeholder="Añadir: leche, huevos…" enterKeyHint="done" value={name} onChange={e => setName(e.target.value)} />
        <button className="btn btn-primary shrink-0" disabled={!name.trim()} aria-label="Añadir"><Plus className="size-5" /></button>
      </form>

      {items.length === 0 && <p className="card p-6 text-center text-sm text-zinc-500">La lista está vacía.</p>}

      <ul className="space-y-2">
        {todo.map(i => <Item key={i.id} item={i} />)}
      </ul>

      {done.length > 0 && (
        <section className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Comprado · {done.length}</h2>
            <button
              className="btn btn-ghost -mr-2 px-2 py-1"
              onClick={() => { if (confirm(`¿Quitar de la lista ${done.length === 1 ? 'el producto comprado' : `los ${done.length} productos comprados`}?`)) remove('shopItem', ...done.map(i => i.id)); }}
            >
              Vaciar
            </button>
          </div>
          <ul className="space-y-2">
            {done.map(i => <Item key={i.id} item={i} />)}
          </ul>
        </section>
      )}
    </>
  );
}

function Item({ item }: { item: ShopItem }) {
  return (
    <li className={`card flex items-center ${item.done ? 'opacity-60' : ''}`}>
      <button
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 p-3 text-left"
        aria-pressed={item.done}
        onClick={() => save('shopItem', { id: item.id, done: !item.done })}
      >
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
            item.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-zinc-300 dark:border-zinc-600'
          }`}
        >
          {item.done && <Check className="size-4" strokeWidth={3} />}
        </span>
        <span className={`truncate ${item.done ? 'line-through' : ''}`}>{item.name}</span>
      </button>
      <button className="icon-btn mr-1 shrink-0" aria-label={`Quitar ${item.name}`} onClick={() => remove('shopItem', item.id)}>
        <X className="size-4.5" />
      </button>
    </li>
  );
}
