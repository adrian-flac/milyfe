const test = require("node:test");
const assert = require("node:assert/strict");
const { dayFromKey } = require("../.test-build/dates.js");
const { completedGreenMonthStreak, habitMonthProgress } = require("../.test-build/habit-progress.js");

test("rechaza fechas que JavaScript normalizaría", () => {
  assert.throws(() => dayFromKey("2026-02-31"), /no es válida/);
  assert.equal(dayFromKey("2028-02-29").toISOString().slice(0, 10), "2028-02-29");
});

test("calcula progreso y racha de meses verdes", () => {
  const habit = { frequency: "DIARIA", scheduledDays: [0, 1, 2, 3, 4, 5, 6], startedAt: dayFromKey("2026-01-01") };
  const entries = [];
  for (const month of [1, 2, 3]) {
    for (let day = 1; day <= 22; day += 1) entries.push({ date: dayFromKey(`2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`), completed: true });
  }
  assert.ok(habitMonthProgress(habit, entries, dayFromKey("2026-01-01")).percentage >= 70);
  assert.equal(completedGreenMonthStreak(habit, entries, dayFromKey("2026-04-20")), 3);
});
