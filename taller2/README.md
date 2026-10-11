# Documentación Integral - Sistema de Microservicios con Docker y Sequelize (Taller 2)

Arquitectura de microservicios desarrollada con **Node.js**, **Express**, **Sequelize (ORM)** y **PostgreSQL**, orquestada de forma integral con **Docker Compose**. El sistema gestiona tres dominios de negocio (Clientes, Productos y Compras), implementando comunicación inter-servicios vía HTTP, arquitectura modular por capas y los cuatro métodos HTTP principales (`GET`, `POST`, `PUT`, `DELETE`).

---

## Tabla de Contenidos
1. [Arquitectura General](#1-arquitectura-general)
2. [Estructura del Proyecto](#2-estructura-del-proyecto)
3. [Explicación Detallada de Archivos y Código](#3-explicación-detallada-de-archivos-y-código)
   - [Base de Datos e Inicialización (`init.sql`)](#31-base-de-datos-e-inicialización-initsql)
   - [Capa de Conexión y Configuración (`config/database.js`)](#32-capa-de-conexión-y-configuración-configdatabasejs)
   - [Modelos ORM con Sequelize (`models/`)](#33-modelos-orm-con-sequelize-models)
   - [Controladores y Lógica de Negocio (`controllers/`)](#34-controladores-y-lógica-de-negocio-controllers)
   - [Servicios de Comunicación Inter-Servicios (`services/`)](#35-servicios-de-comunicación-inter-servicios-services)
   - [Enrutamiento y Middlewares (`routes/` y `app.js`)](#36-enrutamiento-y-middlewares-routes-y-appjs)
   - [Punto de Entrada del Servidor (`server.js`)](#37-punto-de-entrada-del-servidor-serverjs)
4. [Análisis Detallado de Dockerfiles (Multi-stage)](#4-análisis-detallado-de-dockerfiles-multi-stage)
5. [Análisis Detallado de Docker Compose](#5-análisis-detallado-de-docker-compose)
   - [Entorno de Desarrollo (`docker-compose.yml`)](#51-entorno-de-desarrollo-docker-composeyml)
   - [Entorno de Producción (`docker-compose.production.yml`)](#52-entorno-de-producción-docker-composeproductionyml)
6. [Puesta en Marcha con Docker Compose](#6-puesta-en-marcha-con-docker-compose)
7. [Verificación de Conexiones y Health Checks](#7-verificación-de-conexiones-y-health-checks)
8. [Guía de Pruebas con Postman (CRUD y Orquestación)](#8-guía-de-pruebas-con-postman)
   - [Configuración Inicial en Postman](#configuración-inicial-en-postman)
   - [Pruebas en cliente-api (Puerto 3001)](#1-microservicio-cliente-api-puerto-3001)
   - [Pruebas en producto-api (Puerto 3002)](#2-microservicio-producto-api-puerto-3002)
   - [Pruebas en compra-api (Puerto 3003 - Orquestador)](#3-microservicio-compra-api-puerto-3003---orquestador)
9. [Equivalencia con comandos cURL](#9-equivalencia-con-comandos-curl)
10. [Solución de Problemas Comunes (Troubleshooting)](#10-solución-de-problemas-comunes-troubleshooting)
11. [Persistencia de Datos y Comandos Útiles de Docker](#11-persistencia-de-datos-y-comandos-útiles-de-docker)

---

## 1. Arquitectura General

El sistema divide el dominio de un e-commerce en tres microservicios autónomos y desacoplados junto con una base de datos PostgreSQL:

```text
                      +-----------------------------------+
                      |       Cliente HTTP (Postman)       |
                      +-----------------+-----------------+
                                        |
               +------------------------+------------------------+
               |                        |                        |
               v (CRUD HTTP)            v (CRUD HTTP)            v (POST /compras, CRUD)
      +-----------------+      +-----------------+      +-----------------+
      |   cliente-api   |      |  producto-api   |      |   compra-api    |
      |  (Puerto 3001)  |      |  (Puerto 3002)  |      |  (Puerto 3003)  |
      +--------+--------+      +--------+--------+      +--------+--------+
               |                        |                        |
               |                        |   HTTP GET (validar)   |
               |                        |<-----------------------|
               |<------------------------------------------------+
               |                        |
               v                        v                        v
     +---------------------------------------------------------------------+
     |                     PostgreSQL (postgres:17)                        |
     |                       Base: taller2_db                              |
     |                Tablas: cliente, producto, compra                    |
     +---------------------------------------------------------------------+
```

### Flujo de Orquestación en `compra-api`
Cuando un cliente solicita registrar una compra (`POST /compras`):
1. **Validación de payload**: Verifica campos requeridos (`clienteId`, `productoId`, `cantidad`).
2. **Validación inter-servicio (HTTP GET)**:
   - Consulta `cliente-api` (`GET http://cliente-api:3001/clientes/:id`) para verificar que el cliente exista.
   - Consulta `producto-api` (`GET http://producto-api:3002/productos/:id`) para verificar que el producto exista y cuente con stock suficiente (`stock >= cantidad`).
3. **Manejo de Respuestas**:
   - Si el cliente no existe $\rightarrow$ `404 Not Found`.
   - Si el producto no existe $\rightarrow$ `404 Not Found`.
   - Si el stock es insuficiente $\rightarrow$ `400 Bad Request`.
   - Si alguno de los servicios destino está caído $\rightarrow$ `503 Service Unavailable`.
   - Si todo es correcto $\rightarrow$ Registra la compra en la base de datos vía Sequelize y responde con `201 Created`.

---

## 2. Estructura del Proyecto

Cada microservicio implementa una **arquitectura por capas** con **Sequelize**:

```text
taller2/
├── docker-compose.yml             # Orquestación de contenedores y networking
├── init.sql                       # DDL y semillas iniciales de PostgreSQL
├── .env                           # Variables de entorno locales
├── .env.example                   # Plantilla de variables de entorno
│
├── cliente-api/                   # Microservicio: Gestión de Clientes (Puerto 3001)
│   ├── dockerfile                 # Imagen Docker Node.js
│   ├── package.json               # Dependencias (express, sequelize, pg, pg-hstore, dotenv)
│   └── src/
│       ├── config/database.js     # Conexión Sequelize con PostgreSQL
│       ├── models/cliente.js      # Modelo Sequelize (tabla 'cliente')
│       ├── controllers/clienteController.js # Lógica CRUD (4 métodos HTTP)
│       ├── routes/clientes.routes.js        # Mapeo de rutas HTTP
│       ├── app.js                 # Middlewares Express y Health Check
│       └── server.js              # Inicialización y sincronización de modelos
│
├── producto-api/                  # Microservicio: Catálogo de Productos (Puerto 3002)
│   ├── dockerfile
│   ├── package.json
│   └── src/
│       ├── config/database.js
│       ├── models/producto.js     # Modelo Sequelize (tabla 'producto')
│       ├── controllers/productoController.js # Lógica CRUD (4 métodos HTTP)
│       ├── routes/productos.routes.js
│       ├── app.js
│       └── server.js
│
└── compra-api/                    # Microservicio: Orquestador de Compras (Puerto 3003)
    ├── dockerfile
    ├── package.json
    └── src/
        ├── config/database.js
        ├── models/compra.js       # Modelo Sequelize (tabla 'compra')
        ├── services/
        │   ├── clienteService.js  # Cliente HTTP saliente hacia cliente-api
        │   └── productoService.js # Cliente HTTP saliente hacia producto-api
        ├── controllers/compraController.js  # Validación y lógica de compras (CRUD)
        ├── routes/compras.routes.js
        ├── app.js
        └── server.js
```

---

## 3. Explicación Detallada de Archivos y Código

El proyecto sigue una **arquitectura en capas** desacoplada donde cada microservicio es responsable de su dominio y expone endpoints REST, interactuando con PostgreSQL mediante **Sequelize ORM** y comunicándose entre sí mediante peticiones HTTP.

### 3.1. Base de Datos e Inicialización (`init.sql`)

El archivo [`init.sql`](./init.sql) es el script DDL y DML ejecutado automáticamente por el contenedor de PostgreSQL durante su primera inicialización (montado en `/docker-entrypoint-initdb.d/init.sql`).

- **DDL (Estructura de Tablas)**:
  - `cliente`: Almacena `id_cliente` (SERIAL, PK), `nombre` (VARCHAR NOT NULL) y `email` (VARCHAR UNIQUE NOT NULL).
  - `producto`: Almacena `id_producto` (SERIAL, PK), `nombre`, `precio` (NUMERIC(10,2)) y `stock` (INT CHECK `stock >= 0`). La restricción `CHECK` previene a nivel de base de datos stocks negativos.
  - `compra`: Almacena `id_compra` (SERIAL, PK), `id_cliente` (FK referenciando a `cliente` con `ON DELETE CASCADE`), `id_producto` (FK referenciando a `producto` con `ON DELETE CASCADE`), `fecha` (TIMESTAMP con default `CURRENT_TIMESTAMP`) y `cantidad` (INT CHECK `cantidad > 0`).
- **DML (Semillas)**:
  - Inserta 5 registros predeterminados por tabla usando `ON CONFLICT (...) DO NOTHING` para evitar duplicados si el script se reejecuta.
- **Sincronización de Secuencias (`SELECT setval(...)`)**:
  - Al insertar IDs manualmente (1 al 5), los generadores automáticos (`SERIAL`) quedan desfasados. Con `SELECT setval('tabla_id_seq', MAX(id))` se calibra la secuencia al ID más alto para que las futuras creaciones no colisionen con error de clave duplicada.

---

### 3.2. Capa de Conexión y Configuración (`config/database.js`)

Cada microservicio gestiona su propia instancia de conexión con el pool de PostgreSQL a través de [`config/database.js`](./cliente-api/src/config/database.js):

```javascript
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'taller2_db',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD !== undefined ? String(process.env.DB_PASSWORD) : 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: false, // Desactiva logs SQL verbosos en consola
  }
);

module.exports = sequelize;
```

- **Variables de Entorno**: Lee la configuración dinámicamente mediante `process.env`. Dentro de Docker Compose, `DB_HOST` se resuelve como `postgres` (nombre del servicio en la red interna).
- **Conexión Resiliente**: Evita quemar credenciales en el código y permite alternar sin cambios entre desarrollo local (`localhost`) y contenedor (`postgres`).

---

### 3.3. Modelos ORM con Sequelize (`models/`)

Los modelos representan las entidades de la base de datos de manera orientada a objetos:

1. **`cliente-api/src/models/cliente.js`**:
   - Define el modelo `Cliente` asociado a la tabla `'cliente'`.
   - Campos: `id_cliente` (clave primaria, auto-incremental), `nombre`, `email` (único, validado).
   - Configura `timestamps: false` para acoplarse exactamente a las tablas SQL sin requerir columnas `createdAt` o `updatedAt`.
2. **`producto-api/src/models/producto.js`**:
   - Define el modelo `Producto` (`id_producto`, `nombre`, `precio`, `stock`).
   - Implementa validaciones integradas en Sequelize como `validate: { min: 0 }` para el stock.
3. **`compra-api/src/models/compra.js`**:
   - Define el modelo `Compra` (`id_compra`, `id_cliente`, `id_producto`, `fecha`, `cantidad`).
   - Valida que la cantidad mínima sea 1 (`validate: { min: 1 }`).

---

### 3.4. Controladores y Lógica de Negocio (`controllers/`)

Los controladores reciben `req` y `res`, procesan las reglas de negocio y ejecutan operaciones contra la base de datos:

- **Operaciones CRUD Completas**:
  - `obtenerTodos`: Ejecuta `Model.findAll({ order: [['id_...', 'ASC']] })` retornando estado `200`.
  - `obtenerUno`: Ejecuta `Model.findByPk(id)`. Si no existe, retorna `404 Not Found`.
  - `crear`: Valida presencia de campos obligatorios (`400 Bad Request`). En caso de conflicto de clave única (como email repetido), captura `SequelizeUniqueConstraintError` y responde con `409 Conflict`. Si es exitoso, responde con `201 Created`.
  - `actualizar`: Localiza el registro con `findByPk(id)`. Si no existe retorna `404`. Aplica `registro.update(...)` con los datos enviados y retorna `200 OK`.
  - `eliminar`: Localiza el registro y llama a `registro.destroy()`, retornando confirmación `200 OK`.

- **Controlador Especial de Compras (`compraController.js`)**:
  - Antes de registrar una compra, actúa como orquestador consumiendo servicios externos:
    1. Verifica que vengan `clienteId`, `productoId` y `cantidad > 0`.
    2. Invoca concurrentemente o en serie a `obtenerCliente()` y `obtenerProducto()`.
    3. Si algún servicio HTTP falla por desconexión o timeout, atrapa la excepción y retorna un código `503 Service Unavailable`.
    4. Si el cliente o el producto no existen en sus respectivos servicios, responde `404 Not Found`.
    5. Si el stock del producto es menor que la cantidad requerida, deniega la compra con `400 Bad Request`.
    6. Superadas todas las validaciones, persiste la compra mediante `Compra.create(...)` y responde `201 Created`.

---

### 3.5. Servicios de Comunicación Inter-Servicios (`services/`)

Exclusivos de `compra-api`, aíslan las llamadas HTTP salientes usando la API nativa `fetch` de Node.js:

- **[`clienteService.js`](./compra-api/src/services/clienteService.js)**:
  ```javascript
  async function obtenerCliente(id) {
    const url = process.env.CLIENTE_API_URL || 'http://localhost:3001';
    const respuesta = await fetch(`${url}/clientes/${id}`);
    if (respuesta.status === 404) return null;
    if (!respuesta.ok) throw new Error(`cliente-api respondió con estado ${respuesta.status}`);
    return respuesta.json();
  }
  ```
  Permite validar en tiempo real la existencia de un cliente en `cliente-api` sin acoplar bases de datos directamente.
- **[`productoService.js`](./compra-api/src/services/productoService.js)**:
  Consulta `GET ${PRODUCTO_API_URL}/productos/${id}` para inspeccionar precio y stock disponible antes de emitir una transacción.

---

### 3.6. Enrutamiento y Middlewares (`routes/` y `app.js`)

- **Rutas (`*.routes.js`)**:
  - Mapean los verbos estándar HTTP (`GET`, `POST`, `PUT`, `DELETE`) hacia las funciones correspondientes del controlador usando `express.Router()`.
- **Aplicación Express (`app.js`)**:
  - Registra el middleware `express.json()` para parsear cuerpos de petición JSON.
  - Expone una ruta raíz de diagnóstico (`GET /`) que ejecuta una consulta de prueba a PostgreSQL (`SELECT NOW() AS now`) para verificar conectividad con la base de datos de manera inmediata (Health Check a nivel de aplicación).
  - Monta las rutas de la entidad (`/clientes`, `/productos` o `/compras`).

---

### 3.7. Punto de Entrada del Servidor (`server.js`)

El archivo `server.js` orquesta el encendido de cada microservicio:
1. Invoca `sequelize.authenticate()` para comprobar que las credenciales y el host de base de datos sean válidos.
2. Invoca `sequelize.sync({ alter: true })` para garantizar que el esquema de base de datos coincida con las definiciones de los modelos.
3. Levanta la escucha HTTP con `app.listen(PORT)` informando en consola el puerto activo.
4. En caso de error fatal de conexión, captura la excepción y finaliza el proceso con `process.exit(1)`, lo que permite a Docker detectar la caída y reiniciar el contenedor según la política `restart`.

---

## 4. Análisis Detallado de Dockerfiles (Multi-stage)

Cada microservicio cuenta con un [`dockerfile`](./cliente-api/dockerfile) que implementa una estrategia **Multi-stage Build** (construcción multietapa) utilizando la imagen base oficial `node:24`:

```dockerfile
# ==========================================
# ETAPA 1: development
# ==========================================
FROM node:24 AS development

WORKDIR /app

# Copia solo los manifiestos primero para aprovechar la caché de capas de Docker
COPY package*.json ./

# Instala todas las dependencias (incluyendo devDependencies como nodemon)
RUN npm install

# Copia el resto del código fuente
COPY . .

EXPOSE 3001

ENV NODE_ENV=development

# Ejecuta el servidor con nodemon (recarga en caliente al detectar cambios)
CMD ["npm", "run", "dev"]

# ==========================================
# ETAPA 2: production
# ==========================================
FROM node:24 AS production

WORKDIR /app

COPY package*.json ./

# npm ci garantiza instalaciones deterministas y --omit=dev excluye nodemon y herramientas pesadas
RUN npm ci --omit=dev

COPY . .

EXPOSE 3001

ENV NODE_ENV=production

# Ejecuta directamente con Node.js sin sobrecosto de herramientas de desarrollo
CMD ["npm", "run", "start"]
```

### Claves del diseño del Dockerfile:
1. **Aprovechamiento de la Caché (`Layer Caching`)**:
   - `COPY package*.json ./` y `RUN npm install` se ejecutan **antes** de copiar el código fuente (`COPY . .`). Si modificas un controlador o ruta, Docker **no vuelve a descargar los paquetes `npm`**, acelerando las construcciones a milisegundos.
2. **Multi-stage (`development` vs `production`)**:
   - En la etapa `development`, se instalan librerías como `nodemon` y se habilita el monitoreo de cambios en caliente.
   - En la etapa `production`, el comando `npm ci --omit=dev` produce una imagen mucho más ligera y segura, omitiendo herramientas que no deben estar en servidores productivos.
3. **Uso de `.dockerignore`**:
   - Excluye `node_modules` locales, logs y archivos `.env` locales para evitar que la máquina anfitriona contamine el contenedor o exponga credenciales.

---

## 5. Análisis Detallado de Docker Compose

El proyecto ofrece dos configuraciones de orquestación según el ciclo de vida:

### 5.1. Entorno de Desarrollo (`docker-compose.yml`)

Este archivo está optimizado para la experiencia del desarrollador:

```yaml
services:
  cliente-api:
    build:
      context: ./cliente-api
      dockerfile: dockerfile
      target: development       # Utiliza la etapa 'development' del Dockerfile
    ports:
      - "${CLIENTE_PORT:-3001}:3001"
    environment:
      - DB_HOST=postgres       # Resuelve al servicio de Postgres por DNS interno
      - DB_PORT=5432
      - DB_NAME=${DB_NAME:-taller2_db}
      - DB_USER=${DB_USER:-postgres}
      - DB_PASSWORD=${DB_PASSWORD:-postgres}
      - PORT=3001
    volumes:
      - ./cliente-api:/app      # Montaje en caliente (Bind mount): cambios locales se reflejan al instante
      - /app/node_modules       # Volumen anónimo para proteger las dependencias compiladas dentro del contenedor
    depends_on:
      postgres:
        condition: service_healthy # Espera hasta que Postgres pase su healthcheck
    restart: unless-stopped
```

#### Aspectos Clave de Desarrollo:
- **Bind Mounts (`volumes: ./servicio:/app`)**: Vincula el directorio de tu máquina al contenedor. Al guardar un archivo en VS Code o tu editor, `nodemon` lo detecta y reinicia el servicio dentro de Docker sin tener que reconstruir la imagen.
- **Volumen anónimo (`/app/node_modules`)**: Evita que el `node_modules` de tu sistema anfitrión sobreescriba el `node_modules` de Linux dentro del contenedor.
- **Healthcheck y Sincronización de Arranque**:
  ```yaml
  postgres:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres} -d ${DB_NAME:-taller2_db}"]
      interval: 5s
      timeout: 5s
      retries: 5
  ```
  Los microservicios usan `depends_on: { postgres: { condition: service_healthy } }`. Esto evita el problema habitual donde las APIs fallan al arrancar porque Postgres aún no terminó de iniciar.
- **Service Discovery (Networking Interno)**:
  `compra-api` se comunica con `cliente-api` y `producto-api` mediante sus variables de entorno de red interna:
  ```yaml
  - CLIENTE_API_URL=http://cliente-api:3001
  - PRODUCTO_API_URL=http://producto-api:3002
  ```

---

### 5.2. Entorno de Producción (`docker-compose.production.yml`)

Diseñado para despliegues reales o pruebas de rendimiento:

- **`target: production`**: Selecciona la etapa productiva del Dockerfile (`npm ci --omit=dev`).
- **Sin Bind Mounts**: El código queda empaquetado de forma inmutable dentro de la imagen, garantizando consistencia y mayor velocidad I/O.
- **Inicio directo con `node src/server.js`**: Sin sobrecargas de procesos observadores como nodemon.

---

## 6. Puesta en Marcha con Docker Compose

Docker Compose compila las imágenes de los tres microservicios, crea la base de datos PostgreSQL, aplica el script inicial `init.sql` y conecta todo bajo una misma red privada.

### Paso 1: Levantar los servicios
Desde la carpeta raíz `taller2/`, ejecuta:

```bash
docker compose up -d --build
```

> **¿Qué hace este comando?**
> - Construye las imágenes de `cliente-api`, `producto-api` y `compra-api`.
> - Descarga e inicia la base de datos `postgres:17-alpine`.
> - Ejecuta automáticamente el archivo `init.sql` para crear las tablas y sembrar 5 registros en cada una.
> - Evalúa el `healthcheck` de PostgreSQL (`pg_isready`) y solo arranca los microservicios una vez la BD esté 100% lista para recibir peticiones.

### Paso 2: Verificar el estado de los contenedores
```bash
docker compose ps
```

Deberás observar los 4 contenedores en ejecución:
- `postgres-db`: Estado `Up (healthy)`, puerto `5432:5432`
- `taller2-cliente-api-1`: Estado `Up`, puerto `3001:3001`
- `taller2-producto-api-1`: Estado `Up`, puerto `3002:3002`
- `taller2-compra-api-1`: Estado `Up`, puerto `3003:3003`

### Paso 3: Monitorear los logs
Para ver los logs de todos los servicios o de uno en específico:

```bash
# Ver logs de todo el ecosistema
docker compose logs -f

# O ver los logs de un servicio puntual:
docker compose logs -f compra-api
```

---

## 7. Verificación de Conexiones y Health Checks

Antes de realizar operaciones CRUD, confirma que todos los servicios y la base de datos respondan correctamente.

### 1. Health Checks en Postman o Navegador
Realiza una petición `GET` a la raíz de cada microservicio:

- **cliente-api**: `GET http://localhost:3001/`
- **producto-api**: `GET http://localhost:3002/`
- **compra-api**: `GET http://localhost:3003/`

**Respuesta esperada (HTTP 200 OK):**
```json
{
  "mensaje": "Conexion exitosa, cliente-api activa",
  "fechaPostgres": {
    "now": "2026-10-07T18:15:00.000Z"
  }
}
```

### 2. Inspeccionar la base de datos dentro del contenedor
Puedes acceder directamente a PostgreSQL dentro de Docker:

```bash
docker compose exec postgres psql -U postgres -d taller2_db
```

Comandos útiles dentro de `psql`:
```sql
\dt                  -- Ver tablas (cliente, producto, compra)
SELECT * FROM cliente;
SELECT * FROM producto;
SELECT * FROM compra;
\q                   -- Salir
```

---

## 8. Guía de Pruebas con Postman (CRUD y Orquestación)

### Configuración Inicial en Postman
Para las peticiones con método **POST** o **PUT**:
1. Selecciona la pestaña **Headers** y agrega:
   - Key: `Content-Type` | Value: `application/json`
2. En la pestaña **Body**:
   - Selecciona **raw** y en el selector desplegable elige **JSON**.

---

### 1. Microservicio `cliente-api` (Puerto 3001)

#### A. Obtener todos los clientes (GET)
- **Método**: `GET`
- **URL**: `http://localhost:3001/clientes`
- **Código esperado**: `200 OK`

#### B. Obtener un cliente por ID (GET)
- **Método**: `GET`
- **URL**: `http://localhost:3001/clientes/1`
- **Código esperado**: `200 OK`

#### C. Registrar un nuevo cliente (POST)
- **Método**: `POST`
- **URL**: `http://localhost:3001/clientes`
- **Body (JSON)**:
```json
{
  "nombre": "Valentina Castro",
  "email": "valentina.castro@example.com"
}
```
- **Código esperado**: `201 Created`

#### D. Actualizar datos de un cliente (PUT)
- **Método**: `PUT`
- **URL**: `http://localhost:3001/clientes/1`
- **Body (JSON)**:
```json
{
  "nombre": "Laura Gómez Actualizada",
  "email": "laura.actualizada@example.com"
}
```
- **Código esperado**: `200 OK`

#### E. Eliminar un cliente (DELETE)
- **Método**: `DELETE`
- **URL**: `http://localhost:3001/clientes/5`
- **Código esperado**: `200 OK`
- **Respuesta esperada**:
```json
{
  "mensaje": "Cliente eliminado",
  "eliminado": {
    "id_cliente": 5,
    "nombre": "David Alejandro Patiño",
    "email": "david.patino@example.com"
  }
}
```

---

### 2. Microservicio `producto-api` (Puerto 3002)

#### A. Obtener todos los productos (GET)
- **Método**: `GET`
- **URL**: `http://localhost:3002/productos`
- **Código esperado**: `200 OK`

#### B. Obtener un producto por ID (GET)
- **Método**: `GET`
- **URL**: `http://localhost:3002/productos/1`
- **Código esperado**: `200 OK`

#### C. Registrar un nuevo producto (POST)
- **Método**: `POST`
- **URL**: `http://localhost:3002/productos`
- **Body (JSON)**:
```json
{
  "nombre": "Teclado Mecánico Inalámbrico",
  "precio": 230000.50,
  "stock": 20
}
```
- **Código esperado**: `201 Created`

#### D. Actualizar producto existente (PUT)
- **Método**: `PUT`
- **URL**: `http://localhost:3002/productos/1`
- **Body (JSON)**:
```json
{
  "precio": 195000.00,
  "stock": 25
}
```
- **Código esperado**: `200 OK`

#### E. Eliminar un producto (DELETE)
- **Método**: `DELETE`
- **URL**: `http://localhost:3002/productos/5`
- **Código esperado**: `200 OK`

---

### 3. Microservicio `compra-api` (Puerto 3003 - Orquestador)

#### A. Listar compras registradas (GET)
- **Método**: `GET`
- **URL**: `http://localhost:3003/compras`
- **Código esperado**: `200 OK`

#### B. Obtener una compra por ID (GET)
- **Método**: `GET`
- **URL**: `http://localhost:3003/compras/1`
- **Código esperado**: `200 OK`

#### C. Registrar una compra exitosa (POST)
> *Cliente 1 compra 2 unidades del Producto 1 (dispone de stock).*
- **Método**: `POST`
- **URL**: `http://localhost:3003/compras`
- **Body (JSON)**:
```json
{
  "clienteId": 1,
  "productoId": 1,
  "cantidad": 2
}
```
- **Código esperado**: `201 Created`
- **Respuesta**:
```json
{
  "id_compra": 6,
  "id_cliente": 1,
  "id_producto": 1,
  "cantidad": 2,
  "fecha": "2026-10-07T18:20:00.000Z"
}
```

#### D. Caso de Negocio: Cliente inexistente (Error 404)
- **Método**: `POST`
- **URL**: `http://localhost:3003/compras`
- **Body (JSON)**:
```json
{
  "clienteId": 9999,
  "productoId": 1,
  "cantidad": 1
}
```
- **Código esperado**: `404 Not Found`
- **Respuesta**:
```json
{
  "mensaje": "El cliente 9999 no existe"
}
```

#### E. Caso de Negocio: Producto inexistente (Error 404)
- **Método**: `POST`
- **URL**: `http://localhost:3003/compras`
- **Body (JSON)**:
```json
{
  "clienteId": 1,
  "productoId": 9999,
  "cantidad": 1
}
```
- **Código esperado**: `404 Not Found`
- **Respuesta**:
```json
{
  "mensaje": "El producto 9999 no existe"
}
```

#### F. Caso de Negocio: Stock insuficiente (Error 400)
> *El producto 3 tiene solo 8 unidades. Solicitamos 50.*
- **Método**: `POST`
- **URL**: `http://localhost:3003/compras`
- **Body (JSON)**:
```json
{
  "clienteId": 1,
  "productoId": 3,
  "cantidad": 50
}
```
- **Código esperado**: `400 Bad Request`
- **Respuesta**:
```text
"Stock insuficiente. Disponible 8, solicitado 50"
```

#### G. Caso de Resiliencia: Servicio caído (Error 503)
1. Detén el contenedor de productos en la terminal:
   ```bash
   docker compose stop producto-api
   ```
2. Vuelve a intentar registrar una compra en Postman:
   - **POST** `http://localhost:3003/compras`
   - Body: `{"clienteId": 1, "productoId": 1, "cantidad": 1}`
3. **Código esperado**: `503 Service Unavailable`
4. **Respuesta**:
   ```json
   {
     "mensaje": "No se pudo validar la compra porque uno de los servicios no respondio",
     "detalle": "fetch failed"
   }
   ```
5. Reactiva el microservicio:
   ```bash
   docker compose start producto-api
   ```

#### H. Actualizar una compra (PUT)
- **Método**: `PUT`
- **URL**: `http://localhost:3003/compras/1`
- **Body (JSON)**:
```json
{
  "cantidad": 3
}
```
- **Código esperado**: `200 OK`

#### I. Eliminar una compra (DELETE)
- **Método**: `DELETE`
- **URL**: `http://localhost:3003/compras/1`
- **Código esperado**: `200 OK`

---

## 9. Equivalencia con comandos cURL

Si deseas ejecutar pruebas rápidas desde la terminal de Linux:

```bash
# --- CLIENTES ---
# GET todos
curl -X GET http://localhost:3001/clientes

# POST nuevo cliente
curl -X POST http://localhost:3001/clientes \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Carlos Gomez","email":"carlos.gomez@test.com"}'

# PUT actualizar cliente
curl -X PUT http://localhost:3001/clientes/1 \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Carlos G. Modificado"}'

# DELETE cliente
curl -X DELETE http://localhost:3001/clientes/1

# --- PRODUCTOS ---
# GET todos
curl -X GET http://localhost:3002/productos

# POST nuevo producto
curl -X POST http://localhost:3002/productos \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Mouse Gamer Pro","precio":120000,"stock":15}'

# PUT actualizar producto
curl -X PUT http://localhost:3002/productos/1 \
  -H "Content-Type: application/json" \
  -d '{"precio":110000,"stock":18}'

# DELETE producto
curl -X DELETE http://localhost:3002/productos/1

# --- COMPRAS ---
# POST compra exitosa
curl -X POST http://localhost:3003/compras \
  -H "Content-Type: application/json" \
  -d '{"clienteId":2,"productoId":2,"cantidad":1}'

# PUT actualizar compra
curl -X PUT http://localhost:3003/compras/1 \
  -H "Content-Type: application/json" \
  -d '{"cantidad":2}'

# DELETE compra
curl -X DELETE http://localhost:3003/compras/1
```

---

## 10. Solución de Problemas Comunes (Troubleshooting)

### Error: `failed to bind host port 0.0.0.0:5432/tcp: address already in use`
- **Causa**: Tienes una instancia nativa de PostgreSQL corriendo en tu sistema operativo local o un contenedor previo ocupando el puerto 5432.
- **Diagnóstico**:
  ```bash
  sudo ss -tulpn | grep 5432
  # o
  sudo lsof -i :5432
  ```
- **Solución más común**:
  ```bash
  sudo systemctl stop postgresql
  ```
- **Solución alternativa (conservar Postgres local activo)**:
  Modifica el mapeo en `docker-compose.yml` para exponer Postgres en otro puerto del host (ejemplo `"5433:5432"`).

### Error 503: `No se pudo validar la compra porque uno de los servicios no respondio`
- **Causa**: `compra-api` intenta comunicarse con `cliente-api` o `producto-api` mediante los nombres DNS de la red Docker (`http://cliente-api:3001`, `http://producto-api:3002`), pero alguno no ha terminado de iniciar o se cayó.
- **Solución**:
  ```bash
  docker compose ps
  docker compose logs -f cliente-api producto-api
  ```

### Error de llave foránea al insertar en compras:
- Recuerda que la base de datos tiene integridad referencial activa (`REFERENCES cliente`, `REFERENCES producto`). Un `clienteId` o `productoId` debe existir físicamente en las tablas para que el registro se guarde.

---

## 11. Persistencia de Datos y Comandos Útiles de Docker

### ¿Dónde se guardan los datos?
En [`docker-compose.yml`](./docker-compose.yml), el servicio `postgres` utiliza el volumen nombrado `pgdata`:
```yaml
volumes:
  - pgdata:/var/lib/postgresql/data
```
Esto asegura que, aunque los contenedores se detengan o se eliminen con `docker compose down`, todos los registros de clientes, productos y compras **se conservan íntegros**.

### Comandos de gestión frecuentes:

```bash
# Iniciar servicios en segundo plano
docker compose up -d

# Detener los servicios sin borrar datos
docker compose stop

# Reanudar servicios previamente detenidos
docker compose start

# Detener y eliminar contenedores y redes (conservando datos)
docker compose down

# Detener, eliminar contenedores Y eliminar la base de datos completa (reseteo total)
docker compose down -v

# Reconstruir imágenes tras hacer cambios en el código
docker compose up -d --build
```
