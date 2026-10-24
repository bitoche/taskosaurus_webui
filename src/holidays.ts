// Проверка выходных/праздников через isdayoff-ts API

import isDayOff from 'isdayoff-ts';

export interface HolidayInfo {
  date: string;
  isDayOff: boolean; // выходной или праздник
}

/**
 * Загрузить информацию о выходных/праздниках для диапазона дат
 * Возвращает Map<dateStr, isDayOff>
 */
export async function getDaysInfo(start: Date, end: Date): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  
  try {
    // Создаём даты в UTC чтобы избежать проблем с часовыми поясами
    const startUtc = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
    const endUtc = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()));
    
    const days = await isDayOff.interval(startUtc, endUtc);
    
    let cur = new Date(startUtc);
    for (const day of days) {
      const dateStr = cur.toISOString().slice(0, 10);
      result.set(dateStr, day.bool());
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  } catch (error) {
    console.warn('Ошибка isdayoff interval:', error);
  }
  
  return result;
}

/**
 * Получить локальные выходные (суббота, воскресенье)
 */
export function getLocalWeekends(start: Date, end: Date): Map<string, boolean> {
  const result = new Map<string, boolean>();
  // Используем UTC для избежания проблем с часовыми поясами
  const cur = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
  const endUtc = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()));
  
  while (cur <= endUtc) {
    const dateStr = cur.toISOString().slice(0, 10);
    const dayOfWeek = cur.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    result.set(dateStr, isWeekend);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  
  return result;
}

/**
 * Проверить, является ли дата выходным (суббота/воскресенье)
 */
export function isWeekendLocal(dateStr: string): boolean {
  // Парсим дату в UTC для избежания проблем с часовыми поясами
  const date = new Date(dateStr + 'T00:00:00Z');
  const dayOfWeek = date.getUTCDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}
