# Política de seguridad

## Secretos y datos personales

- Nunca subas `.env`, copias de seguridad, contraseñas, tokens ni URLs de conexión reales al repositorio.
- Usa valores distintos para desarrollo, pruebas y producción. El secreto de `AUTH_SECRET` debe ser aleatorio, privado y exclusivo de cada entorno.
- Las copias creadas por `scripts/backup-postgres.ps1` quedan fuera de Git; guárdalas cifradas en una ubicación privada.

## Sesiones y cuenta

- Las sesiones tienen una duración máxima de 12 horas.
- Al cambiar la contraseña, Milyfe invalida todas las sesiones existentes y pide iniciar sesión de nuevo. Usa al menos 12 caracteres y combina tres de estos grupos: mayúsculas, minúsculas, números y símbolos.
- Las rutas que modifican datos aceptan solo solicitudes JSON del mismo origen; los endpoints de la API no se almacenan en cachés compartidas.
- En un host distinto de Vercel, activa `AUTH_TRUST_HOST` únicamente detrás de un proxy que controle los encabezados de host; confiar ciegamente en ellos permitiría redirecciones manipuladas.

## Antes de desplegar

Ejecuta las comprobaciones locales y resuelve cualquier fallo antes de publicar:

```powershell
pnpm.cmd audit --prod --audit-level=high
pnpm.cmd test
pnpm.cmd typecheck
pnpm.cmd build
```

El flujo de GitHub Actions repite estas verificaciones en cada cambio a `main`, en cada pull request y semanalmente. Dependabot propone actualizaciones de dependencias; revisa sus cambios y sus verificaciones antes de integrarlos.

Consulta [DEPLOYMENT.md](DEPLOYMENT.md) para el procedimiento de copias, migraciones y configuración de producción.

## Reporte responsable

No abras una incidencia pública con secretos, datos personales o una reproducción que exponga información. Comunica el hallazgo de forma privada al propietario del repositorio, incluyendo una descripción mínima, el impacto y pasos seguros para reproducirlo.
