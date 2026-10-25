# Mini chat en tiempo real con WebSocket

Demo de la presentación sobre la API **WebSocket**.
Integrantes: Juan Diego Grajales, Juan Pablo Sarmiento y Jan Sánchez.

## 1. ¿Qué es WebSocket y qué hace esta demo?

WebSocket es un protocolo (RFC 6455) que abre **una sola conexión TCP persistente**
entre el navegador y el servidor. La conexión empieza como una petición HTTP normal
que pide "cambiar de protocolo" (`Upgrade: websocket`); el servidor responde
**101 Switching Protocols** y desde ese momento ambos lados pueden enviarse mensajes
**en cualquier dirección y en cualquier momento**, sin recargar la página y sin
sondeo (*polling*).

La demo es un mini chat:

- El servidor (Node.js + librería `ws`) entrega la página y atiende el WebSocket en el **mismo puerto**.
- Al conectarse, cada cliente recibe **"Hola mundo!"** del servidor (el servidor habla primero).
- Cada mensaje que escribe un cliente se reenvía a **todos** los conectados (*broadcast*).
- El servidor avisa por iniciativa propia cuando alguien entra o sale y cuántos hay conectados.
- Un latido **ping/pong cada 30 s** cierra las conexiones muertas.
- El cliente muestra si está conectado y **reintenta con espera creciente** (1 s, 2 s, 4 s… máx. 30 s) si el servidor se cae.
- El servidor rechaza mensajes que no sean JSON válido o que superen **1 KB**.

Todos los mensajes viajan en JSON con la forma:

```json
{ "tipo": "chat | sistema", "autor": "Ana", "texto": "Hola", "hora": "2026-10-21T13:38:22.890Z" }
```

### Archivos

| Archivo | Para qué sirve |
|---|---|
| `server.js` | Servidor HTTP + WebSocket (proceso 1) |
| `public/index.html` | Cliente: HTML, CSS y JS (se abre en cada navegador) |
| `.env.example` | Plantilla de variables de entorno |
| `package.json` | Dependencias y script `npm start` |

## 2. Requisitos previos

- **Node.js 18 o superior** (probado con Node.js 24). Verifica con `node -v`.
- Dos navegadores o dos pestañas (Chrome, Firefox, Edge…).

## 3. Instalación de dependencias

```bash
npm install
```

- **`ws`**: implementa el servidor WebSocket en Node.js (handshake, tramas, ping/pong).
- **`dotenv`**: lee el archivo `.env` y carga sus valores en `process.env`.

## 4. Variables de entorno

Copia la plantilla:

```bash
cp .env.example .env
```

| Variable | Ejemplo | Qué significa |
|---|---|---|
| `PORT` | `8080` | Puerto donde escucha el servidor (HTTP y WebSocket comparten puerto). |
| `WS_URL` | `ws://localhost:8080` | URL a la que se conecta el navegador. El servidor la inyecta en `index.html`, así no está escrita a mano. Si cambias `PORT`, cambia también el puerto aquí. |

> Si falta alguna variable, el servidor no arranca y muestra un mensaje explicando qué hacer.

## 5. Cómo ejecutar

```bash
npm start
```

Debe aparecer:

```
Servidor listo en http://localhost:8080
Los clientes se conectarán a ws://localhost:8080
```

## 6. Cómo probar, paso a paso

**a) Saludo del servidor.** Abre <http://localhost:8080> en dos navegadores (o dos pestañas).
En cada uno aparece *"Hola mundo!"* y el aviso *"Se conectó un usuario. Conectados: N"*.
El indicador de arriba a la derecha dice **Conectado** en verde.

**b) Mensajes al instante.** Escribe tu nombre y un mensaje en el navegador A y pulsa *Enviar*.
El mensaje aparece de inmediato en el navegador B, sin recargar la página.

**c) Una sola conexión (sin sondeo).** En uno de los navegadores abre DevTools (`F12`) →
pestaña **Red / Network** → filtro **WS** y recarga la página. Verás **una sola petición**
con estado **101 Switching Protocols**. Haz clic en ella y abre la pestaña **Mensajes / Messages**:
las tramas que subes (flecha verde ↑) y las que bajan del servidor (flecha roja ↓) aparecen
todas sobre esa misma conexión. No hay peticiones nuevas cada pocos segundos: no hay *polling*.

**d) Reconexión.** En la terminal del servidor pulsa `Ctrl + C`. Los navegadores cambian a
**Desconectado · reintento en 1 s**, luego 2 s, 4 s… Vuelve a ejecutar `npm start`: en el
siguiente reintento el cliente se reconecta solo y recibe otra vez el *"Hola mundo!"*.

> Extra: el otro navegador recibe *"Se desconectó un usuario"* cuando cierras una pestaña.

## 7. Explicación de `server.js`

El servidor está dividido en seis partes, en el mismo orden en que aparecen en el archivo.

### 7.1 Importaciones

```js
import { WebSocketServer, WebSocket } from 'ws';
import 'dotenv/config';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
```

- `WebSocketServer` crea el servidor WebSocket. `WebSocket` se usa para la constante
  `WebSocket.OPEN`, que indica que una conexión está abierta.
- `dotenv/config` lee el archivo `.env` apenas se importa y llena `process.env`.
- `http` es el módulo nativo de Node.js que entrega la página.
- `readFile` lee `public/index.html` del disco.

### 7.2 Configuración

```js
const PORT = Number(process.env.PORT);
const WS_URL = process.env.WS_URL;
if (!PORT || !WS_URL) { /* mensaje de error */ process.exit(1); }
const TAMANO_MAXIMO = 1024;
const INTERVALO_LATIDO = 30_000;
```

- El puerto y la URL salen **solo** de las variables de entorno: en el código no hay
  ningún valor fijo. `Number(...)` convierte el texto `"8080"` en número.
- Si falta alguna variable, el servidor se detiene con un mensaje claro en lugar de
  fallar más adelante sin explicar por qué.
- `TAMANO_MAXIMO` (1 KB) e `INTERVALO_LATIDO` (30 s) son las reglas de la demo.

### 7.3 Funciones de ayuda

```js
function crearMensaje(tipo, autor, texto) {
  return JSON.stringify({ tipo, autor, texto, hora: new Date().toISOString() });
}
function difundir(mensaje) {
  for (const c of wss.clients) {
    if (c.readyState === WebSocket.OPEN) c.send(mensaje);
  }
}
```

- `crearMensaje` arma siempre el mismo formato `{ tipo, autor, texto, hora }` y lo
  convierte a texto JSON, porque por el WebSocket viajan cadenas, no objetos.
- `difundir` es el **broadcast**: `wss.clients` es el conjunto de todas las conexiones
  activas, y solo se envía a las que están abiertas (`OPEN`). Así evitamos escribir en
  una conexión que se está cerrando.

### 7.4 Servidor HTTP: entrega la página

```js
const servidorHttp = http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const html = await readFile(new URL('./public/index.html', import.meta.url), 'utf8');
    const pagina = html.replace('"__WS_URL__"', JSON.stringify(WS_URL));
    // responde 200 con la página
  }
  // cualquier otra ruta responde 404
});
```

- Cuando el navegador pide `/`, el servidor lee `index.html` y **reemplaza** el texto
  `"__WS_URL__"` por el valor real de `WS_URL`. Por eso la URL no está escrita a mano
  en el HTML: si cambia el `.env`, cambia la página.
- `JSON.stringify(WS_URL)` agrega las comillas para que el resultado sea JavaScript válido:
  `const WS_URL = "ws://localhost:8080";`.
- Este es el **paso 1** de la demo: una petición HTTP normal (el `GET /`).

### 7.5 Servidor WebSocket: el corazón de la demo

```js
const wss = new WebSocketServer({ server: servidorHttp });
```

Se le pasa el servidor HTTP para que ambos **compartan el puerto**. Cuando llega una
petición con `Upgrade: websocket`, la librería `ws` hace el *handshake*, responde
**101 Switching Protocols** y la conexión queda abierta. Desde ahí, cada conexión
nueva dispara el evento `connection` con su propio `socket`:

```js
wss.on('connection', (socket) => {
```

Dentro de ese evento pasan cinco cosas:

1. **Prepara el latido.** `socket.estaVivo = true` marca la conexión como viva, y cada vez
   que el cliente responde un `pong` se vuelve a marcar (ver 7.6).
2. **Saluda.** `socket.send(crearMensaje('sistema', 'servidor', 'Hola mundo!'))` envía el
   saludo **solo** al que acaba de conectarse. Aquí el servidor habla primero, sin que el
   cliente haya pedido nada: esto no se puede hacer con HTTP normal.
3. **Avisa a todos.** `difundir(...)` anuncia la nueva conexión con el total
   `wss.clients.size`. Es otro mensaje que el servidor envía por iniciativa propia.
4. **Recibe, valida y reenvía.** `socket.on('message', (data) => { ... })` se ejecuta cada
   vez que ese cliente envía algo. `data` llega como bytes (un `Buffer`):
   - si `data.length > TAMANO_MAXIMO`, responde *"supera 1 KB"* solo a ese cliente y no sigue;
   - intenta `JSON.parse(data.toString())`; si falla, responde *"no es JSON válido"*;
   - si no trae un `texto` con contenido, también lo rechaza;
   - si todo está bien, arma el mensaje con `tipo: 'chat'`, el autor que mandó el cliente
     (o `'anónimo'`) y la hora del servidor, y lo reenvía a todos con el ciclo
     `for (const c of wss.clients)`, igual al de la diapositiva.

   El tipo y la hora los pone el servidor, no el cliente, para que nadie pueda hacerse
   pasar por un mensaje de `sistema` ni falsear la hora.
5. **Avisa cuando alguien se va.** `socket.on('close', ...)` se dispara cuando el cliente
   cierra la pestaña o se cae la conexión; el servidor avisa a los que quedan con el
   nuevo total. En ese momento la librería ya sacó el socket de `wss.clients`, por eso
   el número es el correcto.

### 7.6 Latido (ping/pong)

```js
const latido = setInterval(() => {
  for (const c of wss.clients) {
    if (c.estaVivo === false) { c.terminate(); continue; }
    c.estaVivo = false;
    c.ping();
  }
}, INTERVALO_LATIDO);
```

Si un cliente pierde la red de golpe (se apaga el wifi, se suspende el portátil), el
servidor no se entera: la conexión queda "abierta" pero muerta. El latido lo resuelve:

- Cada 30 s, el servidor marca cada conexión como `estaVivo = false` y le envía un **ping**.
- El navegador responde automáticamente con un **pong**, y el evento `pong` vuelve a poner
  `estaVivo = true`.
- En la siguiente vuelta, si una conexión sigue en `false` es porque no respondió en 30 s:
  `terminate()` la cierra a la fuerza, lo que también dispara el aviso de desconexión.

`wss.on('close', () => clearInterval(latido))` detiene el temporizador si el servidor
WebSocket se cierra.

### 7.7 Arranque

```js
servidorHttp.listen(PORT, () => { console.log(...); });
```

Se pone a escuchar **un solo** servidor en `PORT`. Como el WebSocket está montado sobre
él, con esta línea quedan activos la página (`http://`) y el chat (`ws://`) a la vez.
