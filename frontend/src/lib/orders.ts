/**
 * A local calendar day as Y-m-d, `offset` days from today. (todayISO() gives
 * the UTC day, which in Sri Lanka is still yesterday until 05:30.)
 */
export function dayISO(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type Due = 'overdue' | 'today' | 'tomorrow' | 'later';

/** Where a sales order's delivery day falls against today. */
export function dueOf(dueDate: string): Due {
  const d = dueDate.slice(0, 10);
  const today = dayISO();
  if (d < today) return 'overdue';
  if (d === today) return 'today';
  if (d === dayISO(1)) return 'tomorrow';
  return 'later';
}
