import { useEffect } from 'react';
import { BookOpen, CalendarDays, Dumbbell, Settings, ShoppingCart, Sun, Utensils, type LucideIcon } from 'lucide-react';
import Gym from './pages/gym/Gym';
import Dieta from './pages/Dieta';
import Calendario from './pages/Calendario';
import { useRoute } from './lib/router';
import { useSyncStatus } from './lib/sync';
import Hoy from './pages/Hoy';
import Compra from './pages/Compra';
import Ajustes from './pages/Ajustes';
import Estudio from './pages/estudio/Estudio';

const NAV: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'hoy', label: 'Hoy', icon: Sun },
  { id: 'estudio', label: 'Estudio', icon: BookOpen },
  { id: 'calendario', label: 'Calendario', icon: CalendarDays },
  { id: 'gym', label: 'Gym', icon: Dumbbell },
  { id: 'dieta', label: 'Dieta', icon: Utensils },
  { id: 'compra', label: 'Compra', icon: ShoppingCart },
  { id: 'ajustes', label: 'Ajustes', icon: Settings }, // en móvil va arriba a la derecha, no en la barra
];

function Page({ route, path }: { route: string; path: string[] }) {
  switch (route) {
    case 'hoy': return <Hoy />;
    case 'compra': return <Compra />;
    case 'ajustes': return <Ajustes />;
    case 'gym': return <Gym />;
    case 'dieta': return <Dieta />;
    case 'calendario': return <Calendario />;
    case 'estudio': return <Estudio path={path} />;
    default: return <Hoy />;
  }
}

function SyncDot() {
  const { state, message } = useSyncStatus();
  if (state === 'off') return null;
  const color = { idle: 'bg-emerald-500', syncing: 'bg-amber-400 animate-pulse', error: 'bg-red-500' }[state];
  const label = { idle: 'Sincronizado', syncing: 'Sincronizando…', error: `Sin sincronizar: ${message}` }[state];
  return (
    <a href="#/ajustes" title={label} className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
      <span className={`size-2 rounded-full ${color}`} />
      <span className="max-md:sr-only">{state === 'error' ? 'Sin sincronizar' : label}</span>
    </a>
  );
}

export default function App() {
  const route = useRoute();
  const [section, ...path] = route.split('/');
  const active = NAV.some(n => n.id === section) ? section : 'hoy';

  // Al cambiar de pantalla, empezar arriba (el scroll está en <main>, no en la ventana).
  useEffect(() => { document.querySelector('main')?.scrollTo(0, 0); }, [route]);

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Escritorio: barra lateral. Móvil: barra inferior. */}
      <nav className="order-last flex shrink-0 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] md:order-first md:w-52 md:flex-col md:gap-1 md:border-t-0 md:border-r md:p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 hidden items-center justify-between px-3 pt-2 md:flex">
          <span className="text-lg font-semibold tracking-tight">Suite</span>
          <SyncDot />
        </div>
        {NAV.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={`#/${id}`}
            aria-current={active === id ? 'page' : undefined}
            className={`flex-1 flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors md:flex md:flex-none md:flex-row md:gap-3 md:rounded-xl md:px-3 md:py-2.5 md:text-sm ${id === 'ajustes' ? 'hidden' : 'flex'} ${
              active === id
                ? 'text-indigo-600 md:bg-indigo-50 dark:text-indigo-400 md:dark:bg-indigo-500/10'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            <Icon className="size-5" strokeWidth={active === id ? 2.4 : 2} />
            {label}
          </a>
        ))}
      </nav>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-10 md:px-8 md:pt-10">
          <div className="-mt-2 mb-1 flex items-center justify-end gap-3 md:hidden">
            <SyncDot />
            <a href="#/ajustes" aria-label="Ajustes" className={`icon-btn -mr-2 size-8 ${active === 'ajustes' ? 'text-indigo-600 dark:text-indigo-400' : ''}`}><Settings className="size-5" /></a>
          </div>
          <Page route={active} path={path} />
        </div>
      </main>
    </div>
  );
}
