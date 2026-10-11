# Documentación Integral - Sistema de Microservicios con Docker y Sequelize (Taller 2)

Arquitectura de microservicios desarrollada con **Node.js**, **Express**, **Sequelize (ORM)** y **PostgreSQL**, orquestada de forma integral con **Docker Compose**. El sistema gestiona tres dominios de negocio (Clientes, Productos y Compras), implementando comunicación inter-servicios vía HTTP, arquitectura modular por capas y los cuatro métodos HTTP principales (`GET`, `POST`, `PUT`, `DELETE`).

Todo el sistema está pensado para funcionar **100% contenerizado**: no se necesita tener Node.js ni PostgreSQL instalados en el equipo, solo Docker y Docker Compose. Un único volumen nombrado (`pgdata`) garantiza que los datos sobrevivan a reinicios y recreaciones de los contenedores.

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
6. [Puesta en Marcha del Proyecto](#6-puesta-en-marcha-del-proyecto)
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

El sistema divide el dominio de un e-commerce en tres microservicios autónomos y desacoplados junto con una base de datos PostgreSQL compartida:

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
               |                        |  HTTP GET (validar) y  |
               |                        |  HTTP PUT (ajustar     |
               |                        |  stock)                |
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

Todos los servicios (las tres APIs y PostgreSQL) viven dentro de la misma red que crea Docker Compose automáticamente, por lo que se resuelven entre sí por el **nombre del servicio** (`postgres`, `cliente-api`, `producto-api`) en lugar de `localhost`.

### Flujo de Orquestación en `compra-api`
Cuando un cliente solicita registrar una compra (`POST /compras`):
1. **Validación de payload**: verifica que estén presentes `clienteId`, `productoId` y `cantidad`, y que `cantidad` sea mayor a 0.
2. **Validación inter-servicio (HTTP GET)**:
   - Consulta `cliente-api` (`GET http://cliente-api:3001/clientes/:id`) para verificar que el cliente exista.
   - Consulta `producto-api` (`GET http://producto-api:3002/productos/:id`) para verificar que el producto exista y cuente con stock suficiente (`stock >= cantidad`).
3. **Cálculo del total**: `total = precio del producto × cantidad`, calculado con el precio vigente en `producto-api` en el momento de la compra.
4. **Descuento de stock (HTTP PUT)**: antes de guardar la compra, `compra-api` le pide a `producto-api` que descuente la cantidad comprada (`PUT /productos/:id` con el nuevo stock). Si el registro de la compra falla después de descontar el stock, `compra-api` revierte el descuento.
5. **Manejo de Respuestas**:
   - Si el cliente no existe → `404 Not Found`.
   - Si el producto no existe → `404 Not Found`.
   - Si el stock es insuficiente → `400 Bad Request`.
   - Si alguno de los servicios destino está caído → `503 Service Unavailable`.
   - Si todo es correcto → registra la compra (con su `total`) en la base de datos vía Sequelize y responde con `201 Created`.

Al actualizar (`PUT /compras/:id`) o eliminar (`DELETE /compras/:id`) una compra, `compra-api` vuelve a comunicarse con `producto-api` para mantener el stock consistente: si cambia la cantidad o el producto de una compra, ajusta la diferencia; si se elimina una compra, devuelve el stock reservado.

---

## 2. Estructura del Proyecto

Cada microservicio implementa una **arquitectura por capas** con **Sequelize**:

```text
taller2/
├── docker-compose.yml              # Orquestación para desarrollo (hot-reload + volúmenes de código)
├── docker-compose.production.yml   # Orquestación para producción (imágenes optimizadas)
├── init.sql                        # DDL y semillas iniciales de PostgreSQL
├── .env.example                    # Plantilla de variables de entorno (puertos y credenciales de BD)
├── .gitignore
│
├── cliente-api/                    # Microservicio: Gestión de Clientes (Puerto 3001)
│   ├── dockerfile                  # Imagen Docker multi-stage (development / production)
│   ├── package.json                # Dependencias (express, sequelize, pg, pg-hstore, dotenv)
│   ├── .env.example                # Plantilla de variables de entorno del servicio
│   └── src/
│       ├── config/database.js      # Conexión Sequelize con PostgreSQL
│       ├── models/cliente.js       # Modelo Sequelize (tabla 'cliente')
│       ├── controllers/clienteController.js # Lógica CRUD (4 métodos HTTP)
│       ├── routes/clientes.routes.js        # Mapeo de rutas HTTP
│       ├── app.js                  # Middlewares Express y Health Check
│       └── server.js               # Inicialización y sincronización de modelos
│
├── producto-api/                   # Microservicio: Catálogo de Productos (Puerto 3002)
│   ├── dockerfile
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── config/database.js
│       ├── models/producto.js      # Modelo Sequelize (tabla 'producto')
│       ├── controllers/productoController.js # Lógica CRUD (4 métodos HTTP)
│       ├── routes/productos.routes.js
│       ├── app.js
│       └── server.js
│
└── compra-api/                     # Microservicio: Orquestador de Compras (Puerto 3003)
    ├── dockerfile
    ├── package.json
    ├── .env.example
    └── src/
        ├── config/database.js
        ├── models/compra.js        # Modelo Sequelize (tabla 'compra', incluye 'total')
        ├── services/
        │   ├── clienteService.js   # Cliente HTTP saliente hacia cliente-api
        │   └── productoService.js  # Cliente HTTP saliente hacia producto-api (consulta y ajusta stock)
        ├── controllers/compraController.js # Lógica CRUD + orquestación + stock + total
        ├── routes/compras.routes.js
        ├── app.js
        └── server.js
```

> Todo el proyecto corre dentro de contenedores: no existen scripts ni dependencias para instalar o inicializar PostgreSQL de forma local. La base de datos se levanta como un servicio más de Docker Compose y `init.sql` se ejecuta automáticamente la primera vez que se crea su volumen.

---

## 3. Explicación Detallada de Archivos y Código

### 3.1 Base de Datos e Inicialización (`init.sql`)

Este script se monta en `/docker-entrypoint-initdb.d/init.sql` dentro del contenedor de PostgreSQL. La imagen oficial de `postgres` ejecuta automáticamente **todos** los scripts `.sql` de esa carpeta la primera vez que el volumen de datos está vacío.

```sql
CREATE TABLE IF NOT EXISTS cliente (
    id_cliente SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS producto (
    id_producto SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    precio NUMERIC(10, 2) NOT NULL,
    stock INT NOT NULL CHECK (stock >= 0)
);

CREATE TABLE IF NOT EXISTS compra (
    id_compra SERIAL PRIMARY KEY,
    id_cliente INT NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Puntos clave:**
- `id_cliente`, `id_producto` e `id_compra` son `SERIAL`: PostgreSQL asigna el siguiente consecutivo automáticamente.
- `compra` tiene dos llaves foráneas con `ON DELETE CASCADE`: si se elimina un cliente o un producto, sus compras asociadas se eliminan en cascada.
- Las columnas de `compra` siguen siempre el mismo orden: **`id_compra, id_cliente, id_producto, cantidad, total, fecha`**. Ese mismo orden se repite en el modelo de Sequelize y, por lo tanto, en las respuestas JSON de la API: lo que se envía y lo que se recibe siempre se lee en el mismo orden.
- `total` guarda el monto calculado al momento de la compra (`precio del producto × cantidad`), así que no hace falta volver a calcularlo ni consultar `producto-api` para mostrarlo en un `GET`.
- Después de los `INSERT` de las 5 filas semilla por tabla, `setval(...)` sincroniza las secuencias (`cliente_id_cliente_seq`, etc.) con el máximo ID insertado manualmente, para que el próximo `INSERT` automático (vía Sequelize) no choque con un ID ya usado.

### 3.2 Capa de Conexión y Configuración (`config/database.js`)

Idéntico en los tres microservicios:

```javascript
const path = require('path');
const { Sequelize } = require('sequelize');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'taller2_db',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD !== undefined ? String(process.env.DB_PASSWORD) : 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: false,
  }
);

module.exports = sequelize;
```

- Carga variables de entorno desde el `.env` propio del microservicio y, como respaldo, desde la raíz de `taller2/`.
- Dentro de Docker Compose, las variables `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` llegan como variables de entorno del contenedor (definidas en `docker-compose.yml`/`docker-compose.production.yml`), con `DB_HOST=postgres` para que cada API encuentre la base de datos por el nombre del servicio.
- `logging: false` evita que Sequelize imprima cada sentencia SQL generada en consola.

### 3.3 Modelos ORM con Sequelize (`models/`)

Cada modelo define la tabla sobre la que Sequelize generará las consultas y sincronizará el esquema.

**`cliente.js`**
```javascript
const Cliente = sequelize.define('Cliente', {
  id_cliente: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(100), allowNull: false },
  email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
}, { tableName: 'cliente', timestamps: false });
```

**`producto.js`**
```javascript
const Producto = sequelize.define('Producto', {
  id_producto: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(100), allowNull: false },
  precio: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  stock: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
}, { tableName: 'producto', timestamps: false });
```

**`compra.js`**
```javascript
const Compra = sequelize.define('Compra', {
  id_compra: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_cliente: { type: DataTypes.INTEGER, allowNull: false },
  id_producto: { type: DataTypes.INTEGER, allowNull: false },
  cantidad: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
  total: { type: DataTypes.DECIMAL(12, 2), allowNull: false, validate: { min: 0 } },
  fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'compra', timestamps: false });
```

**¿Por qué el orden de los campos importa?** Sequelize serializa cada fila a JSON respetando el orden en el que los campos fueron declarados en `define(...)`. Al mantener ese orden idéntico al de `init.sql` (`id_compra, id_cliente, id_producto, cantidad, total, fecha`), cualquier `GET`, `POST` o `PUT` sobre `/compras` devuelve siempre las propiedades en la misma secuencia, sin importar qué endpoint se haya llamado.

- `timestamps: false`: no se agregan automáticamente las columnas `createdAt`/`updatedAt`, ya que `compra` ya tiene su propia columna `fecha`.
- Las validaciones `validate: { min: ... }` son una defensa a nivel de aplicación; las restricciones `CHECK` del `init.sql` son la defensa a nivel de base de datos. Ambas existen porque cubren escenarios distintos: la de Sequelize evita insertos inválidos antes de llegar a la BD, la de PostgreSQL protege la integridad incluso si alguien escribe directamente en la base de datos.
- **`precio` y `total` como `DECIMAL`**: PostgreSQL y Sequelize usan `DECIMAL` para no perder precisión en valores monetarios (a diferencia de un `FLOAT`, que puede introducir errores de redondeo). La contrapartida es que, por defecto, Sequelize serializa los `DECIMAL` como `string` en el JSON de respuesta (por ejemplo `"precio": "120000.00"` en vez de `"precio": 120000`). Es el comportamiento estándar de la librería y no afecta los cálculos internos (`Number(producto.precio) * cantidad` sigue funcionando igual), solo la forma en que se ve el valor en la respuesta HTTP.

### 3.4 Controladores y Lógica de Negocio (`controllers/`)

**`clienteController.js`** y **`productoController.js`** implementan el CRUD estándar:
- `obtenerTodos`: `findAll()` ordenado por el ID de la entidad (`ORDER BY id_cliente ASC`, etc.).
- `obtenerUno`: `findByPk(id)`, responde `404` si no existe.
- `crear`: valida campos obligatorios, arma el payload y lo persiste con `create(...)`. El `id` solo se incluye en el payload si el cliente lo envía explícitamente (permite tanto autogenerarlo como respetar semillas con ID fijo).
- `actualizar`: busca por PK, exige al menos un campo a modificar y aplica solo los campos enviados (los demás se mantienen con `update({...})`).
- `eliminar`: busca por PK y hace `destroy()`.
- Los errores de restricción única (`SequelizeUniqueConstraintError`, por ejemplo un email duplicado) se traducen a `409 Conflict`.

**`compraController.js`** añade la lógica de orquestación entre microservicios:

```javascript
// POST /compras
const total = Number(producto.precio) * Number(cantidad);
await ajustarStock(productoId, -Number(cantidad)); // descuenta stock en producto-api
const nuevaCompra = await Compra.create({ id_cliente, id_producto, cantidad, total, fecha });
```

- **Cálculo del total**: se multiplica el `precio` devuelto por `producto-api` (el precio vigente en ese instante) por la `cantidad` comprada, y se guarda en la columna `total` de la compra. Como queda persistido, aparece igual en el `POST` de creación y en cualquier `GET` posterior, sin tener que volver a consultar `producto-api`.
- **Descuento de stock**: antes de insertar la compra, se llama a `ajustarStock` (ver sección 3.5) con un delta negativo. Si la creación de la compra falla después de descontar el stock, se revierte el descuento (`ajustarStock` con el delta positivo) para que el stock de `producto-api` no quede desincronizado.
- **Actualizar (`PUT /compras/:id`)**: si cambia el producto, se devuelve el stock reservado en el producto anterior y se reserva en el nuevo; si solo cambia la cantidad, se ajusta únicamente la diferencia (`delta = nuevaCantidad - cantidadAnterior`). El `total` se recalcula con el precio vigente del producto correspondiente.
- **Eliminar (`DELETE /compras/:id`)**: primero se devuelve el stock reservado a `producto-api` y solo si esa operación tiene éxito se borra la compra; así nunca se pierde un registro de compra sin haber liberado su stock.
- Todas las llamadas salientes están envueltas en `try/catch`: si `cliente-api` o `producto-api` no responden, se devuelve `503 Service Unavailable` en lugar de que la petición falle de forma silenciosa.

### 3.5 Servicios de Comunicación Inter-Servicios (`services/`)

Viven únicamente en `compra-api`, porque es el único microservicio que necesita hablar con los otros dos.

**`clienteService.js`**
```javascript
async function obtenerCliente(id) {
  const url = process.env.CLIENTE_API_URL || 'http://localhost:3001';
  const respuesta = await fetch(`${url}/clientes/${id}`);
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) throw new Error(`cliente-api respondio con estado ${respuesta.status}`);
  return respuesta.json();
}
```

**`productoService.js`**
```javascript
async function obtenerProducto(id) { /* igual patrón que obtenerCliente */ }

async function ajustarStock(id, delta) {
  const producto = await obtenerProducto(id);
  if (!producto) throw new Error(`No se encontró el producto ${id} al ajustar el stock`);

  const nuevoStock = Number(producto.stock) + delta;
  if (nuevoStock < 0) throw new Error(`Stock insuficiente para el producto ${id}`);

  const respuesta = await fetch(`${url}/productos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stock: nuevoStock }),
  });
  if (!respuesta.ok) throw new Error(`producto-api respondio con estado ${respuesta.status} al ajustar el stock`);
  return respuesta.json();
}
```

- Usan `fetch` nativo de Node.js (disponible desde Node 18+, y en este proyecto desde la imagen `node:24`), sin necesidad de instalar `axios` u otra librería HTTP.
- `CLIENTE_API_URL` y `PRODUCTO_API_URL` son variables de entorno: en Docker Compose apuntan a `http://cliente-api:3001` y `http://producto-api:3002` (nombres de servicio); fuera de Docker, por defecto apuntan a `localhost`.
- `ajustarStock` centraliza toda la lógica de modificar el stock de un producto desde `compra-api`: consulta el stock actual, calcula el nuevo valor, valida que no quede negativo y lo persiste con un `PUT` hacia `producto-api`. Se reutiliza tanto para descontar (`delta` negativo) como para devolver stock (`delta` positivo).
- `compra-api` nunca accede directamente a la tabla `producto`: toda modificación de stock pasa por la API de `producto-api`, respetando que cada microservicio es dueño exclusivo de sus propios datos.

### 3.6 Enrutamiento y Middlewares (`routes/` y `app.js`)

**`routes/*.routes.js`** (idéntico patrón en los tres servicios):
```javascript
router.get('/',          obtenerTodos);
router.get('/:id',       obtenerUno);
router.post('/',         crear);
router.put('/:id',       actualizar);
router.delete('/:id',    eliminar);
```
El router no conoce la lógica de negocio: solo asocia verbo HTTP + URL con la función del controller correspondiente.

**`app.js`** configura la aplicación Express:
```javascript
const app = express();
app.use(express.json());

app.get('/', async (req, res) => {
  const [resultado] = await sequelize.query('SELECT NOW() AS now');
  res.status(200).json({ mensaje: 'Conexion exitosa, <servicio> activa', fechaPostgres: resultado[0] });
});

app.use('/clientes', clientesRoutes); // (o /productos, /compras según el servicio)
module.exports = app;
```
- `express.json()` habilita el parseo automático de cuerpos JSON en las peticiones.
- La ruta raíz (`GET /`) funciona como **health check**: ejecuta una consulta real contra PostgreSQL (`SELECT NOW()`) y confirma tanto que la API está arriba como que la conexión a la base de datos funciona.

### 3.7 Punto de Entrada del Servidor (`server.js`)

```javascript
require('dotenv').config();
const app = require('./app');
const sequelize = require('./config/database');
require('./models/cliente'); // o './models/producto', './models/compra'

const PORT = process.env.PORT || 3001;

async function iniciar() {
  try {
    await sequelize.authenticate();
    console.log('Conexión a la base de datos establecida en cliente-api.');

    await sequelize.sync({ alter: true });
    console.log('Modelos sincronizados con la base de datos.');

    app.listen(PORT, () => {
      console.log(`Cliente-api escuchando en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar cliente-api:', error.message);
    process.exit(1);
  }
}

iniciar();
```

Tres pasos, en orden:
1. **`sequelize.authenticate()`**: confirma que las credenciales y el host de PostgreSQL son correctos antes de hacer cualquier otra cosa.
2. **`sequelize.sync({ alter: true })`**: compara el modelo de Sequelize contra la tabla real y aplica los cambios necesarios (agrega columnas nuevas, ajusta tipos, etc.) sin borrar los datos existentes. Como `init.sql` ya crea las tablas con su estructura completa (incluyendo `CHECK` y llaves foráneas) la primera vez que arranca el contenedor de PostgreSQL, `sync({ alter: true })` actúa aquí como una verificación de que el modelo y la tabla siguen alineados.
3. **`app.listen(PORT, ...)`**: levanta el servidor HTTP solo después de que los dos pasos anteriores tuvieron éxito. Si algo falla, el proceso termina con `process.exit(1)` para que Docker pueda reiniciar el contenedor (política `restart: unless-stopped`).

---

## 4. Análisis Detallado de Dockerfiles (Multi-stage)

Los tres microservicios usan el mismo patrón de Dockerfile con dos etapas (`development` y `production`), seleccionables con `target` desde `docker-compose.yml`:

```dockerfile
FROM node:24 as development

WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .

ENV NODE_ENV=development

EXPOSE 3001

CMD ["npm", "run", "dev"]

FROM node:24 AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

ENV NODE_ENV=production

EXPOSE 3001

CMD ["npm", "start"]
```

- **Etapa `development`**: instala todas las dependencias (incluyendo `nodemon`) con `npm install` y arranca con `npm run dev`, que ejecuta `nodemon -L src/server.js`. Combinada con los volúmenes de código de `docker-compose.yml`, permite recargar el servicio automáticamente cada vez que se guarda un cambio, sin reconstruir la imagen.
- **Etapa `production`**: usa `npm ci --omit=dev` (instalación reproducible a partir de `package-lock.json`, sin dependencias de desarrollo como `nodemon`) y arranca con `npm start`, que ejecuta `node src/server.js` directamente. Es la imagen que se usa en `docker-compose.production.yml`.
- `COPY package*.json ./` seguido de `RUN npm install`/`npm ci` **antes** de `COPY . .` aprovecha el cache de capas de Docker: mientras no cambien las dependencias, reconstruir la imagen tras modificar el código fuente no vuelve a ejecutar la instalación de paquetes.

---

## 5. Análisis Detallado de Docker Compose

### 5.1 Entorno de Desarrollo (`docker-compose.yml`)

```yaml
services:
    cliente-api:
        build:
            context: ./cliente-api
            dockerfile: dockerfile
            target: development
        ports:
            - "${CLIENTE_PORT:-3001}:3001"
        env_file:
            - ./cliente-api/.env
        environment:
            - DB_HOST=postgres
            - DB_PORT=5432
            - DB_NAME=${DB_NAME:-taller2_db}
            - DB_USER=${DB_USER:-postgres}
            - DB_PASSWORD=${DB_PASSWORD:-postgres}
            - PORT=3001
        volumes:
            - ./cliente-api:/app
            - /app/node_modules
        depends_on:
            postgres:
                condition: service_healthy
        restart: unless-stopped

    # producto-api y compra-api siguen el mismo patrón (puertos 3002 y 3003)
    # compra-api además recibe CLIENTE_API_URL y PRODUCTO_API_URL apuntando
    # a los nombres de servicio: http://cliente-api:3001 y http://producto-api:3002

    postgres:
        image: postgres:17-alpine
        container_name: postgres-db
        environment:
            - POSTGRES_USER=${DB_USER:-postgres}
            - POSTGRES_PASSWORD=${DB_PASSWORD:-postgres}
            - POSTGRES_DB=${DB_NAME:-taller2_db}
        ports:
            - "5432:5432"
        volumes:
            - pgdata:/var/lib/postgresql/data
            - ./init.sql:/docker-entrypoint-initdb.d/init.sql
        healthcheck:
            test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres} -d ${DB_NAME:-taller2_db}"]
            interval: 5s
            timeout: 5s
            retries: 5
        restart: unless-stopped

volumes:
    pgdata:
```

**Puntos clave:**
- **`target: development`**: cada API se construye usando la etapa de desarrollo del Dockerfile (con `nodemon`).
- **Volúmenes de código** (`./cliente-api:/app` + `/app/node_modules`): montan el código fuente del host dentro del contenedor para que `nodemon` detecte los cambios al vuelo, mientras que `/app/node_modules` como volumen anónimo evita que el `node_modules` del host (si existiera, con binarios de otro sistema operativo) sobreescriba el que se instaló dentro del contenedor.
- **`env_file` + `environment`**: `env_file` carga el `.env` propio de cada microservicio (con sus valores por defecto), pero las claves listadas en `environment` tienen prioridad y las sobrescriben; así, sin importar qué tenga el `.env` local, dentro de Docker Compose `DB_HOST` siempre es `postgres` y `compra-api` siempre encuentra a los otros dos servicios por su nombre de red.
- **`depends_on` con `condition: service_healthy`**: las tres APIs esperan a que el `healthcheck` de `postgres` responda exitosamente antes de arrancar, evitando errores de conexión al iniciar todo con un solo `docker compose up`.
- **El volumen nombrado `pgdata`**: Docker lo gestiona de forma persistente; los datos sobreviven a `docker compose down` y solo se eliminan explícitamente con `docker compose down -v`.
- **`./init.sql:/docker-entrypoint-initdb.d/init.sql`**: monta el script de inicialización dentro de la carpeta especial que la imagen de PostgreSQL ejecuta automáticamente la primera vez que el volumen de datos está vacío.

### 5.2 Entorno de Producción (`docker-compose.production.yml`)

```yaml
services:
    cliente-api:
        build:
            context: ./cliente-api
            dockerfile: dockerfile
            target: production
        ports:
            - "${CLIENTE_PORT:-3001}:3001"
        env_file:
            - ./cliente-api/.env
        environment:
            - DB_HOST=postgres
            - DB_PORT=5432
            - DB_NAME=${DB_NAME:-taller2_db}
            - DB_USER=${DB_USER:-postgres}
            - DB_PASSWORD=${DB_PASSWORD:-postgres}
            - PORT=3001
        depends_on:
            postgres:
                condition: service_healthy
        restart: unless-stopped

    # producto-api y compra-api siguen el mismo patrón que en desarrollo,
    # pero con target: production

    postgres:
        image: postgres:17-alpine
        container_name: postgres-db
        environment:
            - POSTGRES_USER=${DB_USER:-postgres}
            - POSTGRES_PASSWORD=${DB_PASSWORD:-postgres}
            - POSTGRES_DB=${DB_NAME:-taller2_db}
        volumes:
            - pgdata:/var/lib/postgresql/data
            - ./init.sql:/docker-entrypoint-initdb.d/init.sql
        healthcheck:
            test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres} -d ${DB_NAME:-taller2_db}"]
            interval: 5s
            timeout: 5s
            retries: 5
        restart: unless-stopped

volumes:
    pgdata:
```

**Diferencias respecto al entorno de desarrollo:**
- **`target: production`**: usa la etapa optimizada del Dockerfile (`npm ci --omit=dev`, sin `nodemon`).
- **Sin volúmenes de código**: en producción el código ya quedó copiado dentro de la imagen (`COPY . .` en el Dockerfile), así que no se monta el repositorio del host — cualquier cambio de código requiere reconstruir la imagen (`docker compose -f docker-compose.production.yml up -d --build`), que es el comportamiento esperado en producción.
- **El puerto de PostgreSQL no se expone al host**: solo las tres APIs publican su puerto; la base de datos únicamente es alcanzable dentro de la red interna de Docker Compose, reduciendo la superficie expuesta.
- **El volumen `pgdata`** funciona igual que en desarrollo: los datos persisten aunque se recreen los contenedores.

---

## 6. Puesta en Marcha del Proyecto

Todo el flujo se maneja con Docker; no es necesario instalar Node.js ni PostgreSQL en el equipo.

### 6.1 Prerrequisitos
- Docker y Docker Compose instalados.
- Puertos `3001`, `3002`, `3003` y `5432` libres en el host (ver sección de Troubleshooting si alguno está ocupado).

### 6.2 Configurar variables de entorno

Copia las plantillas `.env.example` a `.env` en la raíz de `taller2/` y en cada microservicio:

```bash
cp .env.example .env
cp cliente-api/.env.example cliente-api/.env
cp producto-api/.env.example producto-api/.env
cp compra-api/.env.example compra-api/.env
```

Los valores por defecto ya funcionan para correr todo en local con Docker Compose; solo es necesario ajustarlos si se despliega en otro entorno (por ejemplo, en una VM, cambiando `DB_HOST`, usuarios o contraseñas).

### 6.3 Levantar el entorno de desarrollo

```bash
docker compose up -d
```

Esto construye las tres imágenes (etapa `development`), levanta PostgreSQL, espera a que su `healthcheck` esté en verde y arranca las tres APIs con `nodemon`, listas para recargar en caliente ante cualquier cambio de código.

Ver los logs para confirmar que todo arrancó correctamente:

```bash
docker compose logs -f cliente-api producto-api compra-api
```

Debes ver, para cada servicio, un mensaje similar a:

```
Conexión a la base de datos establecida en cliente-api.
Modelos sincronizados con la base de datos.
Cliente-api escuchando en el puerto 3001
```

### 6.4 Levantar el entorno de producción

```bash
docker compose -f docker-compose.production.yml up -d --build
```

### 6.5 Verificar que los datos persisten

1. Crea un registro con POST en Postman (por ejemplo, un cliente nuevo).
2. Ejecuta `docker compose down` para detener y eliminar los contenedores.
3. Ejecuta `docker compose up -d` para volver a levantarlos.
4. Haz `GET` sobre el mismo recurso — el registro sigue ahí, gracias al volumen `pgdata`.

---

## 7. Verificación de Conexiones y Health Checks

Cada microservicio expone un health check en su ruta raíz:

| Servicio      | URL                              |
|---------------|-----------------------------------|
| cliente-api   | `http://localhost:3001/`          |
| producto-api  | `http://localhost:3002/`          |
| compra-api    | `http://localhost:3003/`          |

Respuesta esperada (`200 OK`):
```json
{
  "mensaje": "Conexion exitosa, cliente-api activa",
  "fechaPostgres": { "now": "2026-10-11T15:00:00.000Z" }
}
```

También se puede verificar el estado de los contenedores directamente:
```bash
docker compose ps
```

---

## 8. Guía de Pruebas con Postman

### Configuración Inicial en Postman

1. Crea una colección nueva, por ejemplo **"Taller 2 - Microservicios"**.
2. Opcional: crea un Environment con variables `cliente_url = http://localhost:3001`, `producto_url = http://localhost:3002`, `compra_url = http://localhost:3003`.
3. En cada request de tipo `POST`/`PUT`, en la pestaña **Body**, selecciona `raw` y `JSON`.

> **Nota sobre el orden de los campos**: tanto en los cuerpos de ejemplo como en las respuestas de la API, los campos de `cliente` siempre aparecen en el orden `id_cliente, nombre, email`; los de `producto` en `id_producto, nombre, precio, stock`; y los de `compra` en `id_compra, id_cliente, id_producto, cantidad, total, fecha`. Ese orden es siempre el mismo, sin importar si la operación es un `GET`, un `POST` o un `PUT`.

### 1. Microservicio `cliente-api` (Puerto 3001)

#### A. Listar todos los clientes (GET)
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
  "nombre": "Carlos Gómez",
  "email": "carlos.gomez@test.com"
}
```
- **Código esperado**: `201 Created`
- **Respuesta**:
```json
{
  "id_cliente": 6,
  "nombre": "Carlos Gómez",
  "email": "carlos.gomez@test.com"
}
```

#### D. Caso de Negocio: email duplicado (Error 409)
- **Método**: `POST`
- **URL**: `http://localhost:3001/clientes`
- **Body (JSON)**:
```json
{
  "nombre": "Otro Cliente",
  "email": "carlos.gomez@test.com"
}
```
- **Código esperado**: `409 Conflict`

#### E. Actualizar un cliente (PUT)
- **Método**: `PUT`
- **URL**: `http://localhost:3001/clientes/6`
- **Body (JSON)**:
```json
{
  "nombre": "Carlos G. Modificado"
}
```
- **Código esperado**: `200 OK`

#### F. Eliminar un cliente (DELETE)
- **Método**: `DELETE`
- **URL**: `http://localhost:3001/clientes/6`
- **Código esperado**: `200 OK`

### 2. Microservicio `producto-api` (Puerto 3002)

#### A. Listar todos los productos (GET)
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
  "nombre": "Mouse Gamer Pro",
  "precio": 120000,
  "stock": 15
}
```
- **Código esperado**: `201 Created`
- **Respuesta**:
```json
{
  "id_producto": 6,
  "nombre": "Mouse Gamer Pro",
  "precio": "120000.00",
  "stock": 15
}
```

#### D. Actualizar un producto (PUT)
- **Método**: `PUT`
- **URL**: `http://localhost:3002/productos/6`
- **Body (JSON)**:
```json
{
  "precio": 110000,
  "stock": 18
}
```
- **Código esperado**: `200 OK`

#### E. Eliminar un producto (DELETE)
- **Método**: `DELETE`
- **URL**: `http://localhost:3002/productos/6`
- **Código esperado**: `200 OK`

### 3. Microservicio `compra-api` (Puerto 3003 - Orquestador)

#### A. Listar compras registradas (GET)
- **Método**: `GET`
- **URL**: `http://localhost:3003/compras`
- **Código esperado**: `200 OK`

#### B. Obtener una compra por ID (GET)
- **Método**: `GET`
- **URL**: `http://localhost:3003/compras/1`
- **Código esperado**: `200 OK`

#### C. Registrar una compra exitosa y ver el total (POST)
> *Cliente 1 compra 2 unidades del Producto 1 (precio 180000, dispone de stock).*
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
- **Respuesta** (nótese el campo `total = precio × cantidad = 360000`):
```json
{
  "id_compra": 6,
  "id_cliente": 1,
  "id_producto": 1,
  "cantidad": 2,
  "total": "360000.00",
  "fecha": "2026-10-11T18:20:00.000Z"
}
```
- Verifica el descuento de stock: `GET http://localhost:3002/productos/1` debe mostrar el stock reducido en 2 unidades.

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

#### H. Actualizar una compra y ver el total recalculado (PUT)
> *Al cambiar la cantidad, el total se recalcula y el stock se ajusta por la diferencia.*
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
> *El stock reservado se devuelve automáticamente a producto-api antes de borrar el registro.*
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
# POST compra exitosa (incluye total en la respuesta)
curl -X POST http://localhost:3003/compras \
  -H "Content-Type: application/json" \
  -d '{"clienteId":2,"productoId":2,"cantidad":1}'

# PUT actualizar compra (recalcula total y ajusta stock)
curl -X PUT http://localhost:3003/compras/1 \
  -H "Content-Type: application/json" \
  -d '{"cantidad":2}'

# DELETE compra (devuelve el stock reservado)
curl -X DELETE http://localhost:3003/compras/1
```

---

## 10. Solución de Problemas Comunes (Troubleshooting)

### Error: `failed to bind host port 0.0.0.0:5432/tcp: address already in use`
- **Causa**: tienes una instancia nativa de PostgreSQL corriendo en tu sistema operativo local o un contenedor previo ocupando el puerto 5432.
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

### Error 503: `No se pudo descontar/devolver el stock del producto`
- **Causa**: el mismo problema anterior, pero ocurrido durante el ajuste de stock que hace `compra-api` contra `producto-api` al crear, actualizar o eliminar una compra.
- **Solución**: verifica que `producto-api` esté arriba y responda en `http://localhost:3002/`.

### Error de llave foránea al insertar en compras:
- Recuerda que la base de datos tiene integridad referencial activa (`REFERENCES cliente`, `REFERENCES producto`). Un `clienteId` o `productoId` debe existir físicamente en las tablas para que el registro se guarde.

---

## 11. Persistencia de Datos y Comandos Útiles de Docker

### ¿Dónde se guardan los datos?
En `docker-compose.yml` y `docker-compose.production.yml`, el servicio `postgres` utiliza el volumen nombrado `pgdata`:
```yaml
volumes:
  - pgdata:/var/lib/postgresql/data
```
Esto asegura que, aunque los contenedores se detengan o se eliminen con `docker compose down`, todos los registros de clientes, productos y compras **se conservan íntegros**.

### Comandos de gestión frecuentes:

```bash
# Iniciar servicios en segundo plano
docker compose up -d

# Ver el estado de los servicios
docker compose ps

# Entrar a la terminal del contenedor de PostgreSQL
docker compose exec postgres psql -U postgres -d taller2_db

# Ver las tablas creadas
# (dentro del psql anterior)
\dt
SELECT * FROM cliente;
SELECT * FROM producto;
SELECT * FROM compra;
\q

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
