# STRONGBOX ClicCoin V2.21

Juego individual de descubrir la clave secreta en el tablero. La versión incorpora 50 niveles divididos en 5 bloques, economía de ClicCoin para miembros, ranking protegido, publicidad para visitantes y membresías.

## 50 niveles y 5 bloques
- Bloque 1: niveles 1-10 · claves de 2 cifras · Saco de dinero · premio de bloque +200 ClicCoin.
- Bloque 2: niveles 11-20 · claves de 3 cifras · Lingote de plata · premio de bloque +300 ClicCoin.
- Bloque 3: niveles 21-30 · claves de 4 cifras · Lingote de oro · premio de bloque +400 ClicCoin.
- Bloque 4: niveles 31-40 · claves de 4 cifras · Esmeraldas · premio de bloque +500 ClicCoin.
- Bloque 5: niveles 41-50 · claves de 5 cifras · Diamante · premio de bloque +600 ClicCoin.
- Tiempos por nivel: 55, 50, 45, 40, 35, 30, 25, 20, 15 y 10 segundos, repitiéndose en cada bloque.
- Recompensa de nivel: +10 ClicCoin por cada nivel. Si falla, se descuentan exactamente −10 ClicCoin.
- Si un miembro falla, se descuenta exactamente la recompensa de ese nivel.
- Si un miembro completa un nivel, se suma su recompensa; al completar el nivel 10, 20, 30, 40 o 50 se suma además el premio especial del bloque.
- Al llegar a 0 ClicCoin, el miembro queda bloqueado hasta el siguiente día de Bogotá y recibe 100 ClicCoin al nuevo día.
- El saldo de ClicCoin sí se guarda en la base de datos y alimenta el Ranking Millonario.

## Progreso
- El nivel actual NO se guarda en la base de datos.
- El progreso se mantiene temporalmente en `sessionStorage` mientras la sesión del navegador esté activa.
- El servidor también mantiene el nivel de la sesión en memoria para impedir saltos de nivel, sin persistirlo en `server-data.json`.
- Si se pierde un nivel, se conserva el mismo nivel.
- Solo al superar el nivel se desbloquea el siguiente.
- Visitantes pueden jugar hasta el nivel 30 (3 bloques), sin sumar ClicCoin y sin ranking.
- Miembros pueden jugar hasta el nivel 50.

## Recompensas visuales
Incluye iconos dedicados para Saco de dinero, Lingote de plata, Lingote de oro, Esmeraldas y Diamante en `assets/`.

## Ejecutar
`node server.js`

## Admin
Código demo: `CM-ADMIN-2026`

## Enlaces Nequi
Configurar antes de producción:
- `NEQUI_MONTH_URL` para $6.000 COP / mes
- `NEQUI_YEAR_URL` para $49.000 COP / año

La activación queda pendiente hasta que el administrador confirme el pago. Al activar se genera un código y el panel prepara un correo de confirmación.
