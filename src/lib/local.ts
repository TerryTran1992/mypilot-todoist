export type Quadrant = 'do' | 'schedule' | 'delegate' | 'eliminate';

export type DailyPlan = {
  bigTask?: string;
  mediumTasks: string[];
  smallTasks: string[];
  reflection?: string;
};

const MATRIX_KEY = 'mypilot_matrix';
const PLANNER_KEY = 'mypilot_planner';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(`local:${key}`));
}

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getMatrix(): Record<string, Quadrant> {
  return read<Record<string, Quadrant>>(MATRIX_KEY, {});
}

export function setMatrixAssignment(todoId: string, quadrant: Quadrant | null) {
  const current = getMatrix();
  if (quadrant === null) {
    delete current[todoId];
  } else {
    current[todoId] = quadrant;
  }
  write(MATRIX_KEY, current);
}

export function clearMatrixFor(todoIds: Set<string>) {
  const current = getMatrix();
  let changed = false;
  for (const id of Object.keys(current)) {
    if (!todoIds.has(id)) {
      delete current[id];
      changed = true;
    }
  }
  if (changed) write(MATRIX_KEY, current);
}

export function getPlan(date: string): DailyPlan {
  const all = read<Record<string, DailyPlan>>(PLANNER_KEY, {});
  return all[date] ?? { mediumTasks: [], smallTasks: [] };
}

export function setPlan(date: string, plan: DailyPlan) {
  const all = read<Record<string, DailyPlan>>(PLANNER_KEY, {});
  all[date] = plan;
  write(PLANNER_KEY, all);
}

/** Replace tempId with realId in matrix + all daily plans. */
export function remapLocalId(tempId: string, realId: string) {
  const matrix = getMatrix();
  if (matrix[tempId]) {
    matrix[realId] = matrix[tempId];
    delete matrix[tempId];
    write(MATRIX_KEY, matrix);
  }

  const plans = read<Record<string, DailyPlan>>(PLANNER_KEY, {});
  let changed = false;
  for (const date of Object.keys(plans)) {
    const p = plans[date];
    if (p.bigTask === tempId) {
      p.bigTask = realId;
      changed = true;
    }
    const m = p.mediumTasks.indexOf(tempId);
    if (m >= 0) {
      p.mediumTasks[m] = realId;
      changed = true;
    }
    const s = p.smallTasks.indexOf(tempId);
    if (s >= 0) {
      p.smallTasks[s] = realId;
      changed = true;
    }
  }
  if (changed) write(PLANNER_KEY, plans);
}
