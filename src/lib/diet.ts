import type { DietDay, DietGoal, DietPlan, Food, Meals } from './store';
import { weekdayIndex } from './dates';

export const MEAL_ORDER = ['Desayuno', 'Comida', 'Merienda', 'Cena'];
export const DEFAULT_GOAL = { calories: 2300, protein: 160, carbs: 250, fats: 70 };
export type Macros = typeof DEFAULT_GOAL;
export const MACROS: [key: keyof Macros, label: string, unit: string][] = [
  ['calories', 'Calorías', 'kcal'], ['protein', 'Proteína', 'g'], ['carbs', 'Hidratos', 'g'], ['fats', 'Grasas', 'g'],
];

export const goalOf = (goals: DietGoal[]): Macros => goals.find(g => g.id === 'goals') ?? DEFAULT_GOAL;

/** Comidas de un día: lo registrado si ese día se ha tocado; si no, el plan de ese día de la semana. */
export function mealsOf(date: string, days: DietDay[], plans: DietPlan[]): Meals {
  return days.find(d => d.id === date)?.meals ?? plans.find(p => p.weekday === weekdayIndex(date))?.meals ?? {};
}

export function sum(foods: Food[]): Macros {
  const t = { calories: 0, protein: 0, carbs: 0, fats: 0 };
  for (const f of foods) for (const k of Object.keys(t) as (keyof Macros)[]) t[k] += f[k] || 0;
  return t;
}

/** Lo ya comido (marcado) en un día. */
export const eaten = (meals: Meals) => sum(Object.values(meals).flat().filter(f => f.done));
