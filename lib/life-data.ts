import { prisma } from "./prisma";
import { addUtcMonths, dayFromKey, dayKey, monthRange } from "./dates";
import { canUnlockHabitSlot } from "./habit-progress";
import { getCurrentUser } from "./current-user";

export { dayFromKey, dayKey } from "./dates";

export async function getDashboard(date: string) {
  const user = await getCurrentUser();
  const selectedDate = dayFromKey(date);
  const { start: monthStart, end: monthEnd } = monthRange(date);
  const today = dayFromKey(dayKey(new Date()));
  const todayMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 12));
  const selectedHistoryStart = addUtcMonths(monthStart, -24);
  const currentHistoryStart = addUtcMonths(todayMonthStart, -24);
  const historyStart = selectedHistoryStart < currentHistoryStart ? selectedHistoryStart : currentHistoryStart;
  const entryHistoryEnd = monthEnd > addUtcMonths(todayMonthStart, 1) ? monthEnd : addUtcMonths(todayMonthStart, 1);

  const [actions, monthlyActions, projects, habits, events, health, monthlyNotes, monthCheckIns, reflection] = await prisma.$transaction([
    prisma.action.findMany({
      where: { userId: user.id, scheduledDate: selectedDate },
      include: {
        project: { select: { id: true, title: true } },
        reschedules: {
          select: { fromDate: true, toDate: true, reason: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 6,
    }),
    prisma.action.findMany({
      where: { userId: user.id, scheduledDate: { gte: monthStart, lt: monthEnd } },
      select: { scheduledDate: true },
    }),
    prisma.project.findMany({
      where: { userId: user.id },
      include: {
        goals: { orderBy: { targetDate: "asc" } },
        milestones: { orderBy: { targetDate: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.habit.findMany({
      where: { userId: user.id },
      include: {
        entries: {
          where: { date: { gte: historyStart, lt: entryHistoryEnd }, completed: true },
          select: { date: true, completed: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: { userId: user.id, startsAt: { gte: monthStart, lt: monthEnd } },
      include: { project: { select: { title: true } } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.healthMetric.findUnique({ where: { userId_date: { userId: user.id, date: selectedDate } } }),
    prisma.note.findMany({
      where: { userId: user.id, date: { gte: monthStart, lt: monthEnd } },
      select: { id: true, date: true, type: true, content: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.dailyCheckIn.findMany({
      where: { userId: user.id, date: { gte: monthStart, lt: monthEnd } },
      select: { date: true, energy: true, friction: true, motivation: true, feeling: true, note: true },
    }),
    prisma.monthlyReflection.findUnique({ where: { userId_month: { userId: user.id, month: monthStart } } }),
  ]);

  const selectedNotes = monthlyNotes.filter((note) => dayKey(note.date) === date);
  const checkIn = monthCheckIns.find((item) => dayKey(item.date) === date) ?? null;
  const average = (key: "energy" | "friction" | "motivation") => {
    const values = monthCheckIns.map((item) => item[key]).filter((value): value is number => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  const serializedProjects = projects.map((project) => ({
    id: project.id,
    title: project.title,
    domain: project.domain,
    description: project.description,
    status: project.status,
    goals: project.goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      description: goal.description,
      status: goal.status,
      targetDate: goal.targetDate ? dayKey(goal.targetDate) : null,
    })),
    milestones: project.milestones.map((milestone) => ({
      id: milestone.id,
      goalId: milestone.goalId,
      title: milestone.title,
      targetDate: milestone.targetDate ? dayKey(milestone.targetDate) : null,
      achievedAt: milestone.achievedAt ? dayKey(milestone.achievedAt) : null,
    })),
  }));
  const serializedHabits = habits.map((habit) => ({
    id: habit.id,
    projectId: habit.projectId,
    title: habit.title,
    detail: habit.detail,
    frequency: habit.frequency,
    scheduledDays: habit.scheduledDays,
    startedAt: dayKey(habit.startedAt),
    completedDates: habit.entries.filter((entry) => entry.date >= monthStart).map((entry) => dayKey(entry.date)),
  }));
  const activeHabits = serializedHabits.filter((_, index) => habits[index].active);
  const activeHabitRows = habits.filter((habit) => habit.active);
  const unlockAvailable = activeHabitRows.some((habit) => canUnlockHabitSlot(habit, habit.entries, today, habit.lastUnlockedAt));

  return {
    actions: actions.map((action) => ({
      id: action.id,
      title: action.title,
      type: action.type,
      status: action.status,
      projectId: action.projectId,
      project: action.project?.title ?? "Sin proyecto",
      scheduledDate: dayKey(action.scheduledDate),
      rescheduleCount: action.reschedules.length,
      reschedules: action.reschedules.map((reschedule) => ({
        fromDate: dayKey(reschedule.fromDate),
        toDate: dayKey(reschedule.toDate),
        reason: reschedule.reason,
        createdAt: reschedule.createdAt.toISOString(),
      })),
    })),
    actionDates: monthlyActions.map((action) => dayKey(action.scheduledDate)),
    projects: serializedProjects.filter((project) => project.status === "ACTIVO"),
    archivedProjects: serializedProjects.filter((project) => project.status !== "ACTIVO"),
    habits: activeHabits,
    archivedHabits: serializedHabits.filter((_, index) => !habits[index].active),
    habitCapacity: { activeCount: activeHabits.length, unlockAvailable },
    habitDates: activeHabits.flatMap((habit) => habit.completedDates),
    notes: selectedNotes.map((note) => ({
      id: note.id,
      type: note.type,
      content: note.content,
    })),
    noteDates: monthlyNotes.map((note) => dayKey(note.date)),
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      date: dayKey(event.startsAt),
      projectId: event.projectId,
      project: event.project?.title ?? null,
    })),
    health: health
      ? { steps: health.steps, sleepHours: health.sleepHours, workoutDone: health.workoutDone, readingPages: health.readingPages }
      : null,
    checkIn: checkIn
      ? { energy: checkIn.energy, friction: checkIn.friction, motivation: checkIn.motivation, feeling: checkIn.feeling, note: checkIn.note }
      : null,
    monthlyReview: {
      checkInDays: monthCheckIns.length,
      energy: average("energy"),
      friction: average("friction"),
      motivation: average("motivation"),
      learning: reflection?.learning ?? null,
    },
  };
}
