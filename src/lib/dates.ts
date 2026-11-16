// Los días se guardan como 'AAAA-MM-DD' en hora local (no UTC): "hoy" es el día del usuario.
export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const today = () => ymd(new Date());

export const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

/** 0 = lunes … 6 = domingo. */
export const weekdayIndex = (s: string) => (parse(s).getDay() + 6) % 7;

export const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export const shortDate = (s: string) =>
  parse(s).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

const cap =(s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const longDate = (s: string) =>
  cap(parse(s).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));

export const weekdayLetter = (s: string) =>
  parse(s).toLocaleDateString('es-ES', { weekday: 'narrow' }).toUpperCase();
