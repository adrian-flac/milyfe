import "dotenv/config";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL no está configurada.");
}

const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();
  const [migrations, counts] = await Promise.all([
    client.query('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at ASC'),
    client.query('SELECT (SELECT COUNT(*) FROM "User") AS users, (SELECT COUNT(*) FROM "Project") AS projects, (SELECT COUNT(*) FROM "Action") AS actions, (SELECT COUNT(*) FROM "Habit") AS habits, (SELECT COUNT(*) FROM "Note") AS notes'),
  ]);

  const summary = counts.rows[0];
  console.log(`Migraciones aplicadas: ${migrations.rowCount}`);
  console.log(`Registros verificados — usuarios: ${summary.users}, proyectos: ${summary.projects}, acciones: ${summary.actions}, hábitos: ${summary.habits}, notas: ${summary.notes}`);
} finally {
  await client.end();
}
