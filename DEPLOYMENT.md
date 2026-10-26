# Despliegue seguro y continuidad de datos

Este procedimiento conserva los datos que ya tienes en PostgreSQL local. `prisma migrate deploy` cambia el esquema, pero **no copia tus datos** a una base cloud.

## Variables y mínimos privilegios

Configura los secretos exclusivamente en el proveedor de despliegue; nunca en Git.

- `DATABASE_URL`: conexión TLS del runtime con un usuario de aplicación sin permisos de crear, alterar o eliminar tablas.
- `DIRECT_URL`: conexión TLS de un usuario de migración con permisos DDL. No la registres como variable normal de Preview o Production en Vercel: esos valores pueden estar disponibles para funciones en ejecución. Úsala desde una terminal controlada o un paso de CI con secreto exclusivo para migraciones.
- `AUTH_SECRET`: valor aleatorio de 32 bytes o más, estable entre despliegues.
- `AUTH_TRUST_HOST=true`: no es necesario en Vercel; para otro hosting úsalo **solo** si un proxy de confianza normaliza los encabezados `Host` y `X-Forwarded-*` al dominio público. No lo actives en un servidor expuesto directamente a encabezados arbitrarios.
- `APP_OWNER_EMAIL`: el correo de tu cuenta existente.
- `ALLOW_REGISTRATION=false`: valor recomendado para tu agenda personal.
- `BOOTSTRAP_TOKEN`: no lo configures si ya reclamaste tu cuenta. Solo sirve para una instalación nueva y debe eliminarse inmediatamente después.

El proveedor debe ofrecer TLS, copias automáticas con recuperación a un momento anterior (PITR) y acceso de red restringido a Vercel o a IPs explícitamente autorizadas. No expongas PostgreSQL a Internet abierto.

## 1. Copia local verificable

Con PostgreSQL instalado, desde la raíz del proyecto ejecuta:

```powershell
.\scripts\backup-postgres.ps1
```

El script obtiene `DATABASE_URL` desde `.env`, crea una copia en `backups/` —ignorada por Git— y usa `pg_restore --list` para comprobar su integridad. Conserva ese archivo fuera del repositorio y cifrado si lo mueves a otro servicio.

No continúes si la copia no termina con `Copia verificada`.

## 2. Restaurar en una base cloud vacía

1. Crea una base PostgreSQL administrada vacía y con TLS. Crea el usuario de migraciones y el usuario de aplicación según las funciones de tu proveedor.
2. Cierra la aplicación local durante la copia final para evitar que aparezcan cambios que no estén en el backup.
3. Crea una copia nueva con el comando anterior.
4. Restaura **solo en la base cloud vacía**. No uses `--clean` ni ejecutes este comando sobre una base que tenga datos:

   ```powershell
   pg_restore --no-owner --no-acl --dbname="$env:DIRECT_URL" .\backups\milyfe-AAAAMMDD-HHMMSS.backup
   ```

5. En una terminal controlada, asigna temporalmente `DATABASE_URL` a la URL cloud de runtime y `DIRECT_URL` a la de migración. Después valida que se restauraron esquema, historial de Prisma y conteos sin mostrar datos personales:

   ```powershell
   pnpm.cmd db:deploy
   pnpm.cmd db:verify
   ```

`db:deploy` debe indicar que no quedan migraciones pendientes. `db:verify` muestra únicamente cantidades y migraciones aplicadas.

## 3. Desplegar y comprobar

1. Sube el código y crea el proyecto en Vercel.
2. Antes del despliegue, aplica `pnpm.cmd db:deploy` desde la terminal controlada. En Vercel añade solo las variables de runtime: `DATABASE_URL`, `AUTH_SECRET`, `APP_OWNER_EMAIL` y `ALLOW_REGISTRATION=false`.
3. Usa este comando de build:

   ```text
   pnpm build
   ```

4. Despliega, inicia sesión y comprueba que los conteos y una muestra de proyectos, hábitos, acciones y notas coincidan con tu instalación local.
5. Activa los backups automáticos/PITR del proveedor y realiza una restauración de prueba al menos una vez antes de depender de la aplicación.

## Reversión segura

No restaures un backup sobre producción para arreglar un fallo de interfaz. Primero vuelve al despliegue anterior y conserva la base cloud intacta. Solo restaura una copia tras confirmar el destino, la hora del backup y una ventana de mantenimiento. Conserva la copia local original hasta haber usado producción sin incidencias.
