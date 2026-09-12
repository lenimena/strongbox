# Despliegue de STRONGBOX en Render

## 1. Código
Sube esta carpeta a un repositorio de GitHub y conecta el repositorio a Render como **Web Service**.

## 2. Configuración
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/healthz`

## 3. Variables de entorno
Configura en Render:
- `ADMIN_CODE` = un código de administrador fuerte (no uses el demo en producción).
- `NEQUI_MONTH_URL` = `https://checkout.nequi.wompi.co/l/8FuLeo`
- `NEQUI_YEAR_URL` = `https://checkout.nequi.wompi.co/l/cV1z6Y`
- `DATA_DIR` = `/var/data`

## 4. Persistencia (IMPORTANTE)
STRONGBOX guarda miembros, ClicCoin, suscripciones y anuncios en archivos locales. Render usa un filesystem efímero por defecto, por lo que **sin almacenamiento persistente se perderán cambios al reiniciar o desplegar**.

Para producción, conecta un **Persistent Disk** al Web Service y usa `/var/data` como mount path. El archivo `server-data.json` y las imágenes de publicidad quedarán dentro de ese directorio.

Si usas el plan Free sin Persistent Disk, la aplicación puede funcionar para pruebas, pero no debes usarla como producción porque los datos persistentes no están garantizados.

## 5. Primer despliegue
Después de crear el servicio, abre la URL `https://TU-SERVICIO.onrender.com/healthz`. Debe responder:

`{"ok":true,"service":"strongbox"}`

Luego abre la raíz `/`.
