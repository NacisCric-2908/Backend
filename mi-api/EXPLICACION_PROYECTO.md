# Documentación Técnica Completa: API REST de Videojuegos con Node.js y Docker

Este documento detalla de manera exhaustiva la arquitectura, el funcionamiento de cada archivo y la explicación línea por línea del código fuente del proyecto **`mi-api`**.

---

## 📁 Estructura General del Proyecto

```text
mi-api/
├── .dockerignore                       # Exclusiones para el contexto de Docker
├── .gitignore                          # Exclusiones para el repositorio Git
├── 03.Guia_API_REST_NodeJS_Docker.md   # Guía base del taller
├── Dockerfile                          # Instrucciones para construir la imagen del contenedor
├── EXPLICACION_PROYECTO.md             # Esta documentación técnica
├── index.js                            # Servidor Express, datos en memoria y endpoints CRUD
├── node_modules/                       # Dependencias descargadas por npm
├── package.json                        # Manifiesto y scripts del proyecto
└── package-lock.json                   # Árbol congelado de versiones de dependencias
```

---

## 1. Configuración del Entorno y Dependencias

### 📄 `package.json`

Es el manifiesto del proyecto en Node.js. Especifica cómo se llama la aplicación, sus puntos de entrada, los comandos que podemos ejecutar y las librerías de las que depende.

```json
{
  "name": "mi-api",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "dependencies": {
    "express": "^5.2.1"
  }
}
```

#### Desglose de cada propiedad:
* **`"name": "mi-api"`**: Identificador único del paquete en el ecosistema npm.
* **`"version": "1.0.0"`**: Versión actual bajo el estándar de versionado semántico (*SemVer: Mayor.Menor.Parche*).
* **`"main": "index.js"`**: Archivo principal o punto de entrada de la aplicación.
* **`"type": "commonjs"`**: Indica que el proyecto utiliza el sistema clásico de módulos de Node.js con `require()` y `module.exports` (en contraposición a ECMAScript Modules `import/export`).
* **`"scripts"`**: Comandos abreviados para ejecutar con `npm run <nombre>` o `npm <nombre>`:
  * **`"start": "node index.js"`**: Inicia el servidor en modo producción ejecutando directamente el intérprete de Node.
  * **`"dev": "node --watch index.js"`**: Modo desarrollo. Utiliza la bandera nativa `--watch` (incorporada en versiones modernas de Node.js), la cual vigila cambios en los archivos y reinicia el servidor automáticamente al guardar, sin necesidad de librerías externas como `nodemon`.
* **`"dependencies"`**:
  * **`"express": "^5.2.1"`**: Framework HTTP minimalista. El símbolo de intercalación (`^`) permite que `npm` actualice automáticamente versiones menores o parches que no rompan compatibilidad (por ejemplo, `5.2.2` o `5.3.0`), pero previene saltar a una versión mayor que pueda cambiar la API (como `6.0.0`).

---

### 📄 `package-lock.json`

Archivo generado automáticamente por npm tras ejecutar `npm install`.

* **Propósito:** Congela las versiones exactas de cada paquete instalado y de todas sus dependencias secundarias (dependencias transitivas).
* **Determinismo:** Garantiza que si otra persona (o un contenedor Docker) ejecuta `npm install`, obtenga exactamente el mismo árbol de dependencias byte a byte.
* **Integridad:** Contiene hashes criptográficos de integridad (`integrity: sha512-...`) para asegurar que los paquetes descargados desde los servidores de npm no hayan sufrido alteraciones maliciosas.
* **Regla:** **Nunca debe modificarse a mano**.

---

### 📄 `.gitignore`

Archivo de configuración leído por Git para excluir archivos y carpetas del control de versiones.

```text
node_modules/
```

* **¿Por qué se ignora `node_modules/`?**
  1. **Peso y volumen:** Puede contener decenas de miles de archivos y cientos de megabytes.
  2. **Rendimiento:** Ralentiza operaciones de Git (`git status`, `git diff`, `git push`).
  3. **Compatibilidad:** Algunos módulos compilan binarios nativos para el sistema operativo en el que se instalan (Linux, macOS, Windows). Subirlos causaría fallos al clonar el repositorio en un sistema diferente.
  4. **Redundancia:** Con tener `package.json` y `package-lock.json`, cualquier desarrollador puede recrear `node_modules` en segundos ejecutando `npm install`.

---

## 2. Código Fuente de la Aplicación: `index.js`

El archivo `index.js` concentra toda la lógica del servidor web, el catálogo de videojuegos en memoria y la implementación de las 4 operaciones CRUD usando los métodos HTTP estándar.

A continuación se explica cada bloque de código en detalle:

---

### Bloque 1: Importación e Inicialización del Servidor

```javascript
const express = require('express');
const app = express();

// Middleware: le dice a Express que lea el cuerpo de las peticiones como JSON
app.use(express.json());
```

* **`const express = require('express');`**: Carga el módulo de Express en memoria mediante el sistema CommonJS.
* **`const app = express();`**: Invoca la función principal de Express para instanciar la aplicación web. El objeto `app` contiene métodos para configurar rutas, middlewares y escuchar puertos.
* **`app.use(express.json());`**: Registra un **middleware global**.
  * **¿Qué hace?** Intercepta todas las peticiones entrantes. Si el cliente envía una cabecera `Content-Type: application/json` (común en `POST` y `PUT`), este middleware toma el flujo de texto crudo del cuerpo HTTP, lo parsea como un objeto JavaScript válido y lo asigna a la propiedad `req.body`.
  * **Consecuencia:** Sin esta línea, `req.body` siempre sería `undefined`.

---

### Bloque 2: Definición de Datos en Memoria (Colección de Videojuegos)

```javascript
// ─── CATÁLOGO DE VIDEOJUEGOS EN MEMORIA ─────────────────────────
let juegos = [
  {
    id: 1,
    titulo: 'The Legend of Zelda: Breath of the Wild',
    genero: 'Aventura / Acción',
    plataforma: 'Nintendo Switch',
    año: 2017,
    disponible: true
  },
  {
    id: 2,
    titulo: 'Elden Ring',
    genero: 'Action RPG',
    plataforma: 'PC / PS5 / Xbox Series X',
    año: 2022,
    disponible: true
  },
  {
    id: 3,
    titulo: 'God of War Ragnarök',
    genero: 'Acción / Aventura',
    plataforma: 'PS4 / PS5',
    año: 2022,
    disponible: false
  }
];

// Contador para asignar IDs autoincrementales a nuevos registros
let nextId = 4;
// ─────────────────────────────────────────────────────────────────
```

* **`let juegos = [...]`**: Un arreglo que actúa como base de datos simulada en memoria RAM.
* **Modelo del objeto `juego`**:
  * `id` *(Number)*: Identificador único del juego.
  * `titulo` *(String)*: Nombre comercial del título.
  * `genero` *(String)*: Clasificación temática del videojuego.
  * `plataforma` *(String)*: Consolas o sistemas en los que se puede jugar.
  * `año` *(Number)*: Año de lanzamiento internacional.
  * `disponible` *(Boolean)*: Bandera que indica si está activo/disponible para adquisición o préstamo.
* **`let nextId = 4;`**: Variable numérica autoincremental que simula la secuencia primaria de una base de datos relacional para garantizar que los nuevos elementos nunca colisionen en su identificador.

---

### Bloque 3: Endpoint `GET /juegos` (Leer todos)

```javascript
// GET /juegos — Obtener todos los videojuegos
app.get('/juegos', (req, res) => {
  res.json(juegos);
});
```

* **Método HTTP:** `GET`. Se usa para solicitar y recuperar recursos sin producir efectos secundarios ni modificaciones en el servidor.
* **Ruta:** `/juegos`.
* **Parámetros:**
  * `req` (*Request*): Objeto que contiene los datos de la petición del cliente (cabeceras, parámetros, etc.).
  * `res` (*Response*): Objeto para construir y emitir la respuesta hacia el cliente.
* **`res.json(juegos)`**: Serializa el arreglo `juegos` a una cadena JSON, establece la cabecera `Content-Type: application/json; charset=utf-8` y envía la respuesta con el código HTTP por defecto **`200 OK`**.

---

### Bloque 4: Endpoint `GET /juegos/:id` (Leer uno por ID)

```javascript
// GET /juegos/:id — Obtener un videojuego por ID
app.get('/juegos/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const juego = juegos.find(j => j.id === id);

  if (!juego) {
    return res.status(404).json({ error: `No se encontró el videojuego con id ${id}` });
  }

  res.json(juego);
});
```

* **Parámetro dinámico `:id`**: Expresa una variable en la URL. Express lo captura y lo expone en el objeto `req.params`.
* **`parseInt(req.params.id, 10)`**: Todo lo que llega por URL es de tipo *String*. Debe convertirse a número entero en base 10 para poder comparar con el atributo numérico `id`.
* **`juegos.find(j => j.id === id)`**: Función de orden superior de JavaScript que recorre el arreglo y retorna el primer elemento que cumpla la condición. Si no encuentra nada, retorna `undefined`.
* **Control de flujo y código de error:**
  * Si `juego` no existe (`!juego`), se corta la ejecución con `return res.status(404).json(...)`. El código **`404 Not Found`** le informa al cliente que el recurso solicitado no está en el servidor.
  * Si existe, responde con el objeto y código **`200 OK`**.

---

### Bloque 5: Endpoint `POST /juegos` (Crear un nuevo videojuego)

```javascript
// POST /juegos — Registrar un nuevo videojuego
app.post('/juegos', (req, res) => {
  const { titulo, genero, plataforma, año, disponible } = req.body;

  // Validación básica: campos obligatorios
  if (!titulo || !genero || !plataforma) {
    return res.status(400).json({
      error: 'Los campos titulo, genero y plataforma son obligatorios'
    });
  }

  const nuevoJuego = {
    id: nextId++,
    titulo,
    genero,
    plataforma,
    año: año ? parseInt(año, 10) : null,
    disponible: disponible !== undefined ? Boolean(disponible) : true
  };

  juegos.push(nuevoJuego);
  res.status(201).json(nuevoJuego);
});
```

* **Método HTTP:** `POST`. Destinado a la creación de un nuevo recurso subordinado a la colección `/juegos`.
* **Desestructuración de `req.body`**: Extrae de forma limpia las propiedades enviadas por el cliente en el JSON.
* **Validación de campos obligatorios:**
  * Si falta `titulo`, `genero` o `plataforma`, responde con **`400 Bad Request`**. Esto protege la integridad de los datos evitando registros vacíos.
* **Construcción del nuevo registro:**
  * `id: nextId++`: Asigna el ID actual y de inmediato incrementa el contador para la próxima inserción.
  * Normaliza `año` a entero o `null`.
  * Normaliza `disponible` a booleano con valor predeterminado en `true`.
* **`juegos.push(nuevoJuego)`**: Agrega el nuevo elemento al final del arreglo en memoria.
* **`res.status(201).json(nuevoJuego)`**: Responde con el código estándar **`201 Created`**, devolviendo el objeto completo con su nuevo `id` asignado.

---

### Bloque 6: Endpoint `PUT /juegos/:id` (Actualizar un videojuego)

```javascript
// PUT /juegos/:id — Actualizar un videojuego existente
app.put('/juegos/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = juegos.findIndex(j => j.id === id);

  if (index === -1) {
    return res.status(404).json({ error: `No se encontró el videojuego con id ${id}` });
  }

  const { titulo, genero, plataforma, año, disponible } = req.body;

  if (!titulo || !genero || !plataforma) {
    return res.status(400).json({
      error: 'Los campos titulo, genero y plataforma son obligatorios'
    });
  }

  juegos[index] = {
    id,
    titulo,
    genero,
    plataforma,
    año: año ? parseInt(año, 10) : juegos[index].año,
    disponible: disponible !== undefined ? Boolean(disponible) : juegos[index].disponible
  };

  res.json(juegos[index]);
});
```

* **Método HTTP:** `PUT`. En arquitectura REST representa el **reemplazo completo** del recurso en la ubicación indicada por el `:id`.
* **`juegos.findIndex(...)`**: Busca la posición ordinal del juego en el arreglo. Si el elemento no existe, devuelve `-1`.
* **Validaciones:**
  1. Si `index === -1`, retorna **`404 Not Found`**.
  2. Si el cuerpo de la petición no contiene los campos obligatorios, retorna **`400 Bad Request`**.
* **Reemplazo seguro:** Se reescribe la posición `juegos[index]` asegurando conservar el `id` original de la URL y sobreescribiendo los atributos con los nuevos datos.
* **Respuesta:** Código **`200 OK`** con el objeto modificado.

---

### Bloque 7: Endpoint `DELETE /juegos/:id` (Eliminar un videojuego)

```javascript
// DELETE /juegos/:id — Eliminar un videojuego
app.delete('/juegos/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = juegos.findIndex(j => j.id === id);

  if (index === -1) {
    return res.status(404).json({ error: `No se encontró el videojuego con id ${id}` });
  }

  const eliminado = juegos.splice(index, 1)[0];
  res.json({ mensaje: 'Videojuego eliminado exitosamente', eliminado });
});
```

* **Método HTTP:** `DELETE`. Solicita la eliminación permanente del recurso identificado por `:id`.
* **`juegos.splice(index, 1)`**: Modifica el arreglo in-situ eliminando `1` elemento a partir de la posición `index`. Devuelve un arreglo con los elementos removidos.
* **`[0]`**: Extrae el objeto individual eliminado.
* **Respuesta:** Código **`200 OK`** con un mensaje informativo y el objeto eliminado para verificación del cliente.

---

### Bloque 8: Configuración del Puerto y Escucha Activa

```javascript
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎮 API de Videojuegos corriendo en http://localhost:${PORT}`);
});
```

* **`process.env.PORT || 3000`**: Lee el puerto desde las variables de entorno del sistema (`process.env.PORT`). Si no se definió ninguna variable en el sistema operativo o contenedor, utiliza el puerto `3000` como valor de respaldo predeterminado.
* **`app.listen(PORT, callback)`**: Levanta el socket TCP del servidor para empezar a aceptar tráfico HTTP en el puerto indicado y ejecuta el callback de confirmación una vez que el servicio está listo.

---

## 3. Contenedores y Despliegue con Docker

### 📄 `.dockerignore`

```text
node_modules
```

* **Función:** Análogo a `.gitignore`, pero utilizado por el demonio de Docker (`dockerd`).
* **Propósito:** Evita que la carpeta local `node_modules` de tu máquina host sea copiada al contexto de construcción de la imagen. Esto fuerza a que las librerías se instalen de forma limpia y nativa dentro del contenedor Linux.

---

### 📄 `Dockerfile`

Es la receta paso a paso para construir la imagen del contenedor:

```dockerfile
# 1. Imagen base oficial ligera de Node.js basada en Alpine Linux
FROM node:20-alpine

# 2. Directorio de trabajo interno en el contenedor
WORKDIR /app

# 3. Copiar manifiestos de dependencias
COPY package*.json ./

# 4. Instalar únicamente dependencias de producción
RUN npm install --omit=dev

# 5. Copiar el archivo del servidor
COPY index.js ./

# 6. Exponer el puerto
EXPOSE 3000

# 7. Comando de ejecución
CMD ["node", "index.js"]
```

#### Explicación línea por línea:

1. **`FROM node:20-alpine`**:
   * Descarga la imagen base oficial de Node.js versión 20 construida sobre **Alpine Linux**. Alpine es una distribución ultraligera y segura (pesa menos de 50 MB en comparación con los cientos de MB de una distribución basada en Debian/Ubuntu).
2. **`WORKDIR /app`**:
   * Establece el directorio de trabajo predeterminado dentro del contenedor. Todas las siguientes instrucciones (`COPY`, `RUN`, `CMD`) se ejecutarán relativas a `/app`.
3. **`COPY package*.json ./`**:
   * Copia `package.json` y `package-lock.json` desde el host hacia `/app` dentro del contenedor.
4. **`RUN npm install --omit=dev`**:
   * Ejecuta la instalación dentro del contenedor. La opción `--omit=dev` omite dependencias de desarrollo no requeridas en producción, reduciendo el tamaño final de la imagen.
   * **Patrón de optimización por capas:** Copiar los manifiestos antes que el código fuente (`index.js`) permite aprovechar el sistema de caché de Docker. Si cambias el código en `index.js`, Docker no repetirá el `npm install`, haciendo que la recompilación tome milisegundos.
5. **`COPY index.js ./`**:
   * Copia el código fuente del servidor al contenedor.
6. **`EXPOSE 3000`**:
   * Instrucción informativa/documental que declara que el contenedor escucha peticiones en el puerto `3000`.
7. **`CMD ["node", "index.js"]`**:
   * Comando por defecto que se ejecutará cuando el contenedor inicie (`docker run`). La sintaxis en forma de arreglo (*exec form*) ejecuta el proceso directamente como PID 1, permitiendo el manejo adecuado de señales del sistema operativo (como `SIGTERM` o `Ctrl+C`).

---

## 4. Comandos de Gestión y Operación en Docker

### 1. Construir la imagen
```bash
docker build -t mi-api:1.0 .
```
* `-t mi-api:1.0`: Asigna el nombre `mi-api` y la etiqueta (*tag*) `1.0`.
* `.`: Especifica el directorio actual como contexto de construcción.

### 2. Ejecutar el contenedor
```bash
docker run -d -p 3000:3000 --name mi-api-container mi-api:1.0
```
* `-d` (*detached*): Corre el contenedor en segundo plano.
* `-p 3000:3000`: Mapea el puerto `3000` de la máquina física al puerto `3000` interno del contenedor.
* `--name mi-api-container`: Le da un nombre legible al contenedor para manipularlo con facilidad.

### 3. Verificar estado y logs
```bash
# Ver contenedores activos
docker ps

# Ver la salida por consola del contenedor
docker logs mi-api-container
```

### 4. Detener y reiniciar
```bash
# Detener el contenedor
docker stop mi-api-container

# Eliminar el contenedor
docker rm mi-api-container
```

---

## 5. Resumen de Métodos HTTP y Códigos de Estado

### Tabla de Endpoints

| Método | Ruta | Cuerpo Requerido | Descripción | Código Éxito | Códigos Error |
|---|---|---|---|---|---|
| **GET** | `/juegos` | No | Devuelve todos los juegos | `200 OK` | `500` |
| **GET** | `/juegos/:id` | No | Devuelve un juego por su ID | `200 OK` | `404 Not Found` |
| **POST** | `/juegos` | Sí (`JSON`) | Registra un nuevo juego | `201 Created` | `400 Bad Request` |
| **PUT** | `/juegos/:id` | Sí (`JSON`) | Modifica un juego existente | `200 OK` | `400` / `404` |
| **DELETE** | `/juegos/:id` | No | Elimina un juego por su ID | `200 OK` | `404 Not Found` |

### Códigos de Estado Usados y su Significado

* **`200 OK`**: La solicitud fue exitosa y el servidor devuelve los datos solicitados.
* **`201 Created`**: La solicitud fue exitosa y un nuevo recurso fue creado en el servidor.
* **`400 Bad Request`**: El cliente envió datos inválidos o incompletos (por ejemplo, si faltan campos obligatorios).
* **`404 Not Found`**: El recurso con el ID especificado no existe en la colección.
* **`500 Internal Server Error`**: Ocurrió un error inesperado no controlado dentro del código del servidor.

---

## 6. Pruebas de Funcionamiento con `curl`

Puedes probar la API (tanto en local como en Docker) ejecutando los siguientes comandos en tu terminal:

```bash
# 1. Obtener todos los videojuegos
curl -s http://localhost:3000/juegos

# 2. Obtener un videojuego existente
curl -s http://localhost:3000/juegos/2

# 3. Intentar obtener un videojuego inexistente (espera 404)
curl -s -i http://localhost:3000/juegos/999

# 4. Crear un nuevo videojuego
curl -s -X POST http://localhost:3000/juegos \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Super Mario Odyssey","genero":"Plataformas","plataforma":"Nintendo Switch","año":2017,"disponible":true}'

# 5. Actualizar un videojuego existente
curl -s -X PUT http://localhost:3000/juegos/3 \
  -H "Content-Type: application/json" \
  -d '{"titulo":"God of War Ragnarök - Valhalla","genero":"Acción / Aventura","plataforma":"PS4 / PS5 / PC","año":2022,"disponible":true}'

# 6. Eliminar un videojuego
curl -s -X DELETE http://localhost:3000/juegos/1
```
