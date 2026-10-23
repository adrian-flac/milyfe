"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type ActionKind = "CLAVE" | "DECISION";
type ActionState = "PENDIENTE" | "COMPLETADA" | "POSPUESTA";
type Feeling = "EXCELENTE" | "BIEN" | "NEUTRAL" | "BAJO" | "MAL";
type Action = { id: string; title: string; type: ActionKind; status: ActionState; project: string };
type Habit = { id: string; title: string; detail: string | null; completedDates: string[] };
type Project = { id: string; title: string; domain: "SALUD" | "TRABAJO" | "PERSONAL"; goal: string | null; milestone: string | null };
type Dashboard = {
  actions: Action[]; actionDates: string[]; projects: Project[]; habits: Habit[]; habitDates: string[];
  events: { id: string; title: string; date: string }[];
  checkIn: { energy: number | null; friction: number | null; motivation: number | null; feeling: Feeling | null } | null;
};

const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const weekdays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const feelings: Feeling[] = ["EXCELENTE", "BIEN", "NEUTRAL", "BAJO", "MAL"];
const feelingLabel: Record<Feeling, string> = { EXCELENTE: "Excelente", BIEN: "Bien", NEUTRAL: "Neutral", BAJO: "Bajo", MAL: "Mal" };

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateLabel(year: number, month: number, day: number) {
  return `${day} de ${months[month].toLowerCase()} de ${year}`;
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
          <div className="action-list">{actions.map((action) => <article key={action.id} className={`action-row ${action.status === "COMPLETADA" ? "is-complete" : ""}`}>
            <button className="check" onClick={() => void updateAction(action.id, action.status === "COMPLETADA" ? "PENDIENTE" : "COMPLETADA")} disabled={isSaving} aria-label={`Cambiar estado de ${action.title}`}>{action.status === "COMPLETADA" ? "✓" : ""}</button>
            <div className="action-copy"><strong>{action.title}</strong><small>{action.project}</small></div><span className={`kind-tag ${action.type.toLowerCase()}`}>{action.type === "CLAVE" ? "Clave" : "Decisión"}</span>
            <button className={`state-dot ${action.status.toLowerCase()}`} onClick={() => void updateAction(action.id, action.status === "POSPUESTA" ? "PENDIENTE" : "POSPUESTA")} disabled={isSaving} title="Posponer / reactivar">{action.status === "POSPUESTA" ? "↻" : ""}</button>
          </article>)}{!dashboard && <p className="empty-state">Cargando acciones…</p>}{dashboard && actions.length === 0 && <p className="empty-state">No hay acciones para este día.</p>}</div>
        </div>}
      </section>

      <section className="block">
        <button className="block-heading" onClick={() => setOpenBlock(openBlock === "projects" ? "actions" : "projects")}><span className="block-title"><i className="dot violet" /> Bloque 2: Dominios y proyectos</span><span className="chevron">{openBlock === "projects" ? "⌃" : "⌄"}</span></button>
        {openBlock === "projects" && <div className="block-content project-list">{(dashboard?.projects ?? []).map((project) => <div key={project.id}><span className={`domain ${project.domain.toLowerCase()}`}>{domainLabel(project.domain)}</span><strong>{project.title}</strong><small>{project.milestone ? `Próximo hito: ${project.milestone}` : project.goal ? `Objetivo: ${project.goal}` : "Sin objetivo definido"}</small></div>)}{!dashboard && <p className="empty-state">Cargando proyectos…</p>}</div>}
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
  </main>;
}
