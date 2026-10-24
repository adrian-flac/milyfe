"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";

type ActionKind = "CLAVE" | "DECISION";
type ActionState = "PENDIENTE" | "COMPLETADA" | "POSPUESTA";
type Feeling = "EXCELENTE" | "BIEN" | "NEUTRAL" | "BAJO" | "MAL";
type Action = { id: string; title: string; type: ActionKind; status: ActionState; projectId: string | null; project: string; scheduledDate: string; rescheduleCount: number };
type Habit = { id: string; title: string; detail: string | null; completedDates: string[] };
type Goal = { id: string; title: string; description: string | null; status: "ACTIVO" | "ALCANZADO" | "ABANDONADO"; targetDate: string | null };
type Milestone = { id: string; goalId: string | null; title: string; targetDate: string | null; achievedAt: string | null };
type Project = { id: string; title: string; domain: "SALUD" | "TRABAJO" | "PERSONAL"; description: string | null; status: "ACTIVO" | "COMPLETADO" | "ARCHIVADO"; goals: Goal[]; milestones: Milestone[] };
type Dashboard = {
  actions: Action[]; actionDates: string[]; projects: Project[]; habits: Habit[]; habitDates: string[];
  events: { id: string; title: string; date: string }[];
  checkIn: { energy: number | null; friction: number | null; motivation: number | null; feeling: Feeling | null } | null;
};

const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const weekdays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const feelings: Feeling[] = ["EXCELENTE", "BIEN", "NEUTRAL", "BAJO", "MAL"];
const feelingLabel: Record<Feeling, string> = { EXCELENTE: "Excelente", BIEN: "Bien", NEUTRAL: "Neutral", BAJO: "Bajo", MAL: "Mal" };

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
  const pendingCount = actions.filter((action) => action.status === "PENDIENTE").length;
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const trackedDays = Math.min(selectedDay, daysInMonth);

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
    try {
      setIsSaving(true);
      await api(`/api/habits/${habit.id}`, { method: "PATCH", body: JSON.stringify({ date, completed: !habit.completedDates.includes(date) }) });
      await loadDashboard();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo actualizar el hábito.");
    } finally { setIsSaving(false); }
  }

  async function updateCheckIn(data: Record<string, number | Feeling>) {
    try {
      setIsSaving(true);
      await api("/api/check-in", { method: "PATCH", body: JSON.stringify({ date: selectedDate, ...data }) });
      await loadDashboard();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo guardar el check-in.");
    } finally { setIsSaving(false); }
  }

  function cycleMetric(metric: "energy" | "friction" | "motivation") {
    const current = dashboard?.checkIn?.[metric] ?? 0;
    void updateCheckIn({ [metric]: current >= 5 ? 1 : current + 1 });
  }

  function cycleFeeling() {
    const current = dashboard?.checkIn?.feeling;
    const index = current ? feelings.indexOf(current) : -1;
    void updateCheckIn({ feeling: feelings[(index + 1) % feelings.length] });
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
        {openBlock === "habits" && <div className="block-content habits-content"><p className="rule">Máximo 3 activos · verde desde 70%</p>{(dashboard?.habits ?? []).map((habit) => {
          const completed = habit.completedDates.filter((date) => Number(date.slice(-2)) <= trackedDays).length;
          const percent = trackedDays ? Math.round((completed / trackedDays) * 100) : 0;
          const tone = percent >= 70 ? "green" : percent >= 30 ? "amber" : "red";
          return <article className="habit" key={habit.id}><div className="habit-summary"><div><i className={`dot ${tone}`} /><strong>{habit.title}</strong><small>{habit.detail ?? "Diario"} · {completed} de {trackedDays} días</small></div><b className={`percentage ${tone}`}>{percent}%</b></div><div className="habit-days">{Array.from({ length: daysInMonth }, (_, index) => { const day = index + 1; const date = isoDate(view.year, view.month, day); return <button key={day} onClick={() => void toggleHabit(habit, day)} disabled={isSaving} className={habit.completedDates.includes(date) ? "done" : ""} aria-label={`${habit.title}, día ${day}`}>{day}</button>; })}</div></article>;
        })}{!dashboard && <p className="empty-state">Cargando hábitos…</p>}</div>}
      </section>

      <section className="block">
        <button className="block-heading" onClick={() => setOpenBlock(openBlock === "mood" ? "actions" : "mood")}><span className="block-title"><i className="dot coral" /> Bloque 4: Check-in diario</span><span className="chevron">{openBlock === "mood" ? "⌃" : "⌄"}</span></button>
        {openBlock === "mood" && <div className="block-content mood-content"><p>Haz clic para rotar de 1 a 5 y guardar cada métrica.</p><div className="mood-grid"><button onClick={() => cycleMetric("energy")} disabled={isSaving}>⚡<small>Energía {dashboard?.checkIn?.energy ?? "—"}</small></button><button onClick={() => cycleMetric("friction")} disabled={isSaving}>◌<small>Fricción {dashboard?.checkIn?.friction ?? "—"}</small></button><button onClick={() => cycleMetric("motivation")} disabled={isSaving}>✦<small>Motivación {dashboard?.checkIn?.motivation ?? "—"}</small></button><button onClick={cycleFeeling} disabled={isSaving}>☺<small>{dashboard?.checkIn?.feeling ? feelingLabel[dashboard.checkIn.feeling] : "Sensación"}</small></button></div></div>}
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
        return <button key={`${key}-${index}`} className={`calendar-cell ${!cell.current ? "outside" : ""} ${weekend ? "weekend" : ""} ${selected ? "selected" : ""}`} onClick={() => cell.current && setSelectedDay(cell.day)}><span className="date-number">{cell.day}</span>{cell.current && (habitDates.has(key) || actionDates.has(key)) && <div className="cell-status">{habitDates.has(key) && <span className="mini green" title="Hábitos cumplidos" />}{actionDates.has(key) && <span className="mini blue" title="Acciones programadas" />}</div>}<div className="events">{events.map((event) => <span key={event}>{event}</span>)}</div>{selected && <span className="cell-summary">{pendingCount} acciones · {(dashboard?.habits ?? []).length} hábitos</span>}</button>;
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
  </main>;
}
