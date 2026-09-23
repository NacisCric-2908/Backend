# Documentación Integral - Sistema de Microservicios (Taller 2)

Arquitectura de microservicios desarrollada con **Node.js**, **Express** y **PostgreSQL** para la gestión distribuida de Clientes, Productos y Compras, implementando comunicación inter-servicios vía HTTP, orquestación y validación de reglas de negocio en tiempo real.

---

## Tabla de Contenidos
1. [Arquitectura General](#1-arquitectura-general)
2. [Estructura del Proyecto](#2-estructura-del-proyecto)
3. [Explicación Detallada de Archivos y Código](#3-explicación-detallada-de-archivos-y-código)
   - [Archivos Raíz](#archivos-raíz-de-taller2)
   - [Microservicio: cliente-api](#microservicio-cliente-api-puerto-3001)
   - [Microservicio: producto-api](#microservicio-producto-api-puerto-3002)
   - [Microservicio: compra-api](#microservicio-compra-api-puerto-3003)
4. [Instalación y Configuración del Entorno (Sin Docker)](#4-instalación-y-configuración-del-entorno-sin-docker)
5. [Puesta en Marcha](#5-puesta-en-marcha)
6. [Guía de Pruebas con cURL (Casos de Uso y Validación)](#6-guía-de-pruebas-con-curl)
7. [Buenas Prácticas y Manejo de Errores](#7-buenas-prácticas-y-manejo-de-errores)

---

## 1. Arquitectura General

El sistema divide el dominio de un e-commerce en tres microservicios autónomos y desacoplados:

```
                      +-------------------+
                      |   Cliente HTTP    |
                      |  (Postman / cURL) |
                      +---------+---------+
                                |
             +------------------+------------------+
             |                                     |
             v (GET/POST)                          v (POST /compras)
    +-----------------+                  +-----------------+
    |   cliente-api   |<-----------------+   compra-api    |
    |  (Puerto 3001)  |   HTTP GET       |  (Puerto 3003)  |
    +--------+--------+                  +--------+--------+
             |                                    |
             |                                    | HTTP GET
             |                                    v
             |                           +-----------------+
             |                           |  producto-api   |
             |                           |  (Puerto 3002)  |
             |                           +--------+--------+
             |                                    |
             +------------------+-----------------+
                                |
                                v
                    +-----------------------+
                    |  PostgreSQL Database  |
                    |      taller2_db       |
                    | (cliente, producto,   |
                    |       compra)         |
                    +-----------------------+
```

### Flujo de Orquestación en `compra-api`
Cuando un cliente solicita registrar una compra (`POST /compras`):
1. **`compra-api`** valida los campos obligatorios del payload (`id_compra`, `clienteId`, `productoId`, `fecha`, `cantidad`).
2. Realiza consultas HTTP en paralelo/secuenciales hacia:
   - `cliente-api` (`GET /clientes/:id`) para verificar que el cliente exista.
   - `producto-api` (`GET /productos/:id`) para verificar que el producto exista y cuente con stock suficiente (`stock >= cantidad`).
3. **Manejo de Respuestas:**
   - Si el cliente no existe $\rightarrow$ Retorna `404 Not Found`.
   - Si el producto no existe $\rightarrow$ Retorna `404 Not Found`.
   - Si el stock es insuficiente $\rightarrow$ Retorna `400 Bad Request`.
   - Si `cliente-api` o `producto-api` están caídos $\rightarrow$ Retorna `503 Service Unavailable`.
4. Si todas las validaciones son satisfactorias, inserta la compra en la tabla `compra` de PostgreSQL y retorna `201 Created`.

---

## 2. Estructura del Proyecto

```text
taller2/
├── .env                              # Variables de entorno globales del taller
├── .env.example                      # Plantilla de variables de entorno
├── init.sql                          # Script DDL de PostgreSQL con creación de tablas y 5 registros c/u
├── setup-db.js                       # Script Node.js para inicializar la BD automáticamente
├── install-and-setup-postgres.sh     # Script Bash de instalación de PostgreSQL en Linux Mint / Ubuntu
├── docker-compose.yml                # Configuración Docker Compose (desarrollo)
├── docker-compose.production.yml     # Configuración Docker Compose (producción)
├── package.json                      # Configuración raíz de scripts auxiliares
│
├── cliente-api/                      # Microservicio de Gestión de Clientes
│   ├── .env                          # Configuración local (puerto 3001, conexión BD)
│   ├── .env.example
│   ├── dockerfile                    # Build multi-etapa
│   ├── package.json                  # Dependencias: express, dotenv, pg
│   └── src/
│       ├── server.js                 # Inicialización del servidor Express y Health Check
│       ├── db.js                     # Pool de conexiones a PostgreSQL
│       ├── data/clientes.js          # Datos iniciales en memoria (herencia previa)
│       └── routes/clientes.routes.js # Controladores y rutas HTTP
│
├── producto-api/                     # Microservicio de Gestión de Productos
│   ├── .env                          # Configuración local (puerto 3002, conexión BD)
│   ├── .env.example
│   ├── dockerfile
│   ├── package.json                  # Dependencias: express, dotenv, pg
│   └── src/
│       ├── server.js                 # Servidor Express y Health Check
│       ├── db.js                     # Pool de conexiones a PostgreSQL
│       ├── data/productos.js         # Datos en memoria (herencia previa)
│       └── routes/productos.routes.js# Controladores y rutas HTTP
│
└── compra-api/                       # Microservicio Orquestador de Compras
    ├── .env                          # Configuración local (puerto 3003, URLs de servicios, BD)
    ├── .env.example
    ├── dockerfile
    ├── package.json                  # Dependencias: express, dotenv, pg
    └── src/
        ├── server.js                 # Servidor Express y Health Check
        ├── db.js                     # Pool de conexiones a PostgreSQL
        ├── data/compras.js           # Datos en memoria (herencia previa)
        ├── services/
        │   ├── clienteService.js     # Cliente HTTP para comunicarse con cliente-api
        │   └── productoService.js    # Cliente HTTP para comunicarse con producto-api
        └── routes/compras.routes.js  # Lógica de validación cruzada y registro de compras
```

---

## 3. Explicación Detallada de Archivos y Código

### Archivos Raíz de `taller2`

#### `init.sql`
Script SQL DDL (Data Definition Language) y DML (Data Manipulation Language). Define el esquema relacional en PostgreSQL:
- **Tabla `cliente`**: Columnas `id_cliente` (SERIAL PK), `nombre` (VARCHAR NOT NULL), `email` (VARCHAR UNIQUE NOT NULL).
- **Tabla `producto`**: Columnas `id_producto` (SERIAL PK), `nombre` (VARCHAR NOT NULL), `precio` (NUMERIC NOT NULL), `stock` (INT NOT NULL con constraint `CHECK (stock >= 0)`).
- **Tabla `compra`**: Columnas `id_compra` (SERIAL PK), `id_cliente` (FK hacia `cliente`), `id_producto` (FK hacia `producto`), `fecha` (TIMESTAMP NOT NULL), `cantidad` (INT NOT NULL con constraint `CHECK (cantidad > 0)`).
- **Semillas de datos (Seeding)**: Inserta 5 registros en cada tabla con cláusula `ON CONFLICT DO NOTHING`.
- **Sincronización de secuencias**: Ejecuta `SELECT setval(...)` para que las secuencias de autoincremento continúen a partir del ID 6 sin provocar colisiones de clave primaria.

#### `setup-db.js`
Script de automatización en Node.js utilizando el cliente `pg.Client`:
1. Se conecta inicialmente a la base de datos por defecto `postgres`.
2. Verifica si la base de datos `taller2_db` existe en `pg_database`. Si no existe, la crea con `CREATE DATABASE "taller2_db"`.
3. Se desconecta y establece una nueva conexión directa a `taller2_db`.
4. Lee el archivo `init.sql` y ejecuta todas sus sentencias en una transacción.
5. Realiza un conteo de validación (`SELECT COUNT(*)`) e imprime en consola el número de clientes, productos y compras cargados.

#### `install-and-setup-postgres.sh`
Script en Bash diseñado para sistemas operativos basados en Debian/Ubuntu/Linux Mint:
1. Actualiza repositorios e instala `postgresql` y `postgresql-contrib`.
2. Habilita e inicia el servicio de PostgreSQL en `systemd`.
3. Establece la contraseña `'postgres'` al usuario maestro `postgres` mediante `ALTER USER postgres PASSWORD 'postgres';`.
4. Ejecuta automáticamente `node setup-db.js` para dejar la base de datos lista.

#### `package.json` (Raíz)
Permite gestionar dependencias comunes como `dotenv` y `pg` a nivel de raíz, y provee el comando:
```bash
npm run setup:db
```

#### `.env` (Raíz)
Define las variables globales:
```env
CLIENTE_PORT=3001
PRODUCTO_PORT=3002
COMPRA_PORT=3003

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=taller2_db
```

---

### Microservicio: `cliente-api` (Puerto 3001)

#### `src/db.js`
Crea y exporta una instancia de `Pool` de la librería `pg`. El pool gestiona conexiones reutilizables a PostgreSQL utilizando las variables de entorno:
```javascript
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

module.exports = pool;
```

#### `src/server.js`
- Inicializa la aplicación Express y parsea cuerpos JSON con `app.use(express.json())`.
- Asocia el router de clientes en `/clientes`.
- Define un **Health Check** en `GET /` que ejecuta `SELECT NOW()` en la base de datos para confirmar que el microservicio está activo y que la conexión a PostgreSQL es funcional.
- Pone a la escucha el servidor en el puerto 3001.

#### `src/routes/clientes.routes.js`
Define los endpoints del recurso:
- **`GET /clientes`**: Realiza `SELECT * FROM cliente` y retorna el listado completo en JSON (código 200).
- **`GET /clientes/:id`**: Busca por parámetro de ruta parametrizado `$1` (`SELECT * FROM cliente WHERE id_cliente = $1`). Si no encuentra filas retorna `404 Not Found`. Si lo encuentra retorna el objeto cliente (código 200).
- **`POST /clientes`**: Extrae `{ id_cliente, nombre, email }` del cuerpo de la petición e inserta el nuevo registro (`INSERT INTO cliente ... RETURNING *`). Retorna el cliente creado con código 201.

---

### Microservicio: `producto-api` (Puerto 3002)

#### `src/db.js`
Pool de conexión a PostgreSQL idéntico al de clientes, apuntando a la base de datos `taller2_db`.

#### `src/server.js`
Configura Express en el puerto 3002, registra las rutas en `/productos` y provee el endpoint `GET /` de comprobación de salud contra PostgreSQL.

#### `src/routes/productos.routes.js`
- **`GET /productos`**: Consulta `SELECT * FROM producto` y retorna todos los productos con su stock y precio.
- **`GET /productos/:id`**: Consulta `SELECT * FROM producto WHERE id_producto = $1`. Retorna el producto con código 200 o `404 Not Found` con mensaje `{ error: "Producto no encontrado" }`.
- **`POST /productos`**: Recibe `{ id_producto, nombre, precio, stock }` y realiza el insert con `RETURNING *` retornando código 201.

---

### Microservicio: `compra-api` (Puerto 3003)

Es el servicio central que coordina las transacciones entre los dominios.

#### `src/services/clienteService.js`
Encapsula la comunicación saliente hacia `cliente-api`:
```javascript
const CLIENTE_API_URL = process.env.CLIENTE_API_URL;

async function obtenerCliente(id) {
    const respuesta = await fetch(`${CLIENTE_API_URL}/clientes/${id}`);

    if (respuesta.status === 404) {
        return null; // El recurso no existe
    }

    if (!respuesta.ok) {
        throw new Error(`cliente-api respondió con estado ${respuesta.status}`);
    }

    return respuesta.json();
}
```
*Usa `fetch` nativo de Node.js. Si recibe 404 retorna `null` controladamente. Si la petición falla o el servicio no responde, lanza un error.*

#### `src/services/productoService.js`
Encapsula la comunicación saliente hacia `producto-api`:
```javascript
const PRODUCTO_API_URL = process.env.PRODUCTO_API_URL;

async function obtenerProducto(id) {
    const respuesta = await fetch(`${PRODUCTO_API_URL}/productos/${id}`);

    if (respuesta.status === 404) {
        return null;
    }

    if (!respuesta.ok) {
        throw new Error(`producto-api respondió con estado ${respuesta.status}`);
    }

    return respuesta.json();
}
```

#### `src/routes/compras.routes.js`
Implementa la lógica de orquestación y persistencia:
- **`GET /compras`**: Retorna el histórico de compras (`SELECT * FROM compra`).
- **`GET /compras/:id`**: Retorna una compra puntual o 404 si no existe.
- **`POST /compras`**:
  1. Valida campos obligatorios: `{ id_compra, clienteId, productoId, fecha, cantidad }`.
  2. Dentro de un bloque `try/catch`, invoca `obtenerCliente(clienteId)` y `obtenerProducto(productoId)`.
  3. Si ocurre un fallo de red o el servicio destino está caído, el `catch` captura el error y responde inmediatamente con **`503 Service Unavailable`** informando el detalle.
  4. Valida que el cliente exista; si es `null`, responde **`404`** (`"El cliente X no existe"`).
  5. Valida que el producto exista; si es `null`, responde **`404`** (`"El producto Y no existe"`).
  6. Compara el stock disponible del producto contra la cantidad pedida:
     ```javascript
     if (producto.stock < cantidad) {
         return res.status(400).json(`Stock insuficiente. Disponible ${producto.stock}, solicitado ${cantidad}`);
     }
     ```
  7. Inserta la compra en PostgreSQL:
     ```javascript
     INSERT INTO compra (id_compra, id_cliente, id_producto, fecha, cantidad)
     VALUES ($1, $2, $3, $4, $5) RETURNING *
     ```
  8. Responde con la compra registrada y código **`201 Created`**.

---

## 4. Instalación y Configuración del Entorno (Sin Docker)

### Requisitos Previos
- **Node.js**: Versión 18 o superior (verificar con `node -v`).
- **npm**: Gestor de paquetes (verificar con `npm -v`).
- **PostgreSQL**: Servidor de base de datos relacional.

### Paso 1: Instalación de PostgreSQL en Linux Mint / Ubuntu

Ejecuta el script automatizado provisto en el proyecto:
```bash
cd /home/naciscric/Documentos/Backend/taller2
./install-and-setup-postgres.sh
```

*O si prefieres ejecutar los comandos de forma manual en tu terminal:*
```bash
# 1. Instalar paquetes de PostgreSQL
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# 2. Iniciar y habilitar el servicio del sistema
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 3. Establecer la contraseña 'postgres' para el usuario 'postgres'
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"

# 4. Crear la base de datos y poblar las tablas
node setup-db.js
```

### Paso 2: Verificación de la Base de Datos

Puedes verificar que las tablas y los registros se hayan cargado conectándote a `psql`:
```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d taller2_db -c "\dt"
```
Verás las tres tablas: `cliente`, `compra` y `producto`.

---

## 5. Puesta en Marcha

Para correr el sistema completo sin Docker, abre **tres terminales independientes** para mantener los logs en vivo de cada servicio:

### Terminal 1: Iniciar `cliente-api`
```bash
cd /home/naciscric/Documentos/Backend/taller2/cliente-api
npm run dev
```
> Salida esperada: `Cliente-api escuchando en el puerto 3001`

### Terminal 2: Iniciar `producto-api`
```bash
cd /home/naciscric/Documentos/Backend/taller2/producto-api
npm run dev
```
> Salida esperada: `producto-api escuchando en el puerto 3002`

### Terminal 3: Iniciar `compra-api`
```bash
cd /home/naciscric/Documentos/Backend/taller2/compra-api
npm run dev
```
> Salida esperada: `Compra-api escuchando en el puerto 3003`

---

## 6. Guía de Pruebas con cURL

Abre una **cuarta terminal** para ejecutar las peticiones de prueba a continuación:

### 1. Comprobación de Estado (Health Checks)

Verifica que cada microservicio responda y que su conexión a PostgreSQL sea válida:

```bash
# Health Check Cliente API
curl -s http://localhost:3001/ | jq

# Health Check Producto API
curl -s http://localhost:3002/ | jq

# Health Check Compra API
curl -s http://localhost:3003/ | jq
```
*(Nota: Si no tienes instalada la herramienta `jq` para formatear JSON, puedes omitir `| jq`)*.

---

### 2. Pruebas CRUD en `cliente-api` (Puerto 3001)

#### Listar todos los clientes:
```bash
curl -X GET http://localhost:3001/clientes
```

#### Consultar un cliente específico por ID (Ej: ID 1):
```bash
curl -X GET http://localhost:3001/clientes/1
```

#### Consultar un cliente inexistente (Ej: ID 999):
```bash
curl -X GET http://localhost:3001/clientes/999
```
*Respuesta esperada: `404 Not Found`*
```json
{"error":"Usuario no encontrado"}
```

#### Registrar un nuevo cliente:
```bash
curl -X POST http://localhost:3001/clientes \
  -H "Content-Type: application/json" \
  -d '{
    "id_cliente": 6,
    "nombre": "Valentina Castro",
    "email": "valentina.castro@example.com"
  }'
```

---

### 3. Pruebas CRUD en `producto-api` (Puerto 3002)

#### Listar todos los productos:
```bash
curl -X GET http://localhost:3002/productos
```

#### Consultar un producto por ID (Ej: ID 1 - Teclado Mecánico):
```bash
curl -X GET http://localhost:3002/productos/1
```

#### Consultar un producto inexistente:
```bash
curl -X GET http://localhost:3002/productos/999
```
*Respuesta esperada: `404 Not Found`*
```json
{"error":"Producto no encontrado"}
```

#### Registrar un nuevo producto:
```bash
curl -X POST http://localhost:3002/productos \
  -H "Content-Type: application/json" \
  -d '{
    "id_producto": 6,
    "nombre": "Pad Mouse XXL Gamer",
    "precio": 45000,
    "stock": 25
  }'
```

---

### 4. Pruebas de Integración y Reglas de Negocio en `compra-api` (Puerto 3003)

#### Caso 1: Compra Exitosa (Validación completa correcta)
Cliente 1 compra 2 unidades del Producto 1 (dispone de 15 unidades en stock):
```bash
curl -X POST http://localhost:3003/compras \
  -H "Content-Type: application/json" \
  -d '{
    "id_compra": 6,
    "clienteId": 1,
    "productoId": 1,
    "fecha": "2026-09-23T12:00:00Z",
    "cantidad": 2
  }'
```
*Respuesta esperada (Código 201 Created):*
```json
{
  "id_compra": 6,
  "id_cliente": 1,
  "id_producto": 1,
  "fecha": "2026-09-23T12:00:00.000Z",
  "cantidad": 2
}
```

---

#### Caso 2: Cliente Inexistente (Error 404)
Intentar registrar una compra asignada al cliente 999:
```bash
curl -X POST http://localhost:3003/compras \
  -H "Content-Type: application/json" \
  -d '{
    "id_compra": 7,
    "clienteId": 999,
    "productoId": 1,
    "fecha": "2026-09-23T12:05:00Z",
    "cantidad": 1
  }'
```
*Respuesta esperada (Código 404 Not Found):*
```json
{"mensaje":"El cliente 999 no existe"}
```

---

#### Caso 3: Producto Inexistente (Error 404)
Intentar comprar un producto con ID 999 que no existe en el catálogo:
```bash
curl -X POST http://localhost:3003/compras \
  -H "Content-Type: application/json" \
  -d '{
    "id_compra": 8,
    "clienteId": 1,
    "productoId": 999,
    "fecha": "2026-09-23T12:10:00Z",
    "cantidad": 1
  }'
```
*Respuesta esperada (Código 404 Not Found):*
```json
{"mensaje":"El producto 999 no existe"}
```

---

#### Caso 4: Stock Insuficiente (Error 400)
El Producto 5 (Silla Ergonómica) solo tiene 5 unidades en stock. Intentamos solicitar 10 unidades:
```bash
curl -X POST http://localhost:3003/compras \
  -H "Content-Type: application/json" \
  -d '{
    "id_compra": 9,
    "clienteId": 2,
    "productoId": 5,
    "fecha": "2026-09-23T12:15:00Z",
    "cantidad": 10
  }'
```
*Respuesta esperada (Código 400 Bad Request):*
```json
"Stock insuficiente. Disponible 5, solicitado 10"
```

---

#### Caso 5: Simulación de Servicio Caído (Error 503)
1. Detén el microservicio `producto-api` presionando `Ctrl + C` en su terminal.
2. Vuelve a intentar una compra que sería válida:
```bash
curl -X POST http://localhost:3003/compras \
  -H "Content-Type: application/json" \
  -d '{
    "id_compra": 10,
    "clienteId": 1,
    "productoId": 2,
    "fecha": "2026-09-23T12:20:00Z",
    "cantidad": 1
  }'
```
*Respuesta esperada (Código 503 Service Unavailable):*
```json
{
  "mensaje": "No se pudo validar la compra porque uno de los servicios no respondio",
  "detalle": "fetch failed"
}
```
*(Reinicia `producto-api` con `npm run dev` para recuperar la disponibilidad del sistema).*

---

#### Consultar Compras Registradas en `compra-api`
```bash
# Listar todas las compras
curl -X GET http://localhost:3003/compras

# Consultar la compra con ID 1
curl -X GET http://localhost:3003/compras/1
```

---

## 7. Buenas Prácticas y Manejo de Errores

1. **Separación de Responsabilidades y Dominios**: Ningún microservicio tiene acceso directo a las tablas de otro microservicio. La consistencia se garantiza a través de contratos de API REST claros.
2. **Uso Semántico del Protocolo HTTP**:
   - `200 OK`: Operaciones de lectura exitosas.
   - `201 Created`: Creación exitosa de recursos.
   - `400 Bad Request`: Peticiones con datos faltantes o reglas de negocio violadas (ej. falta de stock).
   - `404 Not Found`: Recurso no encontrado.
   - `500 Internal Server Error`: Fallos imprevistos en el servidor o la base de datos local.
   - `503 Service Unavailable`: Servicios aguas abajo inaccesibles o caídos.
3. **Resiliencia y Parámetros Seguros**: Todas las consultas a PostgreSQL utilizan consultas preparadas parametrizadas (`$1`, `$2`, etc.), eliminando vulnerabilidades de inyección SQL (SQL Injection).
4. **Configuración Externa**: Direcciones IP, URLs y credenciales no están quemadas en código duro, permitiendo alternar fácilmente entre ejecución local y orquestación con Docker sin alterar el código fuente.
