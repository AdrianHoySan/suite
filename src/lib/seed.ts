// Datos de partida. Llevan id y fecha fijos: al conectar un segundo dispositivo se fusionan
// con los del primero en lugar de duplicarse, y cualquier edición posterior gana.
// Las rutinas, la dieta y los objetivos vienen de la app Gimnasio.
import type { DietGoal, DietPlan, Food, Habit, Meals, Routine, RoutineExercise, SetTpl } from './store';

const AT = '2026-01-01T00:00:00.000Z';
const stamp = { createdAt: AT, updatedAt: AT };

export const SEED_HABITS: Habit[] = [
  { id: 'creatina', name: 'Creatina', emoji: '💪', ...stamp },
  { id: 'leer', name: 'Leer', emoji: '📖', ...stamp },
];

const sets = (count: number, weight: number, reps: number): SetTpl[] => Array.from({ length: count }, () => ({ weight, reps }));
const per = (...pairs: [weight: number, reps: number][]): SetTpl[] => pairs.map(([weight, reps]) => ({ weight, reps }));
const ex = (exId: string, group: string, name: string, s: SetTpl[], extra: Partial<RoutineExercise> = {}): RoutineExercise =>
  ({ exId, group, name, sets: s, ...extra });

// El mismo ejercicio en días distintos comparte exId: su historial de progreso es uno solo.
export const SEED_ROUTINES: Routine[] = [
  {
    id: 'lun', name: 'Full Body A', weekday: 0, ...stamp,
    exercises: [
      ex('e1', 'Pierna', 'Prensa', per([150, 10], [160, 10], [170, 8], [170, 8])),
      ex('e9', 'Pierna', 'Curl femoral', sets(3, 45, 10)),
      ex('e4', 'Pecho', 'Press banca mancuernas', per([24, 8], [24, 8], [26, 8], [26, 8])),
      ex('e3', 'Espalda', 'Jalón al pecho', per([55, 10], [60, 10], [60, 10], [65, 8])),
      ex('e22', 'Hombro', 'Press militar', sets(3, 30, 10)),
      ex('e7', 'Bíceps', 'Curl de bíceps', sets(3, 20, 12)),
      ex('e6', 'Tríceps', 'Extensión en polea', sets(3, 15, 12)),
      ex('e23', 'Abdomen', 'Crunch en polea', sets(3, 30, 15), { optional: true }),
      ex('e2', 'Final', 'Gemelos', sets(4, 60, 12)),
      ex('e16', 'Final', 'Abductores', sets(3, 55, 15)),
    ],
  },
  {
    id: 'mie', name: 'Full Body B', weekday: 2, ...stamp,
    exercises: [
      ex('e8', 'Pierna', 'Hack', per([60, 8], [70, 8], [70, 8], [80, 8])),
      ex('e24', 'Pierna', 'Extensión de cuádriceps', sets(3, 45, 12)),
      ex('e11', 'Pecho', 'Press inclinado mancuernas', per([20, 10], [22, 10], [22, 10], [22, 10])),
      ex('e25', 'Espalda', 'Remo en T', sets(4, 40, 10)),
      ex('e12', 'Hombro', 'Elevaciones laterales', sets(3, 7.5, 12)),
      ex('e26', 'Bíceps', 'Curl martillo', sets(3, 12, 12)),
      ex('e27', 'Tríceps', 'Press francés', sets(3, 20, 10)),
      ex('e28', 'Abdomen', 'Elevación de piernas', sets(3, 0, 12), { optional: true }),
      ex('e2', 'Final', 'Gemelos', sets(4, 60, 12)),
      ex('e17', 'Final', 'Aductores', sets(3, 65, 15)),
    ],
  },
  {
    id: 'vie', name: 'Full Body C', weekday: 4, ...stamp,
    exercises: [
      ex('e1', 'Pierna', 'Prensa', per([150, 10], [160, 10], [170, 8], [170, 8])),
      ex('e29', 'Pierna', 'Peso muerto rumano', sets(3, 50, 10), { optional: true }),
      ex('e19', 'Pecho', 'Peck deck', sets(3, 35, 12)),
      ex('e18', 'Espalda', 'Remo a una mano', per([26, 10], [28, 10], [28, 10], [30, 10])),
      ex('e5', 'Hombro', 'Face pulls', sets(3, 20, 15)),
      ex('e7', 'Bíceps', 'Curl de bíceps', sets(3, 20, 12)),
      ex('e30', 'Tríceps', 'Extensión katana', sets(3, 10, 12)),
      ex('e31', 'Abdomen', 'Plancha', sets(3, 0, 45), { optional: true, unit: 'seg' }),
      ex('e2', 'Final', 'Gemelos', sets(4, 60, 12)),
    ],
  },
];

export const SEED_GOALS: DietGoal[] = [
  { id: 'goals', calories: 2300, protein: 160, carbs: 250, fats: 70, ...stamp },
];

// Los macros son estimaciones.
const food = (name: string, calories: number, protein: number, carbs: number, fats: number): Food => ({ name, calories, protein, carbs, fats });

const breakfast = (): Food[] => [
  food('Leche semidesnatada (200 ml)', 95, 7, 10, 3),
  food('Weetabix Original (2 galletas)', 135, 5, 25, 1),
  food('Plátano', 100, 1, 25, 0),
  food('Yogur proteico', 80, 12, 5, 0),
];

const plan = (weekday: number, meals: Omit<Meals, 'Desayuno'>, note?: string): DietPlan =>
  ({ id: `plan-${weekday}`, weekday, meals: { Desayuno: breakfast(), ...meals }, ...(note ? { note } : {}), ...stamp });

export const SEED_DIET: DietPlan[] = [
  plan(0, {
    Comida: [food('Pechuga de pollo (200 g)', 220, 46, 0, 3), food('Arroz (2 vasitos)', 380, 8, 80, 4), food('Pimientos', 30, 1, 6, 0)],
    Merienda: [food('Queso batido 0% (250 g)', 120, 20, 9, 0), food('Manzana', 80, 0, 21, 0), food('Yogur proteico', 80, 12, 5, 0)],
    Cena: [food('Hamburguesas de pollo (1 pack)', 330, 40, 6, 16), food('1 huevo o 2 claras', 70, 6, 0, 5), food('Patata (200 g)', 155, 4, 34, 0), food('Calabacín', 25, 2, 4, 0)],
  }),
  plan(1, {
    Comida: [food('Pollo troceado (200 g) con calabacín', 245, 47, 4, 3), food('Macarrones (100 g en crudo)', 355, 12, 71, 2), food('Tomate (100 g)', 20, 1, 4, 0)],
    Merienda: [food('3 huevos cocidos', 210, 19, 1, 15), food('Pera', 90, 1, 23, 0), food('Yogur proteico', 80, 12, 5, 0)],
    Cena: [food('Salmón (150 g)', 310, 30, 0, 21), food('Espárragos', 30, 3, 4, 0), food('Patata (250 g)', 190, 5, 43, 0)],
  }),
  plan(2, {
    Comida: [food('Albóndigas (250 g)', 400, 42, 10, 20), food('Patata (250 g)', 190, 5, 43, 0), food('Pepino', 15, 1, 3, 0)],
    Merienda: [food('Pavo (100 g)', 100, 20, 1, 1), food('Yogur proteico', 80, 12, 5, 0), food('Manzana', 80, 0, 21, 0)],
    Cena: [food('3 tortillas de fajita', 270, 8, 45, 6), food('Pechuga de pollo (200 g) con pimientos', 250, 47, 6, 3)],
  }),
  plan(3, {
    Comida: [food('Pinchos de pollo (2)', 260, 44, 2, 8), food('Arroz (2 vasitos)', 380, 8, 80, 4), food('Calabacín', 25, 2, 4, 0)],
    Merienda: [food('Queso batido 0% (250 g)', 120, 20, 9, 0), food('Pera', 90, 1, 23, 0), food('Yogur proteico', 80, 12, 5, 0)],
    Cena: [food('Atún (200 g)', 290, 46, 0, 10), food('Espárragos', 30, 3, 4, 0), food('Patata (300 g)', 230, 6, 52, 0)],
  }),
  plan(4, {
    Comida: [food('Pollo o pechuga (250 g)', 275, 57, 0, 4), food('Macarrones (100 g en crudo)', 355, 12, 71, 2), food('Pimientos y calabacín', 45, 2, 8, 0), food('Tomate (100 g)', 20, 1, 4, 0)],
    Merienda: [food('Pavo (100 g)', 100, 20, 1, 1), food('Yogur proteico', 80, 12, 5, 0), food('Fruta', 80, 0, 20, 0)],
    Cena: [],
  }, 'Cena libre: añade lo que comas'),
  plan(5, { Comida: [], Merienda: [], Cena: [] }, 'Fin de semana: sin plan fijo, añade lo que comas'),
  plan(6, { Comida: [], Merienda: [], Cena: [] }, 'Fin de semana: sin plan fijo, añade lo que comas'),
];
