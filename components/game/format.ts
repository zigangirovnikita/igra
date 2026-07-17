export function money(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(value))} ₽`;
}

export function compact(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(value));
}

let commandSequence = 0;

export function commandId(prefix: string): string {
  commandSequence += 1;
  return `${prefix}_${Date.now()}_${commandSequence}`;
}
