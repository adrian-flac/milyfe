# 🚀 Life OS & Personal Agenda

Un sistema integral de gestión personal y de vida (*Life OS*) diseñado para fusionar la planificación temporal de un calendario moderno con un control quirúrgico de hábitos, proyectos, energía y ejecución diaria.

---

## 🧭 Filosofía y Enfoque de Diseño

Este proyecto no es una simple agenda de eventos; es un **Panel de Control (Cockpit) Ejecutivo** que centraliza la navegación en un mapa temporal amplio (estilo Google Calendar) mientras mantiene los bloques estratégicos de desarrollo personal organizados en un panel lateral modular y colapsable.

---

## 🧱 Arquitectura de Bloques (Core Features)

### 1. Bloque 1: Sistema de Acciones Diarias (Top 6)
* **Enfoque:** Previene la parálisis por sobrecarga limitando las tareas clave del día.
* **Estados de Actividad:**
  * 🔵 **Clave:** La tarea central del día.
  * 🟠 **Pospuesta:** Pendientes retrasados que requieren análisis o reprogramación.
  * 🟣 **Decisión:** Puntos críticos que bloquean el avance de un proyecto.

### 2. Bloque 2: Arquitectura del Calendario y Dominios de Vida
* **Calendario Central Cockpit:** Actúa como mapa principal de navegación temporal y visualización de progreso.
* **Diferenciación de Fines de Semana:** Sábados y domingos cuentan con un sombreado visual para separar el ritmo operativo del descanso.
* **Dominios de Vida:**
  * **Salud:** Seguimiento de *Pasos*, *Sueño*, *Entrenamiento* y *Lectura*.
  * **Económico:** División entre *Trabajo* (proyectos profesionales/académicos) y *Personal*.
* **Jerarquía de Crecimiento:** Objetivos a largo plazo, hitos (*milestones*) alcanzados y reflexiones/aprendizajes mensuales.

### 3. Bloque 3: Motor de Seguimiento de Hábitos
* **Dinámica:** Integrado directamente en el flujo mensual (recomendado: máximo **3 hábitos activos** por mes).
* **Sistema de Semáforo (Porcentajes):**
  * 🟢 **Verde (> 70%):** Hábito consolidado exitosamente.
  * 🟡 **Ámbar (30% - 70%):** Zona de fricción o atención.
  * 🔴 **Rojo (< 30%):** Alerta de abandono.
* **Regla de Progresión:** 3 meses consecutivos en verde desbloquean la capacidad de incorporar un nuevo hábito.

### 4. Bloque 4: Gestión de Notas y Ánimo
* **Notas por Código de Colores:**
  * 🔵 **Azul:** Acciones a tomar.
  * ⚫ **Negro:** Notas generales / información de referencia.
  * 🟢 **Verde:** Pensamientos relacionados con emociones y bienestar.
  * 🔴 **Rojo:** Eventos críticos o fechas límite.
* **Check-in Diario de Rendimiento:**
  * Medición de **Energía**, **Fricción**, **Motivación** y **Sensación** general.

---

## 🛠️ Stack Tecnológico

El proyecto está diseñado bajo una arquitectura web moderna full-stack:
* **Frontend:** React (Next.js con App Router) + Tailwind CSS para una interfaz limpia, minimalista y responsiva (inspirada en Notion y Google Calendar).
* **Backend:** Next.js Server Actions / API Routes (Node.js/TypeScript).
* **Base de Datos:** PostgreSQL.
* **ORM:** Prisma para la gestión segura y tipada de modelos de datos.
* **Autenticación:** Auth.js (NextAuth) para seguridad y privacidad de usuarios.

---

## 🗄️ Esquema de Base de Datos (Prisma Model)

El modelo relacional subyacente soporta la estructura modular de la aplicación:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id            String              @id @default(cuid())
  email         String              @unique
  name          String?
  dailyLogs     DailyLog[]
  habits        Habit[]
  notes         Note[]
  reflections   MonthlyReflection[]
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
}

model DailyLog {
  id           String        @id @default(cuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  date         DateTime      @db.Date
  energy       Int?          // 1 al 5
  friction     Int?          // 1 al 5
  motivation   Int?          // 1 al 5
  sensation    String?
  actions      Action[]
  health       HealthMetric?

  @@unique([userId, date])
}

enum ActionStatus {
  CLAVE
  POSPUESTA
  DECISION
}

model Action {
  id          String       @id @default(cuid())
  dailyLogId  String
  dailyLog    DailyLog     @relation(fields: [dailyLogId], references: [id], onDelete: Cascade)
  title       String
  status      ActionStatus @default(CLAVE)
  completed   Boolean      @default(false)
  order       Int
}

model HealthMetric {
  id           String    @id @default(cuid())
  dailyLogId   String    @unique
  dailyLog     DailyLog  @relation(fields: [dailyLogId], references: [id], onDelete: Cascade)
  steps        Int       @default(0)
  sleepHours   Float     @default(0.0)
  workoutDone  Boolean   @default(false)
  readingPages Int       @default(0)
}

model MonthlyReflection {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  monthYear   String   // "YYYY-MM"
  goals       String?
  milestones  String?
  learning    String?

  @@unique([userId, monthYear])
}

model Habit {
  id          String      @id @default(cuid())
  userId      String
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  title       String
  monthYear   String
  active      Boolean     @default(true)
  logs        HabitLog[]
}

model HabitLog {
  id        String   @id @default(cuid())
  habitId   String
  habit     Habit    @relation(fields: [habitId], references: [id], onDelete: Cascade)
  date      DateTime @db.Date
  completed Boolean  @default(false)

  @@unique([habitId, date])
}

enum NoteType {
  BLUE_ACTION
  BLACK_NOTE
  GREEN_EMOTION
  RED_EVENT
}

model Note {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date      DateTime @default(now()) @db.Date
  type      NoteType @default(BLACK_NOTE)
  content   String
}