import { addUtcDays, addUtcMonths, dayKey } from "./dates";

export type HabitSchedule = {
  frequency: "DIARIA" | "SEMANAL";
  scheduledDays: number[];
  startedAt: Date;
};

export type HabitProgressEntry = { date: Date; completed: boolean };

export function isHabitScheduled(habit: HabitSchedule, date: Date) {
  if (date < habit.startedAt) return false;
  return habit.frequency === "DIARIA" || habit.scheduledDays.includes(date.getUTCDay());
}

export function habitMonthProgress(habit: HabitSchedule, entries: HabitProgressEntry[], monthStart: Date) {
  const monthEnd = addUtcMonths(monthStart, 1);
  const completed = new Set(entries.filter((entry) => entry.completed).map((entry) => dayKey(entry.date)));
  const scheduled = [] as string[];
  for (let current = monthStart; current < monthEnd; current = addUtcDays(current, 1)) {
    if (isHabitScheduled(habit, current)) scheduled.push(dayKey(current));
  }
  const achieved = scheduled.filter((date) => completed.has(date)).length;
  return { expected: scheduled.length, achieved, percentage: scheduled.length ? Math.round((achieved / scheduled.length) * 100) : 0 };
}

export function completedGreenMonthStreak(habit: HabitSchedule, entries: HabitProgressEntry[], referenceDate: Date) {
  let streak = 0;
  let currentMonth = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1, 12));
  for (let index = 0; index < 24; index += 1) {
    currentMonth = addUtcMonths(currentMonth, -1);
    const progress = habitMonthProgress(habit, entries, currentMonth);
    if (progress.expected === 0 || progress.percentage < 70) break;
    streak += 1;
  }
  return streak;
}

export function lastCompletedMonthStart(referenceDate: Date) {
  const currentMonth = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1, 12));
  return addUtcMonths(currentMonth, -1);
}

function monthDistance(from: Date, to: Date) {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth();
}

/**
 * A habit earns one extra active-habit slot after three completed green
 * months. The recorded unlock consumes that period, so an ongoing streak can
 * earn another slot only after three additional completed months.
 */
export function canUnlockHabitSlot(
  habit: HabitSchedule,
  entries: HabitProgressEntry[],
  referenceDate: Date,
  lastUnlockedAt: Date | null,
) {
  if (completedGreenMonthStreak(habit, entries, referenceDate) < 3) return false;
  if (!lastUnlockedAt) return true;
  return monthDistance(lastUnlockedAt, lastCompletedMonthStart(referenceDate)) >= 3;
}
