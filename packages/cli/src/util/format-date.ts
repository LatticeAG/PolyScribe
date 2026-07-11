const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function formatDateUtc(date?: string): string {
  if (date === undefined) {
    return new Date().toISOString().slice(0, 10);
  }

  if (!DATE_PATTERN.test(date)) {
    throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
  }

  return date;
}
