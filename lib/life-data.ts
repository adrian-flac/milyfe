import { prisma } from "./prisma";

const LOCAL_USER = {
  email: "local@milyfe.app",
  name: "Mi Life OS",
};

export function dayFromKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("La fecha debe usar el formato YYYY-MM-DD.");
  }

  return new Date(`${value}T12:00:00.000Z`);
}

export function dayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function monthRange(value: string) {
  const [year, month] = value.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 12));
  const end = new Date(Date.UTC(year, month, 1, 12));
  return { start, end };
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export async function getLocalUser() {
  const user = await prisma.user.upsert({
    where: { email: LOCAL_USER.email },
    update: {},
    create: LOCAL_USER,
  });

  const projectCount = await prisma.project.count({ where: { userId: user.id } });
  if (projectCount > 0) return user;

  const today = dayFromKey(dayKey(new Date()));

  await prisma.$transaction(async (tx) => {
    const health = await tx.project.create({
      data: { userId: user.id, domain: "SALUD", title: "Prepararme para 10K" },
    });
    const work = await tx.project.create({
      data: { userId: user.id, domain: "TRABAJO", title: "Portafolio frontend" },
    });
    const personal = await tx.project.create({
      data: { userId: user.id, domain: "PERSONAL", title: "Presupuesto consciente" },
    });

    const goal = await tx.goal.create({
      data: {
        userId: user.id,
        projectId: health.id,
        title: "Correr 10 km de forma constante",
        targetDate: addDays(today, 90),
      },
    });

    await tx.milestone.create({
      data: {
        projectId: health.id,
        goalId: goal.id,
        title: "Correr 5 km sin parar",
        targetDate: addDays(today, 30),
      },
    });

    await tx.action.createMany({
      data: [
        { userId: user.id, projectId: work.id, title: "Finalizar módulo de React Cockpit", type: "CLAVE", status: "PENDIENTE", scheduledDate: today, sortOrder: 1 },
        { userId: user.id, projectId: work.id, title: "Revisar pendientes con mentor", type: "DECISION", status: "PENDIENTE", scheduledDate: today, sortOrder: 2 },
        { userId: user.id, projectId: health.id, title: "Entrenamiento de fuerza y cardio", type: "CLAVE", status: "PENDIENTE", scheduledDate: today, sortOrder: 3 },
        { userId: user.id, projectId: personal.id, title: "Actualizar presupuesto mensual", type: "CLAVE", status: "PENDIENTE", scheduledDate: today, sortOrder: 4 },
      ],
    });

    await tx.habit.createMany({
      data: [
        { userId: user.id, projectId: health.id, title: "Meditación matutina", detail: "10 minutos", scheduledDays: [0, 1, 2, 3, 4, 5, 6] },
        { userId: user.id, projectId: personal.id, title: "Lectura", detail: "20 páginas", scheduledDays: [0, 1, 2, 3, 4, 5, 6] },
        { userId: user.id, projectId: health.id, title: "Caminar", detail: "10,000 pasos", scheduledDays: [0, 1, 2, 3, 4, 5, 6] },
      ],
    });

    await tx.calendarEvent.createMany({
      data: [
        { userId: user.id, projectId: work.id, title: "Entrega VHDL", startsAt: addDays(today, 3), endsAt: addDays(today, 3), allDay: true },
        { userId: user.id, projectId: health.id, title: "Entrenamiento largo", startsAt: addDays(today, 5), endsAt: addDays(today, 5), allDay: true },
      ],
    });
  });

  return user;
}

export async function getDashboard(date: string) {
  const user = await getLocalUser();
  const selectedDate = dayFromKey(date);
  const { start: monthStart, end: monthEnd } = monthRange(date);

  const [actions, monthlyActions, projects, habits, events, checkIn] = await prisma.$transaction([
    prisma.action.findMany({
      where: { userId: user.id, scheduledDate: selectedDate },
      include: { project: { select: { id: true, title: true } }, reschedules: { select: { id: true } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 6,
    }),
    prisma.action.findMany({
      where: { userId: user.id, scheduledDate: { gte: monthStart, lt: monthEnd } },
      select: { scheduledDate: true },
    }),
    prisma.project.findMany({
      where: { userId: user.id, status: "ACTIVO" },
      include: {
        goals: { orderBy: { targetDate: "asc" } },
        milestones: { orderBy: { targetDate: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.habit.findMany({
      where: { userId: user.id, active: true },
      include: {
        entries: {
          where: { date: { gte: monthStart, lt: monthEnd }, completed: true },
          select: { date: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: { userId: user.id, startsAt: { gte: monthStart, lt: monthEnd } },
      include: { project: { select: { title: true } } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.dailyCheckIn.findUnique({ where: { userId_date: { userId: user.id, date: selectedDate } } }),
  ]);

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
    })),
    actionDates: monthlyActions.map((action) => dayKey(action.scheduledDate)),
    projects: projects.map((project) => ({
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
    })),
    habits: habits.map((habit) => ({
      id: habit.id,
      title: habit.title,
      detail: habit.detail,
      completedDates: habit.entries.map((entry) => dayKey(entry.date)),
    })),
    habitDates: habits.flatMap((habit) => habit.entries.map((entry) => dayKey(entry.date))),
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      date: dayKey(event.startsAt),
      project: event.project?.title ?? null,
    })),
    checkIn: checkIn
      ? { energy: checkIn.energy, friction: checkIn.friction, motivation: checkIn.motivation, feeling: checkIn.feeling }
      : null,
  };
}
