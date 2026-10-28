/**
 * Утилиты для работы с датами задач: форматирование, парсинг с учетом часовых поясов,
 * расчет дат закрытия и разницы (просрочки / опережения).
 */

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseAsLocalDate(dttmStr?: string | null): Date | null {
  if (!dttmStr) return null;
  const iso = dttmStr.endsWith('Z') || dttmStr.includes('+') ? dttmStr : dttmStr + 'Z';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Возвращает строковый ключ (YYYY-MM-DD) в локальном часовом поясе для даты закрытия задачи.
 */
export function getTaskClosedDateKey(closedDttm?: string | null): string | null {
  if (!closedDttm) return null;
  const dt = parseAsLocalDate(closedDttm);
  if (dt) {
    return formatLocalDate(dt);
  }
  return closedDttm.slice(0, 10);
}

/**
 * Рассчитывает разницу между назначенной датой и датой фактического закрытия.
 * @returns { overdueClosed: дней просрочки (если > 0), earlyClosed: дней опережения (если закрыто раньше) }
 */
export function getCompletionDiff(
  dueDateStr?: string | null,
  closedDttm?: string | null
): { overdueClosed: number; earlyClosed: number } {
  if (!dueDateStr || !closedDttm) {
    return { overdueClosed: 0, earlyClosed: 0 };
  }
  const dueParts = dueDateStr.slice(0, 10).split('-');
  if (dueParts.length !== 3) return { overdueClosed: 0, earlyClosed: 0 };
  const dueUtc = Date.UTC(Number(dueParts[0]), Number(dueParts[1]) - 1, Number(dueParts[2]));

  const closedDate = parseAsLocalDate(closedDttm);
  if (!closedDate) return { overdueClosed: 0, earlyClosed: 0 };

  const closedUtc = Date.UTC(
    closedDate.getFullYear(),
    closedDate.getMonth(),
    closedDate.getDate()
  );

  const diffDays = Math.round((closedUtc - dueUtc) / (1000 * 60 * 60 * 24));
  if (diffDays > 0) {
    return { overdueClosed: diffDays, earlyClosed: 0 };
  } else if (diffDays < 0) {
    return { overdueClosed: 0, earlyClosed: Math.abs(diffDays) };
  }
  return { overdueClosed: 0, earlyClosed: 0 };
}
