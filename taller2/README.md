# Documentación Integral - Sistema de Microservicios con Docker y Sequelize (Taller 2)

Arquitectura de microservicios desarrollada con **Node.js**, **Express**, **Sequelize (ORM)** y **PostgreSQL**, orquestada de forma integral con **Docker Compose**. El sistema gestiona tres dominios de negocio (Clientes, Productos y Compras), implementando comunicación inter-servicios vía HTTP, arquitectura modular por capas y los cuatro métodos HTTP principales (`GET`, `POST`, `PUT`, `DELETE`).

---

## Tabla de Contenidos
1. [Arquitectura General](#1-arquitectura-general)
2. [Estructura del Proyecto](#2-estructura-del-proyecto)
3. [Puesta en Marcha con Docker Compose](#3-puesta-en-marcha-con-docker-compose)
4. [Verificación de Conexiones y Health Checks](#4-verificación-de-conexiones-y-health-checks)
5. [Guía de Pruebas con Postman (CRUD y Orquestación)](#5-guía-de-pruebas-con-postman)
   - [Configuración Inicial en Postman](#configuración-inicial-en-postman)
   - [Pruebas en cliente-api (Puerto 3001)](#1-microservicio-cliente-api-puerto-3001)
   - [Pruebas en producto-api (Puerto 3002)](#2-microservicio-producto-api-puerto-3002)
   - [Pruebas en compra-api (Puerto 3003 - Orquestador)](#3-microservicio-compra-api-puerto-3003---orquestador)
6. [Equivalencia con comandos cURL](#6-equivalencia-con-comandos-curl)
7. [Persistencia de Datos y Comandos Útiles de Docker](#7-persistencia-de-datos-y-comandos-útiles-de-docker)

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

## 3. Puesta en Marcha con Docker Compose

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

## 4. Verificación de Conexiones y Health Checks

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

## 5. Guía de Pruebas con Postman

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

## 6. Equivalencia con comandos cURL

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

## 7. Persistencia de Datos y Comandos Útiles de Docker

### ¿Dónde se guardan los datos?
En [`docker-compose.yml`](file:///home/naciscric/Documentos/Backend/taller2/docker-compose.yml), el servicio `postgres` utiliza el volumen nombrado `pgdata`:
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
