"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";

type ActionKind = "CLAVE" | "DECISION";
type ActionState = "PENDIENTE" | "COMPLETADA" | "POSPUESTA";
type Feeling = "EXCELENTE" | "BIEN" | "NEUTRAL" | "BAJO" | "MAL";
type HabitFrequency = "DIARIA" | "SEMANAL";
type NoteType = "ACCION" | "NOTA" | "EMOCION" | "EVENTO";
type Action = { id: string; title: string; type: ActionKind; status: ActionState; projectId: string | null; project: string; scheduledDate: string; rescheduleCount: number };
type Habit = { id: string; projectId: string | null; title: string; detail: string | null; frequency: HabitFrequency; scheduledDays: number[]; startedAt: string; completedDates: string[] };
type Note = { id: string; type: NoteType; content: string };
type Goal = { id: string; title: string; description: string | null; status: "ACTIVO" | "ALCANZADO" | "ABANDONADO"; targetDate: string | null };
type Milestone = { id: string; goalId: string | null; title: string; targetDate: string | null; achievedAt: string | null };
type Project = { id: string; title: string; domain: "SALUD" | "TRABAJO" | "PERSONAL"; description: string | null; status: "ACTIVO" | "COMPLETADO" | "ARCHIVADO"; goals: Goal[]; milestones: Milestone[] };
type Dashboard = {
  actions: Action[]; actionDates: string[]; projects: Project[]; habits: Habit[]; habitDates: string[]; notes: Note[]; noteDates: string[];
  events: { id: string; title: string; date: string }[];
  checkIn: { energy: number | null; friction: number | null; motivation: number | null; feeling: Feeling | null; note: string | null } | null;
  monthlyReview: { checkInDays: number; energy: number | null; friction: number | null; motivation: number | null; learning: string | null };
};

const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const weekdays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const feelings: Feeling[] = ["EXCELENTE", "BIEN", "NEUTRAL", "BAJO", "MAL"];
const feelingLabel: Record<Feeling, string> = { EXCELENTE: "Excelente", BIEN: "Bien", NEUTRAL: "Neutral", BAJO: "Bajo", MAL: "Mal" };
const noteLabel: Record<NoteType, string> = { ACCION: "Acción", NOTA: "Nota", EMOCION: "Emoción", EVENTO: "Evento" };
const weekdaysShort = ["D", "L", "M", "X", "J", "V", "S"];

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}><header><h2>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">×</button></header>{children}</section></div>;
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateLabel(year: number, month: number, day: number) {
  return `${day} de ${months[month].toLowerCase()} de ${year}`;
}

function offsetDateKey(value: string, days: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function nextMondayKey(value: string) {
  const date = new Date(`${value}T12:00:00.000Z`);
  const difference = (8 - date.getUTCDay()) % 7 || 7;
  return offsetDateKey(value, difference);
}

function isHabitScheduled(habit: Habit, date: string) {
  if (date < habit.startedAt) return false;
  if (habit.frequency === "DIARIA") return true;
  return habit.scheduledDays.includes(new Date(`${date}T12:00:00.000Z`).getUTCDay());
}

function domainLabel(domain: Project["domain"]) {
  return domain === "SALUD" ? "Salud" : domain === "TRABAJO" ? "Trabajo" : "Personal";
}

async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "No se pudo guardar el cambio.");
  }
  return response.json();
}

export default function Home() {
  const initialToday = new Date();
  const [view, setView] = useState(() => ({ year: initialToday.getFullYear(), month: initialToday.getMonth() }));
  const [selectedDay, setSelectedDay] = useState(() => initialToday.getDate());
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [newAction, setNewAction] = useState("");
  const [newActionKind, setNewActionKind] = useState<ActionKind>("CLAVE");
  const [newActionProject, setNewActionProject] = useState("");
  const [newEvent, setNewEvent] = useState("");
  const [newEventProject, setNewEventProject] = useState("");
  const [openBlock, setOpenBlock] = useState<"actions" | "projects" | "habits" | "mood">("actions");
  const [syncError, setSyncError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState<{ id?: string; title: string; domain: Project["domain"]; description: string } | null>(null);
  const [goalForm, setGoalForm] = useState<{ id?: string; projectId: string; title: string; description: string; targetDate: string } | null>(null);
  const [milestoneForm, setMilestoneForm] = useState<{ id?: string; projectId: string; goalId: string; title: string; targetDate: string } | null>(null);
  const [actionForm, setActionForm] = useState<Action | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState<{ action: Action; date: string; reason: string } | null>(null);
  const [habitForm, setHabitForm] = useState<{ id?: string; title: string; detail: string; projectId: string; frequency: HabitFrequency; scheduledDays: number[] } | null>(null);
  const [noteForm, setNoteForm] = useState<{ id?: string; type: NoteType; content: string } | null>(null);
  const [checkInNote, setCheckInNote] = useState("");
  const [learningDraft, setLearningDraft] = useState("");
  const selectedDate = isoDate(view.year, view.month, selectedDay);

  const loadDashboard = useCallback(async () => {
    try {
      setSyncError("");
      setDashboard(await api(`/api/dashboard?date=${selectedDate}`) as Dashboard);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo cargar tu información.");
    }
  }, [selectedDate]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);
  useEffect(() => {
    setCheckInNote(dashboard?.checkIn?.note ?? "");
    setLearningDraft(dashboard?.monthlyReview.learning ?? "");
  }, [dashboard?.checkIn?.note, dashboard?.monthlyReview.learning, selectedDate]);

  const calendarCells = useMemo(() => {
    const firstWeekday = new Date(view.year, view.month, 1).getDay();
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const previousDays = new Date(view.year, view.month, 0).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - firstWeekday + 1;
      if (day < 1) return { day: previousDays + day, current: false, month: view.month - 1 };
      if (day > daysInMonth) return { day: day - daysInMonth, current: false, month: view.month + 1 };
      return { day, current: true, month: view.month };
    });
  }, [view]);

  const eventsByDate = useMemo(() => {
    const byDate = new Map<string, string[]>();
    for (const event of dashboard?.events ?? []) byDate.set(event.date, [...(byDate.get(event.date) ?? []), event.title]);
    return byDate;
  }, [dashboard]);

  const actions = dashboard?.actions ?? [];
  const actionDates = new Set(dashboard?.actionDates ?? []);
  const habitDates = new Set(dashboard?.habitDates ?? []);
  const noteDates = new Set(dashboard?.noteDates ?? []);
  const pendingCount = actions.filter((action) => action.status === "PENDIENTE").length;
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const trackedDays = Math.min(selectedDay, daysInMonth);
  const monthKey = `${view.year}-${String(view.month + 1).padStart(2, "0")}`;

  function changeMonth(offset: number) {
    const next = new Date(view.year, view.month + offset, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
    setSelectedDay(1);
  }

  function goToToday() {
    const today = new Date();
    setView({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedDay(today.getDate());
  }

  async function updateAction(id: string, status: ActionState) {
    try {
      setIsSaving(true);
      await api(`/api/actions/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await loadDashboard();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo actualizar la acción.");
    } finally { setIsSaving(false); }
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectForm) return;
    try {
      setIsSaving(true);
      await api(projectForm.id ? `/api/projects/${projectForm.id}` : "/api/projects", { method: projectForm.id ? "PATCH" : "POST", body: JSON.stringify(projectForm) });
      setProjectForm(null);
      await loadDashboard();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo guardar el proyecto.");
    } finally { setIsSaving(false); }
  }

  async function archiveProject(project: Project) {
    try {
      setIsSaving(true);
      await api(`/api/projects/${project.id}`, { method: "PATCH", body: JSON.stringify({ status: "ARCHIVADO" }) });
      if (expandedProjectId === project.id) setExpandedProjectId(null);
      await loadDashboard();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo archivar el proyecto.");
    } finally { setIsSaving(false); }
  }

  async function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!goalForm) return;
    try {
      setIsSaving(true);
      const { id, projectId, ...data } = goalForm;
      await api(id ? `/api/goals/${id}` : `/api/projects/${projectId}/goals`, { method: id ? "PATCH" : "POST", body: JSON.stringify(data) });
      setGoalForm(null);
      await loadDashboard();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo guardar el objetivo.");
    } finally { setIsSaving(false); }
  }

  async function saveMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!milestoneForm) return;
    try {
      setIsSaving(true);
      const { id, projectId, ...data } = milestoneForm;
      await api(id ? `/api/milestones/${id}` : `/api/projects/${projectId}/milestones`, { method: id ? "PATCH" : "POST", body: JSON.stringify(data) });
      setMilestoneForm(null);
      await loadDashboard();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo guardar el hito.");
    } finally { setIsSaving(false); }
  }

  async function toggleGoal(goal: Goal) {
    try {
      setIsSaving(true);
      await api(`/api/goals/${goal.id}`, { method: "PATCH", body: JSON.stringify({ status: goal.status === "ALCANZADO" ? "ACTIVO" : "ALCANZADO" }) });
      await loadDashboard();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo actualizar el objetivo.");
    } finally { setIsSaving(false); }
  }

  async function toggleMilestone(milestone: Milestone) {
    try {
      setIsSaving(true);
      await api(`/api/milestones/${milestone.id}`, { method: "PATCH", body: JSON.stringify({ completed: !milestone.achievedAt }) });
      await loadDashboard();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo actualizar el hito.");
    } finally { setIsSaving(false); }
  }

  async function saveActionDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actionForm) return;
    try {
      setIsSaving(true);
      await api(`/api/actions/${actionForm.id}`, { method: "PATCH", body: JSON.stringify({ title: actionForm.title, type: actionForm.type, projectId: actionForm.projectId, date: actionForm.scheduledDate }) });
      setActionForm(null);
      await loadDashboard();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo editar la acción.");
    } finally { setIsSaving(false); }
  }

  async function rescheduleAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rescheduleForm) return;
    try {
      setIsSaving(true);
      await api(`/api/actions/${rescheduleForm.action.id}`, { method: "PATCH", body: JSON.stringify({ date: rescheduleForm.date, reason: rescheduleForm.reason }) });
      setRescheduleForm(null);
      await loadDashboard();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo reprogramar la acción.");
    } finally { setIsSaving(false); }
  }

  async function moveAction(id: string, direction: -1 | 1) {
    const index = actions.findIndex((action) => action.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= actions.length) return;
    const ordered = [...actions];
    [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
    try {
      setIsSaving(true);
      await api("/api/actions/reorder", { method: "POST", body: JSON.stringify({ ids: ordered.map((action) => action.id), date: selectedDate }) });
      await loadDashboard();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo reordenar las acciones.");
    } finally { setIsSaving(false); }
  }

  async function addAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newAction.trim() || actions.length >= 6) return;
    try {
      setIsSaving(true);
      await api("/api/actions", { method: "POST", body: JSON.stringify({ title: newAction, type: newActionKind, projectId: newActionProject || null, date: selectedDate }) });
      setNewAction("");
      await loadDashboard();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo crear la acción.");
    } finally { setIsSaving(false); }
  }

  async function addEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newEvent.trim()) return;
    try {
      setIsSaving(true);
      await api("/api/events", { method: "POST", body: JSON.stringify({ title: newEvent, projectId: newEventProject || null, date: selectedDate }) });
      setNewEvent("");
      await loadDashboard();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo crear el evento.");
    } finally { setIsSaving(false); }
  }

  async function toggleHabit(habit: Habit, day: number) {
    const date = isoDate(view.year, view.month, day);
    if (!isHabitScheduled(habit, date) || date > selectedDate) return;
    try {
      setIsSaving(true);
      await api(`/api/habits/${habit.id}`, { method: "PATCH", body: JSON.stringify({ date, completed: !habit.completedDates.includes(date) }) });
      await loadDashboard();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo actualizar el hábito.");
    } finally { setIsSaving(false); }
  }

  async function saveHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!habitForm) return;
    try {
      setIsSaving(true);
      const { id, ...data } = habitForm;
      await api(id ? `/api/habits/${id}` : "/api/habits", { method: id ? "PATCH" : "POST", body: JSON.stringify(data) });
      setHabitForm(null);
      await loadDashboard();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo guardar el hábito.");
    } finally { setIsSaving(false); }
  }

  async function archiveHabit(habit: Habit) {
    try {
      setIsSaving(true);
      await api(`/api/habits/${habit.id}`, { method: "PATCH", body: JSON.stringify({ active: false }) });
      await loadDashboard();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo archivar el hábito.");
    } finally { setIsSaving(false); }
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteForm) return;
    try {
      setIsSaving(true);
      const { id, ...data } = noteForm;
      await api(id ? `/api/notes/${id}` : "/api/notes", { method: id ? "PATCH" : "POST", body: JSON.stringify(id ? data : { ...data, date: selectedDate }) });
      setNoteForm(null);
      await loadDashboard();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo guardar la nota.");
    } finally { setIsSaving(false); }
  }

  async function saveMonthlyLearning(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setIsSaving(true);
      await api("/api/monthly-reflection", { method: "PATCH", body: JSON.stringify({ month: monthKey, learning: learningDraft }) });
      await loadDashboard();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo guardar el aprendizaje.");
    } finally { setIsSaving(false); }
  }

  async function updateCheckIn(data: Record<string, number | Feeling | string>) {
    try {
      setIsSaving(true);
      await api("/api/check-in", { method: "PATCH", body: JSON.stringify({ date: selectedDate, ...data }) });
      await loadDashboard();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo guardar el check-in.");
    } finally { setIsSaving(false); }
  }

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="selected-day"><p className="eyebrow">Día seleccionado</p><h1>{dateLabel(view.year, view.month, selectedDay)}</h1><span className="weather" aria-label="Nublado">☁</span></div>
      {syncError && <p className="sync-error" role="alert">{syncError}</p>}

      <section className="block block-open">
        <button className="block-heading" onClick={() => setOpenBlock(openBlock === "actions" ? "projects" : "actions")}><span className="block-title"><i className="dot blue" /> Bloque 1: Top 6 acciones</span><span className="chevron">{openBlock === "actions" ? "⌃" : "⌄"}</span></button>
        {openBlock === "actions" && <div className="block-content actions-content">
          <div className="top-six-line"><span>{actions.length} de 6 acciones</span><span>{pendingCount} pendientes</span></div>
          <form className="add-action" onSubmit={addAction}>
            <input value={newAction} onChange={(event) => setNewAction(event.target.value)} placeholder="Nueva acción…" aria-label="Nueva acción" maxLength={140} />
            <select value={newActionKind} onChange={(event) => setNewActionKind(event.target.value as ActionKind)} aria-label="Tipo de acción"><option value="CLAVE">Clave</option><option value="DECISION">Decisión</option></select>
            <select value={newActionProject} onChange={(event) => setNewActionProject(event.target.value)} aria-label="Proyecto"><option value="">Sin proyecto</option>{(dashboard?.projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select>
            <button type="submit" disabled={!newAction.trim() || actions.length >= 6 || isSaving} aria-label="Agregar acción">+</button>
          </form>
          <div className="action-list">{actions.map((action, index) => <article key={action.id} className={`action-row ${action.status === "COMPLETADA" ? "is-complete" : ""}`}>
            <button className="check" onClick={() => void updateAction(action.id, action.status === "COMPLETADA" ? "PENDIENTE" : "COMPLETADA")} disabled={isSaving} aria-label={`Cambiar estado de ${action.title}`}>{action.status === "COMPLETADA" ? "✓" : ""}</button>
            <div className="action-copy"><strong>{action.title}</strong><small>{action.project}{action.rescheduleCount ? ` · ${action.rescheduleCount} reprogramación${action.rescheduleCount > 1 ? "es" : ""}` : ""}</small></div>
            <span className={`kind-tag ${action.type.toLowerCase()}`}>{action.type === "CLAVE" ? "Clave" : "Decisión"}</span>
            <div className="action-tools">
              <button className="row-tool" onClick={() => void moveAction(action.id, -1)} disabled={isSaving || index === 0} title="Subir acción" aria-label={`Subir ${action.title}`}>↑</button>
              <button className="row-tool" onClick={() => void moveAction(action.id, 1)} disabled={isSaving || index === actions.length - 1} title="Bajar acción" aria-label={`Bajar ${action.title}`}>↓</button>
              <button className="row-tool" onClick={() => setActionForm(action)} disabled={isSaving} title="Editar acción" aria-label={`Editar ${action.title}`}>✎</button>
              <button className="row-tool" onClick={() => setRescheduleForm({ action, date: offsetDateKey(action.scheduledDate, 1), reason: "" })} disabled={isSaving} title="Reprogramar acción" aria-label={`Reprogramar ${action.title}`}>↪</button>
            </div>
          </article>)}{!dashboard && <p className="empty-state">Cargando acciones…</p>}{dashboard && actions.length === 0 && <p className="empty-state">No hay acciones para este día.</p>}</div>
        </div>}
      </section>

      <section className="block">
        <button className="block-heading" onClick={() => setOpenBlock(openBlock === "projects" ? "actions" : "projects")}><span className="block-title"><i className="dot violet" /> Bloque 2: Dominios y proyectos</span><span className="chevron">{openBlock === "projects" ? "⌃" : "⌄"}</span></button>
        {openBlock === "projects" && <div className="block-content project-list">
          <button className="add-project" onClick={() => setProjectForm({ title: "", domain: "SALUD", description: "" })}>+ Nuevo proyecto</button>
          {(dashboard?.projects ?? []).map((project) => {
            const isExpanded = expandedProjectId === project.id;
            const activeGoal = project.goals.find((goal) => goal.status === "ACTIVO");
            const pendingMilestone = project.milestones.find((milestone) => !milestone.achievedAt);
            return <article key={project.id} className={`project-card ${isExpanded ? "expanded" : ""}`}>
              <button className="project-summary" onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}><span className={`domain ${project.domain.toLowerCase()}`}>{domainLabel(project.domain)}</span><strong>{project.title}</strong><small>{pendingMilestone ? `Próximo hito: ${pendingMilestone.title}` : activeGoal ? `Objetivo: ${activeGoal.title}` : "Sin objetivo activo"}</small><b>{isExpanded ? "⌃" : "⌄"}</b></button>
              {isExpanded && <div className="project-detail">
                {project.description && <p>{project.description}</p>}
                <div className="project-actions"><button onClick={() => setProjectForm({ id: project.id, title: project.title, domain: project.domain, description: project.description ?? "" })}>Editar</button><button className="danger-link" onClick={() => void archiveProject(project)} disabled={isSaving}>Archivar</button></div>
                <section className="project-section"><header><strong>Objetivos</strong><button onClick={() => setGoalForm({ projectId: project.id, title: "", description: "", targetDate: "" })}>+ Objetivo</button></header>
                  {project.goals.map((goal) => <div className={`record-row ${goal.status === "ALCANZADO" ? "done" : ""}`} key={goal.id}><button className="mini-check" onClick={() => void toggleGoal(goal)} disabled={isSaving}>{goal.status === "ALCANZADO" ? "✓" : ""}</button><span><b>{goal.title}</b><small>{goal.targetDate ? `Meta: ${goal.targetDate}` : "Sin fecha"}</small></span><button className="text-button" onClick={() => setGoalForm({ id: goal.id, projectId: project.id, title: goal.title, description: goal.description ?? "", targetDate: goal.targetDate ?? "" })}>Editar</button></div>)}
                  {!project.goals.length && <small className="empty-inline">Todavía no hay objetivos.</small>}
                </section>
                <section className="project-section"><header><strong>Hitos</strong><button onClick={() => setMilestoneForm({ projectId: project.id, goalId: activeGoal?.id ?? "", title: "", targetDate: "" })}>+ Hito</button></header>
                  {project.milestones.map((milestone) => <div className={`record-row ${milestone.achievedAt ? "done" : ""}`} key={milestone.id}><button className="mini-check" onClick={() => void toggleMilestone(milestone)} disabled={isSaving}>{milestone.achievedAt ? "✓" : ""}</button><span><b>{milestone.title}</b><small>{milestone.targetDate ? `Fecha: ${milestone.targetDate}` : "Sin fecha"}</small></span><button className="text-button" onClick={() => setMilestoneForm({ id: milestone.id, projectId: project.id, goalId: milestone.goalId ?? "", title: milestone.title, targetDate: milestone.targetDate ?? "" })}>Editar</button></div>)}
                  {!project.milestones.length && <small className="empty-inline">Todavía no hay hitos.</small>}
                </section>
              </div>}
            </article>;
          })}
          {!dashboard && <p className="empty-state">Cargando proyectos…</p>}
        </div>}
      </section>

      <section className="block">
        <button className="block-heading" onClick={() => setOpenBlock(openBlock === "habits" ? "actions" : "habits")}><span className="block-title"><i className="dot green" /> Bloque 3: Seguimiento de hábitos</span><span className="chevron">{openBlock === "habits" ? "⌃" : "⌄"}</span></button>
        {openBlock === "habits" && <div className="block-content habits-content"><div className="habit-toolbar"><p className="rule">{(dashboard?.habits ?? []).length} de 3 activos · verde desde 70%</p><button className="text-button" onClick={() => setHabitForm({ title: "", detail: "", projectId: "", frequency: "DIARIA", scheduledDays: [0, 1, 2, 3, 4, 5, 6] })} disabled={isSaving || (dashboard?.habits ?? []).length >= 3}>+ Hábito</button></div>{(dashboard?.habits ?? []).map((habit) => {
          const scheduledDates = Array.from({ length: trackedDays }, (_, index) => isoDate(view.year, view.month, index + 1)).filter((date) => isHabitScheduled(habit, date));
          const completed = scheduledDates.filter((date) => habit.completedDates.includes(date)).length;
          const percent = scheduledDates.length ? Math.round((completed / scheduledDates.length) * 100) : 0;
          const tone = percent >= 70 ? "green" : percent >= 30 ? "amber" : "red";
          return <article className="habit" key={habit.id}><div className="habit-summary"><div><i className={`dot ${tone}`} /><strong>{habit.title}</strong><small>{habit.detail ?? (habit.frequency === "DIARIA" ? "Diario" : "Semanal")} · {completed} de {scheduledDates.length} previstos</small></div><div className="habit-actions"><b className={`percentage ${tone}`}>{percent}%</b><button className="text-button" onClick={() => setHabitForm({ id: habit.id, title: habit.title, detail: habit.detail ?? "", projectId: habit.projectId ?? "", frequency: habit.frequency, scheduledDays: habit.scheduledDays })}>Editar</button><button className="danger-link text-button" onClick={() => void archiveHabit(habit)} disabled={isSaving}>Archivar</button></div></div>{habit.frequency === "SEMANAL" && <small className="habit-frequency">{habit.scheduledDays.map((day) => weekdaysShort[day]).join(" · ")}</small>}<div className="habit-days">{Array.from({ length: daysInMonth }, (_, index) => { const day = index + 1; const date = isoDate(view.year, view.month, day); const scheduled = isHabitScheduled(habit, date); return <button key={day} onClick={() => void toggleHabit(habit, day)} disabled={isSaving || !scheduled || date > selectedDate} className={`${habit.completedDates.includes(date) ? "done" : ""} ${!scheduled ? "not-scheduled" : ""}`} aria-label={`${habit.title}, día ${day}`}>{day}</button>; })}</div></article>;
        })}{!dashboard && <p className="empty-state">Cargando hábitos…</p>}</div>}
      </section>

      <section className="block">
        <button className="block-heading" onClick={() => setOpenBlock(openBlock === "mood" ? "actions" : "mood")}><span className="block-title"><i className="dot coral" /> Bloque 4: Check-in diario</span><span className="chevron">{openBlock === "mood" ? "⌃" : "⌄"}</span></button>
        {openBlock === "mood" && <div className="block-content mood-content"><p>Registra cómo fue el día y usa las notas para guardar lo importante.</p><div className="metric-list">{([ ["energy", "Energía", "⚡"], ["friction", "Fricción", "◌"], ["motivation", "Motivación", "✦"] ] as const).map(([metric, label, icon]) => <div className="metric-row" key={metric}><span>{icon} {label}</span><div>{[1, 2, 3, 4, 5].map((value) => <button key={value} className={dashboard?.checkIn?.[metric] === value ? "active" : ""} onClick={() => void updateCheckIn({ [metric]: value })} disabled={isSaving} aria-label={`${label}: ${value}`}>{value}</button>)}</div></div>)}</div><label className="feeling-field">Sensación<select value={dashboard?.checkIn?.feeling ?? ""} onChange={(event) => void updateCheckIn({ feeling: event.target.value as Feeling })} disabled={isSaving}><option value="" disabled>Elige una sensación</option>{feelings.map((feeling) => <option key={feeling} value={feeling}>{feelingLabel[feeling]}</option>)}</select></label><form className="checkin-note" onSubmit={(event) => { event.preventDefault(); void updateCheckIn({ note: checkInNote }); }}><label>Nota personal<textarea value={checkInNote} onChange={(event) => setCheckInNote(event.target.value)} maxLength={1000} rows={2} placeholder="¿Qué influyó en tu día?" /></label><button disabled={isSaving}>Guardar check-in</button></form><section className="daily-notes"><header><strong>Notas del día</strong><button className="text-button" onClick={() => setNoteForm({ type: "NOTA", content: "" })}>+ Nota</button></header>{(dashboard?.notes ?? []).map((note) => <article className={`daily-note ${note.type.toLowerCase()}`} key={note.id}><span>{noteLabel[note.type]}</span><p>{note.content}</p><button className="text-button" onClick={() => setNoteForm({ id: note.id, type: note.type, content: note.content })}>Editar</button></article>)}{dashboard && dashboard.notes.length === 0 && <small className="empty-inline">Sin notas para este día.</small>}</section><section className="monthly-review"><header><strong>Revisión de {months[view.month].toLowerCase()}</strong><span>{dashboard?.monthlyReview.checkInDays ?? 0} check-ins</span></header><div className="review-metrics"><span>Energía <b>{dashboard?.monthlyReview.energy?.toFixed(1) ?? "—"}</b></span><span>Fricción <b>{dashboard?.monthlyReview.friction?.toFixed(1) ?? "—"}</b></span><span>Motivación <b>{dashboard?.monthlyReview.motivation?.toFixed(1) ?? "—"}</b></span></div><form onSubmit={saveMonthlyLearning}><label>Aprendizaje del mes<textarea value={learningDraft} onChange={(event) => setLearningDraft(event.target.value)} maxLength={2000} rows={3} placeholder="Qué funcionó, qué ajustarás y qué aprendiste…" /></label><button disabled={isSaving}>Guardar aprendizaje</button></form></section></div>}
      </section>
    </aside>

    <section className="calendar-area">
      <header className="calendar-header"><button className="today" onClick={goToToday}>Hoy</button><div className="month-nav"><button onClick={() => changeMonth(-1)} aria-label="Mes anterior">‹</button><button onClick={() => changeMonth(1)} aria-label="Mes siguiente">›</button></div><h2>{months[view.month]} {view.year}</h2><div className="view-switch"><button className="active">Mes</button></div></header>
      <form className="event-composer" onSubmit={addEvent}><span>Evento para el {selectedDay}</span><input value={newEvent} onChange={(event) => setNewEvent(event.target.value)} placeholder="Agregar evento…" maxLength={140} aria-label="Nuevo evento" /><select value={newEventProject} onChange={(event) => setNewEventProject(event.target.value)} aria-label="Proyecto del evento"><option value="">Sin proyecto</option>{(dashboard?.projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select><button disabled={!newEvent.trim() || isSaving}>Agregar</button></form>
      <div className="calendar-weekdays">{weekdays.map((day, index) => <div key={day} className={index === 0 || index === 6 ? "weekend-label" : ""}>{day}</div>)}</div>
      <div className="calendar-grid">{calendarCells.map((cell, index) => {
        const cellMonth = cell.month < 0 ? 11 : cell.month > 11 ? 0 : cell.month;
        const cellYear = cell.month < 0 ? view.year - 1 : cell.month > 11 ? view.year + 1 : view.year;
        const key = isoDate(cellYear, cellMonth, cell.day);
        const selected = cell.current && cell.day === selectedDay;
        const events = cell.current ? eventsByDate.get(key) ?? [] : [];
        const weekend = index % 7 === 0 || index % 7 === 6;
        return <button key={`${key}-${index}`} className={`calendar-cell ${!cell.current ? "outside" : ""} ${weekend ? "weekend" : ""} ${selected ? "selected" : ""}`} onClick={() => cell.current && setSelectedDay(cell.day)}><span className="date-number">{cell.day}</span>{cell.current && (habitDates.has(key) || actionDates.has(key) || noteDates.has(key)) && <div className="cell-status">{habitDates.has(key) && <span className="mini green" title="Hábitos cumplidos" />}{actionDates.has(key) && <span className="mini blue" title="Acciones programadas" />}{noteDates.has(key) && <span className="mini violet" title="Notas" />}</div>}<div className="events">{events.map((event) => <span key={event}>{event}</span>)}</div>{selected && <span className="cell-summary">{pendingCount} acciones · {(dashboard?.habits ?? []).length} hábitos</span>}</button>;
      })}</div>
    </section>

    {projectForm && <Modal title={projectForm.id ? "Editar proyecto" : "Nuevo proyecto"} onClose={() => setProjectForm(null)}><form className="editor-form" onSubmit={saveProject}>
      <label>Nombre<input value={projectForm.title} onChange={(event) => setProjectForm({ ...projectForm, title: event.target.value })} maxLength={100} autoFocus required /></label>
      <label>Dominio<select value={projectForm.domain} onChange={(event) => setProjectForm({ ...projectForm, domain: event.target.value as Project["domain"] })}><option value="SALUD">Salud</option><option value="TRABAJO">Trabajo</option><option value="PERSONAL">Personal</option></select></label>
      <label>Descripción <span>(opcional)</span><textarea value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} maxLength={500} rows={3} /></label>
      <footer><button type="button" className="secondary-button" onClick={() => setProjectForm(null)}>Cancelar</button><button disabled={isSaving}>Guardar proyecto</button></footer>
    </form></Modal>}

    {goalForm && <Modal title={goalForm.id ? "Editar objetivo" : "Nuevo objetivo"} onClose={() => setGoalForm(null)}><form className="editor-form" onSubmit={saveGoal}>
      <label>Objetivo<input value={goalForm.title} onChange={(event) => setGoalForm({ ...goalForm, title: event.target.value })} maxLength={140} autoFocus required /></label>
      <label>Fecha meta <span>(opcional)</span><input type="date" value={goalForm.targetDate} onChange={(event) => setGoalForm({ ...goalForm, targetDate: event.target.value })} /></label>
      <label>Descripción <span>(opcional)</span><textarea value={goalForm.description} onChange={(event) => setGoalForm({ ...goalForm, description: event.target.value })} maxLength={500} rows={3} /></label>
      <footer><button type="button" className="secondary-button" onClick={() => setGoalForm(null)}>Cancelar</button><button disabled={isSaving}>Guardar objetivo</button></footer>
    </form></Modal>}

    {milestoneForm && <Modal title={milestoneForm.id ? "Editar hito" : "Nuevo hito"} onClose={() => setMilestoneForm(null)}><form className="editor-form" onSubmit={saveMilestone}>
      <label>Hito<input value={milestoneForm.title} onChange={(event) => setMilestoneForm({ ...milestoneForm, title: event.target.value })} maxLength={140} autoFocus required /></label>
      <label>Objetivo <span>(opcional)</span><select value={milestoneForm.goalId} onChange={(event) => setMilestoneForm({ ...milestoneForm, goalId: event.target.value })}><option value="">Sin objetivo</option>{(dashboard?.projects.find((project) => project.id === milestoneForm.projectId)?.goals ?? []).map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>
      <label>Fecha objetivo <span>(opcional)</span><input type="date" value={milestoneForm.targetDate} onChange={(event) => setMilestoneForm({ ...milestoneForm, targetDate: event.target.value })} /></label>
      <footer><button type="button" className="secondary-button" onClick={() => setMilestoneForm(null)}>Cancelar</button><button disabled={isSaving}>Guardar hito</button></footer>
    </form></Modal>}

    {actionForm && <Modal title="Editar acción" onClose={() => setActionForm(null)}><form className="editor-form" onSubmit={saveActionDetails}>
      <label>Acción<input value={actionForm.title} onChange={(event) => setActionForm({ ...actionForm, title: event.target.value })} maxLength={140} autoFocus required /></label>
      <label>Tipo<select value={actionForm.type} onChange={(event) => setActionForm({ ...actionForm, type: event.target.value as ActionKind })}><option value="CLAVE">Clave</option><option value="DECISION">Decisión</option></select></label>
      <label>Proyecto<select value={actionForm.projectId ?? ""} onChange={(event) => setActionForm({ ...actionForm, projectId: event.target.value || null })}><option value="">Sin proyecto</option>{(dashboard?.projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
      <label>Fecha programada<input type="date" value={actionForm.scheduledDate} onChange={(event) => setActionForm({ ...actionForm, scheduledDate: event.target.value })} required /></label>
      <footer><button type="button" className="secondary-button" onClick={() => setActionForm(null)}>Cancelar</button><button disabled={isSaving}>Guardar cambios</button></footer>
    </form></Modal>}

    {rescheduleForm && <Modal title="Reprogramar acción" onClose={() => setRescheduleForm(null)}><form className="editor-form" onSubmit={rescheduleAction}>
      <p className="modal-note">{rescheduleForm.action.title}</p>
      <div className="quick-dates"><button type="button" onClick={() => setRescheduleForm({ ...rescheduleForm, date: offsetDateKey(rescheduleForm.action.scheduledDate, 1) })}>Mañana</button><button type="button" onClick={() => setRescheduleForm({ ...rescheduleForm, date: nextMondayKey(rescheduleForm.action.scheduledDate) })}>Próximo lunes</button></div>
      <label>Nueva fecha<input type="date" value={rescheduleForm.date} min={offsetDateKey(rescheduleForm.action.scheduledDate, 1)} onChange={(event) => setRescheduleForm({ ...rescheduleForm, date: event.target.value })} required /></label>
      <label>Motivo <span>(opcional)</span><input value={rescheduleForm.reason} onChange={(event) => setRescheduleForm({ ...rescheduleForm, reason: event.target.value })} maxLength={200} placeholder="Ej. prioridad inesperada" /></label>
      <footer><button type="button" className="secondary-button" onClick={() => setRescheduleForm(null)}>Cancelar</button><button disabled={isSaving}>Reprogramar</button></footer>
    </form></Modal>}

    {habitForm && <Modal title={habitForm.id ? "Editar hábito" : "Nuevo hábito"} onClose={() => setHabitForm(null)}><form className="editor-form" onSubmit={saveHabit}>
      <label>Hábito<input value={habitForm.title} onChange={(event) => setHabitForm({ ...habitForm, title: event.target.value })} maxLength={100} autoFocus required /></label>
      <label>Detalle <span>(opcional)</span><input value={habitForm.detail} onChange={(event) => setHabitForm({ ...habitForm, detail: event.target.value })} maxLength={200} placeholder="Ej. 20 minutos" /></label>
      <label>Proyecto <span>(opcional)</span><select value={habitForm.projectId} onChange={(event) => setHabitForm({ ...habitForm, projectId: event.target.value })}><option value="">Sin proyecto</option>{(dashboard?.projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
      <label>Frecuencia<select value={habitForm.frequency} onChange={(event) => setHabitForm({ ...habitForm, frequency: event.target.value as HabitFrequency, scheduledDays: event.target.value === "DIARIA" ? [0, 1, 2, 3, 4, 5, 6] : habitForm.scheduledDays })}><option value="DIARIA">Diaria</option><option value="SEMANAL">Semanal</option></select></label>
      {habitForm.frequency === "SEMANAL" && <fieldset className="weekday-picker"><legend>Días de la semana</legend><div>{weekdaysShort.map((day, index) => <button key={day} type="button" className={habitForm.scheduledDays.includes(index) ? "selected" : ""} onClick={() => setHabitForm({ ...habitForm, scheduledDays: habitForm.scheduledDays.includes(index) ? habitForm.scheduledDays.filter((value) => value !== index) : [...habitForm.scheduledDays, index].sort((a, b) => a - b) })}>{day}</button>)}</div></fieldset>}
      <footer><button type="button" className="secondary-button" onClick={() => setHabitForm(null)}>Cancelar</button><button disabled={isSaving}>Guardar hábito</button></footer>
    </form></Modal>}

    {noteForm && <Modal title={noteForm.id ? "Editar nota" : "Nueva nota"} onClose={() => setNoteForm(null)}><form className="editor-form" onSubmit={saveNote}>
      <label>Tipo<select value={noteForm.type} onChange={(event) => setNoteForm({ ...noteForm, type: event.target.value as NoteType })}><option value="ACCION">Acción a tomar</option><option value="NOTA">Nota</option><option value="EMOCION">Emoción</option><option value="EVENTO">Evento crítico</option></select></label>
      <label>Contenido<textarea value={noteForm.content} onChange={(event) => setNoteForm({ ...noteForm, content: event.target.value })} maxLength={1000} rows={5} autoFocus required /></label>
      <footer><button type="button" className="secondary-button" onClick={() => setNoteForm(null)}>Cancelar</button><button disabled={isSaving}>Guardar nota</button></footer>
    </form></Modal>}
  </main>;
}
