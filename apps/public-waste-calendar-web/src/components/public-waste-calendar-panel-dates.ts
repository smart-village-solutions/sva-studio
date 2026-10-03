export const toDate = (value: string): Date => new Date(`${value}T00:00:00`);

export const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);
export const toMonthKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const startOfMonth = (value: Date): Date =>
  new Date(value.getFullYear(), value.getMonth(), 1);
export const startOfYear = (value: Date): Date => new Date(value.getFullYear(), 0, 1);

export const addMonths = (value: Date, amount: number): Date =>
  new Date(value.getFullYear(), value.getMonth() + amount, 1);

export const addYears = (value: Date, amount: number): Date =>
  new Date(value.getFullYear() + amount, value.getMonth(), 1);

export const compareMonths = (left: Date, right: Date): number =>
  left.getFullYear() - right.getFullYear() || left.getMonth() - right.getMonth();

export const clampMonth = (value: Date, minMonth: Date, maxMonth: Date): Date => {
  if (compareMonths(value, minMonth) < 0) {
    return minMonth;
  }
  if (compareMonths(value, maxMonth) > 0) {
    return maxMonth;
  }
  return value;
};
