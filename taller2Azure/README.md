# Taller 2 en Azure - Microservicios en VM1 (Docker) y PostgreSQL en VM2

Despliegue en la nube (**Microsoft Azure**) de la arquitectura de microservicios del Taller 2 (**Node.js**, **Express**, **Sequelize ORM** y **PostgreSQL**) distribuida en **dos máquinas virtuales (VMs)** conectadas mediante una **Red Virtual privada (VNet)**:

- **VM1 (Servidor de Aplicaciones)**: Expuesta a internet, ejecuta los tres microservicios (`cliente-api`, `producto-api`, `compra-api`) en contenedores Docker.
- **VM2 (`vm-bd-postgres` - Servidor de Base de Datos)**: Con IP privada **`172.16.0.5`** y **sin IP pública**, ejecuta PostgreSQL instalado de forma nativa. Solo acepta tráfico en el puerto `5432` proveniente de la red interna de Azure (`172.16.0.0/24`).

---

## Tabla de Contenidos

1. [Arquitectura Desplegada en Azure](#1-arquitectura-desplegada-en-azure)
2. [Estructura del Proyecto (`taller2Azure/`)](#2-estructura-del-proyecto-taller2azure)
3. [¿Qué se adaptó respecto a `taller2/`?](#3-qué-se-adaptó-respecto-a-taller2)
   - [Adaptación de Variables de Entorno (`.env`)](#31-adaptación-de-variables-de-entorno-env)
   - [Adaptación de la Capa de Conexión Sequelize (`config/database.js`)](#32-adaptación-de-la-capa-de-conexión-sequelize-configdatabasejs)
   - [Adaptación de `docker-compose.yml` y `docker-compose.production.yml`](#33-adaptación-de-docker-composeyml-y-docker-composeproductionyml)
   - [Separación de la Base de Datos en `VM2/init.sql`](#34-separación-de-la-base-de-datos-en-vm2initsql)
4. [Detalle del Script de Base de Datos (`VM2/init.sql`)](#4-detalle-del-script-de-base-de-datos-vm2initsql)
5. [Guía Paso a Paso de Configuración y Comandos Ejecutados](#5-guía-paso-a-paso-de-configuración-y-comandos-ejecutados)
   - [5.1 Reglas de Red (NSG) en Azure](#51-reglas-de-red-nsg-en-azure)
   - [5.2 Conexión SSH Puente (Bastión) y Copia de Archivos](#52-conexión-ssh-puente-bastión-y-copia-de-archivos)
   - [5.3 Instalación de PostgreSQL en VM2](#53-instalación-de-postgresql-en-vm2)
   - [5.4 Creación de Base de Datos, Usuario, Permisos y Carga de `init.sql`](#54-creación-de-base-de-datos-usuario-permisos-y-carga-de-initsql)
   - [5.5 Configuración de Escucha y Acceso de Red en PostgreSQL (`postgresql.conf` y `pg_hba.conf`)](#55-configuración-de-escucha-y-acceso-de-red-en-postgresql-postgresqlconf-y-pg_hbaconf)
   - [5.6 Prueba de Conexión desde VM1 hacia VM2](#56-prueba-de-conexión-desde-vm1-hacia-vm2)
   - [5.7 Despliegue de las 3 APIs en VM1 con Docker](#57-despliegue-de-las-3-apis-en-vm1-con-docker)
6. [Pruebas con Postman y cURL](#6-pruebas-con-postman-y-curl)
7. [Comparativa: Entorno Local vs. Dos VMs en Azure](#7-comparativa-entorno-local-vs-dos-vms-en-azure)
8. [Solución de Problemas (Troubleshooting)](#8-solución-de-problemas-troubleshooting)

---

## 1. Arquitectura Desplegada en Azure

```text
                                Internet
                                   |
        Puertos abiertos en NSG de VM1: 22 (SSH), 3001, 3002, 3003
                                   |
                                   v
+-----------------------------------------------------------------------+
| VM1 (Ubuntu Server + Docker + Docker Compose)                         |
| IP Pública: [IP-PÚBLICA-VM1]  |  IP Privada VNet: 172.16.0.x          |
|                                                                       |
|  +-------------------+   +-------------------+   +-----------------+  |
|  |    cliente-api    |   |   producto-api    |   |   compra-api    |  |
|  |   (Puerto 3001)   |   |   (Puerto 3002)   |   |  (Puerto 3003)  |  |
|  +---------+---------+   +---------+---------+   +--------+--------+  |
|            ^                       ^                      |           |
|            |                       |  HTTP GET / PUT      |           |
|            +-----------------------+----------------------+           |
|              Red interna de Docker (http://cliente-api:3001,          |
|                                     http://producto-api:3002)         |
+------------+-----------------------+----------------------+-----------+
             |                       |                      |
             +-----------------------+----------------------+
                                     |
                     Conexión TCP Puerto 5432 (Sequelize)
                     Tráfico exclusivo por la VNet privada (172.16.0.0/24)
                                     |
                                     v
+-----------------------------------------------------------------------+
| VM2: vm-bd-postgres (Ubuntu Server + PostgreSQL Nativo)               |
| IP Privada VNet: 172.16.0.5  |  IP Pública: NINGUNA (Aislada)         |
|                                                                       |
|  +-----------------------------------------------------------------+  |
|  | PostgreSQL (Puerto 5432)                                        |  |
|  | Base de datos: taller2_db  |  Usuario: api_user                 |  |
|  | Tablas: cliente, producto, compra (inicializadas con init.sql)  |  |
|  +-----------------------------------------------------------------+  |
+-----------------------------------------------------------------------+
```

### Seguridad en Capas Aplicada
1. **Aislamiento de la Base de Datos**: `VM2` no tiene dirección IP pública. Nadie desde internet puede alcanzar directamente el servidor de PostgreSQL.
2. **Control por NSG (Network Security Group)**: `VM2` solo permite tráfico de entrada en el puerto `5432` desde la IP privada de `VM1` dentro de la VNet (`172.16.0.0/24`).
3. **Autenticación y Permisos en PostgreSQL**: Las APIs no usan el superusuario `postgres`, sino un usuario dedicado (`api_user`) restringido en `pg_hba.conf` con cifrado `scram-sha-256` al segmento de red privado `172.16.0.0/24`.

---

## 2. Estructura del Proyecto (`taller2Azure/`)

El proyecto se dividió en dos carpetas principales (`VM1/` y `VM2/`), correspondiendo exactamente a los archivos que deben subirse a cada máquina virtual:

```text
taller2Azure/
├── README.md                           # Este documento con toda la explicación del proyecto
│
├── VM1/                                # Todo el código y configuración que se despliega en la VM1
│   ├── .env                            # Variables globales (puertos y conexión a 172.16.0.5)
│   ├── .env.example                    # Plantilla de variables globales
│   ├── docker-compose.yml              # Orquestación de las 3 APIs (modo desarrollo) apuntando a VM2
│   ├── docker-compose.production.yml   # Orquestación de las 3 APIs (modo producción) apuntando a VM2
│   │
│   ├── cliente-api/                    # Microservicio de Clientes (Puerto 3001)
│   │   ├── dockerfile                  # Imagen multi-stage (development / production)
│   │   ├── package.json
│   │   ├── .env                        # Configurado con DB_HOST=172.16.0.5 y DB_USER=api_user
│   │   ├── .env.example
│   │   └── src/
│   │       ├── config/database.js      # Conexión Sequelize apuntando a 172.16.0.5
│   │       ├── models/cliente.js
│   │       ├── controllers/clienteController.js
│   │       ├── routes/clientes.routes.js
│   │       ├── app.js
│   │       └── server.js
│   │
│   ├── producto-api/                   # Microservicio de Productos (Puerto 3002)
│   │   ├── dockerfile
│   │   ├── package.json
│   │   ├── .env                        # Configurado con DB_HOST=172.16.0.5 y DB_USER=api_user
│   │   ├── .env.example
│   │   └── src/
│   │       ├── config/database.js      # Conexión Sequelize apuntando a 172.16.0.5
│   │       ├── models/producto.js
│   │       ├── controllers/productoController.js
│   │       ├── routes/productos.routes.js
│   │       ├── app.js
│   │       └── server.js
│   │
│   └── compra-api/                     # Microservicio Orquestador de Compras (Puerto 3003)
│       ├── dockerfile
│       ├── package.json
│       ├── .env                        # Configurado con DB_HOST=172.16.0.5 y URLs de cliente/producto
│       ├── .env.example
│       └── src/
│           ├── config/database.js      # Conexión Sequelize apuntando a 172.16.0.5
│           ├── models/compra.js
│           ├── services/
│           │   ├── clienteService.js   # Consulta HTTP a cliente-api
│           │   └── productoService.js  # Consulta HTTP y ajuste de stock en producto-api
│           ├── controllers/compraController.js
│           ├── routes/compras.routes.js
│           ├── app.js
│           └── server.js
│
└── VM2/                                # Archivos que se despliegan en la VM2 (Base de Datos)
    └── init.sql                        # Creación de tablas, relaciones, semillas y secuencias
```

---

## 3. ¿Qué se adaptó respecto a `taller2/`?

En la versión original (`taller2/`), todo corría en una sola máquina usando un contenedor de PostgreSQL (`DB_HOST=postgres`) dentro de Docker Compose. Para migrar a la arquitectura de dos VMs en Azure se realizaron los siguientes cambios:

### 3.1 Adaptación de Variables de Entorno (`.env`)
Se actualizaron todos los archivos `.env` y `.env.example` (tanto en la raíz de `VM1/` como dentro de `cliente-api/`, `producto-api/` y `compra-api/`) con los datos reales de la `VM2`:

| Variable | Valor en `taller2/` (Local) | Valor en `taller2Azure/VM1/` (Azure) | Descripción |
|---|---|---|---|
| `DB_HOST` | `localhost` / `postgres` | `172.16.0.5` | IP privada de la VM2 en la VNet de Azure |
| `DB_PORT` | `5432` | `5432` | Puerto de PostgreSQL en VM2 |
| `DB_NAME` | `taller2_db` | `taller2_db` | Nombre de la base de datos compartida |
| `DB_USER` | `postgres` | `api_user` | Usuario dedicado creado en PostgreSQL de VM2 |
| `DB_PASSWORD` | `postgres` | `postgres` | Contraseña asignada a `api_user` |
| `CLIENTE_API_URL` | `http://localhost:3001` | `http://cliente-api:3001` | Nombre DNS interno en la red Docker de VM1 |
| `PRODUCTO_API_URL` | `http://localhost:3002` | `http://producto-api:3002` | Nombre DNS interno en la red Docker de VM1 |

### 3.2 Adaptación de la Capa de Conexión Sequelize (`config/database.js`)
En los tres microservicios (`cliente-api/src/config/database.js`, `producto-api/src/config/database.js` y `compra-api/src/config/database.js`), se actualizaron los valores de respaldo (*fallback*) de Sequelize para que apunten por defecto a `172.16.0.5` y `api_user`:

```javascript
const sequelize = new Sequelize(
  process.env.DB_NAME || 'taller2_db',
  process.env.DB_USER || 'api_user',
  process.env.DB_PASSWORD !== undefined ? String(process.env.DB_PASSWORD) : 'postgres',
  {
    host: process.env.DB_HOST || '172.16.0.5',
    port: Number(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: false,
  }
);
```

### 3.3 Adaptación de `docker-compose.yml` y `docker-compose.production.yml`
En `VM1/docker-compose.yml` y `VM1/docker-compose.production.yml`:
1. **Se eliminó el servicio `postgres` y el volumen `pgdata`**: La base de datos ya no vive en un contenedor dentro de VM1, sino instalada directamente en el disco de VM2.
2. **Se eliminó el bloque `depends_on: postgres`**: Los contenedores de las APIs arrancan en VM1 y se conectan directamente por red a `172.16.0.5:5432`.
3. **Se actualizaron las variables `environment`** de los tres servicios con:
   ```yaml
   environment:
       - DB_HOST=${DB_HOST:-172.16.0.5}
       - DB_PORT=${DB_PORT:-5432}
       - DB_NAME=${DB_NAME:-taller2_db}
       - DB_USER=${DB_USER:-api_user}
       - DB_PASSWORD=${DB_PASSWORD:-postgres}
   ```
4. **Se conservó la red interna de Docker Compose en VM1**: Así `compra-api` sigue comunicándose con `http://cliente-api:3001` y `http://producto-api:3002` sin salir a internet.

### 3.4 Separación de la Base de Datos en `VM2/init.sql`
El archivo `init.sql` se ubicó en `taller2Azure/VM2/init.sql` para ser transferido a la `VM2` y ejecutado directamente con `psql` sobre la base de datos `taller2_db`.

---

## 4. Detalle del Script de Base de Datos (`VM2/init.sql`)

El script `VM2/init.sql` construye todo el esquema relacional y carga los datos iniciales:

1. **Tabla `cliente`**:
   - `id_cliente SERIAL PRIMARY KEY`
   - `nombre VARCHAR(100) NOT NULL`
   - `email VARCHAR(100) UNIQUE NOT NULL`
2. **Tabla `producto`**:
   - `id_producto SERIAL PRIMARY KEY`
   - `nombre VARCHAR(100) NOT NULL`
   - `precio NUMERIC(10, 2) NOT NULL`
   - `stock INT NOT NULL CHECK (stock >= 0)` (impide stock negativo a nivel de motor de BD).
3. **Tabla `compra`**:
   - `id_compra SERIAL PRIMARY KEY`
   - `id_cliente INT NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE`
   - `id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE`
   - `cantidad INT NOT NULL CHECK (cantidad > 0)`
   - `total NUMERIC(12, 2) NOT NULL CHECK (total >= 0)`
   - `fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`
4. **Datos Semilla (`INSERT ... ON CONFLICT DO NOTHING`)**:
   - Inserta 5 clientes, 5 productos y 5 compras iniciales de forma idempotente (si se ejecuta más de una vez no duplica ni falla).
5. **Sincronización de Secuencias (`setval`)**:
   ```sql
   SELECT setval('cliente_id_cliente_seq', COALESCE((SELECT MAX(id_cliente) FROM cliente), 1));
   SELECT setval('producto_id_producto_seq', COALESCE((SELECT MAX(id_producto) FROM producto), 1));
   SELECT setval('compra_id_compra_seq', COALESCE((SELECT MAX(id_compra) FROM compra), 1));
   ```
   Ajusta los contadores automáticos (`SERIAL`) en `5` para que el próximo `POST` realizado desde las APIs cree el registro con ID `6` sin colisionar con los IDs insertados manualmente.

---

## 5. Guía Paso a Paso de Configuración y Comandos Ejecutados

### 5.1 Reglas de Red (NSG) en Azure

- **En el NSG de VM1** (accesible desde internet):
  - Puerto `22` (TCP): SSH.
  - Puerto `3001` (TCP): `cliente-api`.
  - Puerto `3002` (TCP): `producto-api`.
  - Puerto `3003` (TCP): `compra-api`.
- **En el NSG de VM2 (`vm-bd-postgres`, IP privada `172.16.0.5`, sin IP pública)**:
  - Regla de entrada `allow-postgres-from-vm1`:
    - **Origen**: IP privada de VM1 (o rango de la VNet `172.16.0.0/24`).
    - **Puerto de destino**: `5432` (TCP).
    - **Acción**: Permitir.

---

### 5.2 Conexión SSH Puente (Bastión) y Copia de Archivos

Como `VM2` no tiene IP pública, se usa `VM1` como puente:

```bash
# 1. Copiar llave SSH a VM1 (desde tu equipo local)
scp -i ~/.ssh/vm-taller-key ~/.ssh/vm-taller-key azureuser@[IP-PÚBLICA-VM1]:~/.ssh/vm-taller-key

# 2. Copiar los archivos de VM1/ y VM2/ a VM1 (desde tu equipo local)
scp -i ~/.ssh/vm-taller-key -r taller2Azure/VM1 taller2Azure/VM2 azureuser@[IP-PÚBLICA-VM1]:~/

# 3. Entrar por SSH a VM1
ssh -i ~/.ssh/vm-taller-key azureuser@[IP-PÚBLICA-VM1]

# 4. Desde dentro de VM1, ajustar permisos de la llave y copiar init.sql a VM2 (172.16.0.5)
chmod 400 ~/.ssh/vm-taller-key
scp -i ~/.ssh/vm-taller-key ~/VM2/init.sql azureuser@172.16.0.5:~/init.sql

# 5. Desde dentro de VM1, conectarse por SSH a VM2
ssh -i ~/.ssh/vm-taller-key azureuser@172.16.0.5
```

---

### 5.3 Instalación de PostgreSQL en VM2

Dentro de `VM2` (`azureuser@vm-bd-postgres:~$`):

```bash
# Actualizar repositorios y paquetes del sistema
sudo apt update && sudo apt upgrade -y

# Instalar PostgreSQL y utilidades adicionales
sudo apt install -y postgresql postgresql-contrib

# Verificar que el servicio está activo (Active: active (running))
sudo systemctl status postgresql
```

---

### 5.4 Creación de Base de Datos, Usuario, Permisos y Carga de `init.sql`

Dentro de `VM2`, se ejecutaron estos comandos para crear la base de datos `taller2_db`, el rol `api_user` con contraseña `postgres`, y otorgar permisos tanto sobre la base de datos como sobre el esquema `public` (obligatorio desde PostgreSQL 15+):

```bash
# 1. Crear la base de datos taller2_db
sudo -u postgres psql -c "CREATE DATABASE taller2_db;"

# 2. Crear el usuario api_user con contraseña 'postgres'
sudo -u postgres psql -c "CREATE USER api_user WITH PASSWORD 'postgres';"

# 3. Otorgar privilegios sobre la base de datos a api_user
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE taller2_db TO api_user;"

# 4. Otorgar privilegios sobre el esquema public (requerido en PostgreSQL 15+)
sudo -u postgres psql -d taller2_db -c "GRANT ALL ON SCHEMA public TO api_user;"
```

Luego, se ejecutó el archivo `init.sql` autenticándose directamente como **`api_user`** (para que `api_user` quede como propietario de las tablas `cliente`, `producto`, `compra` y de sus secuencias, permitiendo que Sequelize ejecute `sequelize.sync({ alter: true })` sin errores de permisos):

```bash
# 5. Cargar las tablas, datos iniciales y secuencias desde init.sql
PGPASSWORD=postgres psql -h 127.0.0.1 -U api_user -d taller2_db -f init.sql

# 6. Verificar que los datos se crearon correctamente
PGPASSWORD=postgres psql -h 127.0.0.1 -U api_user -d taller2_db -c "SELECT * FROM cliente;"
PGPASSWORD=postgres psql -h 127.0.0.1 -U api_user -d taller2_db -c "SELECT * FROM producto;"
PGPASSWORD=postgres psql -h 127.0.0.1 -U api_user -d taller2_db -c "SELECT * FROM compra;"
```

---

### 5.5 Configuración de Escucha y Acceso de Red en PostgreSQL (`postgresql.conf` y `pg_hba.conf`)

Por defecto PostgreSQL solo escucha conexiones locales (`127.0.0.1`). Para permitir que `VM1` se conecte a `VM2` (`172.16.0.5`):

1. **Identificar la versión instalada**:
   ```bash
   ls /etc/postgresql/
   ```
2. **Habilitar escucha en todas las interfaces de red (`postgresql.conf`)**:
   ```bash
   sudo nano /etc/postgresql/[VERSION]/main/postgresql.conf
   ```
   Se cambió `#listen_addresses = 'localhost'` por:
   ```text
   listen_addresses = '*'
   ```
3. **Autorizar el segmento de red privado de Azure en `pg_hba.conf`**:
   ```bash
   sudo nano /etc/postgresql/[VERSION]/main/pg_hba.conf
   ```
   Se agregó al final del archivo la regla para la subred `172.16.0.0/24`:
   ```text
   host    taller2_db    api_user    172.16.0.0/24    scram-sha-256
   ```
4. **Reiniciar PostgreSQL y confirmar el puerto `5432` en `0.0.0.0`**:
   ```bash
   sudo systemctl restart postgresql
   sudo ss -tlnp | grep 5432
   ```
   Salida obtenida:
   ```text
   LISTEN 0      200          0.0.0.0:5432      0.0.0.0:*    users:(("postgres",pid=1758,fd=6))
   LISTEN 0      200             [::]:5432         [::]:*    users:(("postgres",pid=1758,fd=7))
   ```
5. **Salir de VM2 para volver a VM1**:
   ```bash
   exit
   ```

---

### 5.6 Prueba de Conexión desde VM1 hacia VM2

Desde `VM1`, antes de levantar los contenedores, se puede verificar la conectividad directa hacia `172.16.0.5`:

```bash
sudo apt update && sudo apt install -y postgresql-client
PGPASSWORD=postgres psql -h 172.16.0.5 -U api_user -d taller2_db -c "SELECT * FROM cliente;"
```

---

### 5.7 Despliegue de las 3 APIs en VM1 con Docker

Dentro de `VM1`, ubicándose en la carpeta `~/VM1`:

#### Opción A: Con Docker Compose (Recomendado - levanta las 3 APIs y su red interna)
```bash
cd ~/VM1

# Levantar en modo producción (imágenes optimizadas con npm ci --omit=dev)
docker compose -f docker-compose.production.yml up -d --build

# O levantar en modo desarrollo
docker compose up -d --build

# Verificar que los 3 contenedores están corriendo
docker compose ps

# Ver logs de conexión a la BD en VM2
docker compose logs -f cliente-api producto-api compra-api
```

En los logs de cada microservicio se observa:
```text
Conexión a la base de datos establecida en cliente-api.
Modelos sincronizados con la base de datos.
Cliente-api escuchando en el puerto 3001
```

#### Opción B: Con comandos `docker build` y `docker run` individuales
Si se desea levantar cada contenedor manualmente creando una red de Docker en `VM1`:

```bash
cd ~/VM1

# 1. Crear red en Docker para que compra-api resuelva cliente-api y producto-api
docker network create taller2-net

# 2. Construir las imágenes de producción
docker build --target production -t cliente-api:2.0 ./cliente-api
docker build --target production -t producto-api:2.0 ./producto-api
docker build --target production -t compra-api:2.0 ./compra-api

# 3. Ejecutar cliente-api (Puerto 3001)
docker run -d -p 3001:3001 --network taller2-net \
  -e DB_HOST=172.16.0.5 -e DB_PORT=5432 -e DB_NAME=taller2_db \
  -e DB_USER=api_user -e DB_PASSWORD=postgres -e PORT=3001 \
  --name cliente-api --restart unless-stopped cliente-api:2.0

# 4. Ejecutar producto-api (Puerto 3002)
docker run -d -p 3002:3002 --network taller2-net \
  -e DB_HOST=172.16.0.5 -e DB_PORT=5432 -e DB_NAME=taller2_db \
  -e DB_USER=api_user -e DB_PASSWORD=postgres -e PORT=3002 \
  --name producto-api --restart unless-stopped producto-api:2.0

# 5. Ejecutar compra-api (Puerto 3003)
docker run -d -p 3003:3003 --network taller2-net \
  -e DB_HOST=172.16.0.5 -e DB_PORT=5432 -e DB_NAME=taller2_db \
  -e DB_USER=api_user -e DB_PASSWORD=postgres -e PORT=3003 \
  -e CLIENTE_API_URL=http://cliente-api:3001 \
  -e PRODUCTO_API_URL=http://producto-api:3002 \
  --name compra-api --restart unless-stopped compra-api:2.0
```

---

## 6. Pruebas con Postman y cURL

Reemplaza `[IP-PÚBLICA-VM1]` por la dirección IP pública de tu `VM1`:

### Health Checks (Verificación de conexión API -> PostgreSQL en VM2)
- `GET http://[IP-PÚBLICA-VM1]:3001/`
- `GET http://[IP-PÚBLICA-VM1]:3002/`
- `GET http://[IP-PÚBLICA-VM1]:3003/`

### Endpoints CRUD por Microservicio

| Microservicio | Método | URL | Body JSON de ejemplo |
|---|---|---|---|
| **Clientes** (`3001`) | `GET` | `http://[IP-PÚBLICA-VM1]:3001/clientes` | — |
| **Clientes** (`3001`) | `GET` | `http://[IP-PÚBLICA-VM1]:3001/clientes/1` | — |
| **Clientes** (`3001`) | `POST` | `http://[IP-PÚBLICA-VM1]:3001/clientes` | `{"nombre": "Carlos Gómez", "email": "carlos@test.com"}` |
| **Clientes** (`3001`) | `PUT` | `http://[IP-PÚBLICA-VM1]:3001/clientes/6` | `{"nombre": "Carlos G. Modificado"}` |
| **Clientes** (`3001`) | `DELETE` | `http://[IP-PÚBLICA-VM1]:3001/clientes/6` | — |
| **Productos** (`3002`) | `GET` | `http://[IP-PÚBLICA-VM1]:3002/productos` | — |
| **Productos** (`3002`) | `GET` | `http://[IP-PÚBLICA-VM1]:3002/productos/1` | — |
| **Productos** (`3002`) | `POST` | `http://[IP-PÚBLICA-VM1]:3002/productos` | `{"nombre": "Mouse Gamer Pro", "precio": 120000, "stock": 15}` |
| **Productos** (`3002`) | `PUT` | `http://[IP-PÚBLICA-VM1]:3002/productos/6` | `{"precio": 110000, "stock": 18}` |
| **Productos** (`3002`) | `DELETE` | `http://[IP-PÚBLICA-VM1]:3002/productos/6` | — |
| **Compras** (`3003`) | `GET` | `http://[IP-PÚBLICA-VM1]:3003/compras` | — |
| **Compras** (`3003`) | `GET` | `http://[IP-PÚBLICA-VM1]:3003/compras/1` | — |
| **Compras** (`3003`) | `POST` | `http://[IP-PÚBLICA-VM1]:3003/compras` | `{"clienteId": 1, "productoId": 1, "cantidad": 2}` |
| **Compras** (`3003`) | `PUT` | `http://[IP-PÚBLICA-VM1]:3003/compras/1` | `{"cantidad": 3}` |
| **Compras** (`3003`) | `DELETE` | `http://[IP-PÚBLICA-VM1]:3003/compras/1` | — |

### Prueba de Persistencia entre VMs
Si reinicias los contenedores en `VM1`:
```bash
docker compose restart
```
Al volver a consultar `GET http://[IP-PÚBLICA-VM1]:3001/clientes` o `/compras`, todos los datos permanecen intactos porque viven en el disco de PostgreSQL en `VM2` (`172.16.0.5`).

---

## 7. Comparativa: Entorno Local vs. Dos VMs en Azure

| Característica | `taller2/` (Docker Compose Local) | `taller2Azure/` (Dos VMs en Azure) |
|---|---|---|
| **Dónde corre las APIs** | Contenedores en tu PC local | Contenedores en **VM1** de Azure |
| **Dónde vive PostgreSQL** | Contenedor `postgres:17-alpine` local | Instalado nativamente en **VM2** (`172.16.0.5`) |
| **Dónde se guardan los datos** | Volumen Docker `pgdata` local | Disco persistente de **VM2** |
| **`DB_HOST`** | `postgres` (DNS de Docker) | `172.16.0.5` (IP privada en la VNet) |
| **Accesible desde internet** | No (`localhost`) | Sí, solo las APIs en **VM1** (`3001`, `3002`, `3003`) |
| **BD expuesta a internet** | No | No (**VM2** no tiene IP pública) |

---

## 8. Solución de Problemas (Troubleshooting)

| Error / Síntoma | Causa | Solución |
|---|---|---|
| `ERROR: role "api_user" does not exist` | Se intentó alterar o usar el usuario antes de crearlo en PostgreSQL | Ejecutar `sudo -u postgres psql -c "CREATE USER api_user WITH PASSWORD 'postgres';"` en VM2 |
| `FATAL: password authentication failed for user "azureuser"` | El comando `psql` se partió en dos líneas al pegarse en la terminal y omitió `-U api_user` | Ejecutar el comando en una sola línea: `PGPASSWORD=postgres psql -h 127.0.0.1 -U api_user -d taller2_db ...` |
| `FATAL: password authentication failed for user "api_user"` | La contraseña de `api_user` no coincide con `DB_PASSWORD` | Ejecutar `sudo -u postgres psql -c "ALTER USER api_user WITH PASSWORD 'postgres';"` |
| `permission denied for schema public` | PostgreSQL 15+ no otorga permisos sobre `public` por defecto a usuarios nuevos | Ejecutar `sudo -u postgres psql -d taller2_db -c "GRANT ALL ON SCHEMA public TO api_user;"` |
| `must be owner of table / sequence` al iniciar las APIs | `init.sql` fue ejecutado con el usuario `postgres` en vez de `api_user` | Cargar `init.sql` con `-U api_user` o cambiar dueño: `sudo -u postgres psql -d taller2_db -c "REASSIGN OWNED BY postgres TO api_user;"` |
| `Error: connect ECONNREFUSED 172.16.0.5:5432` | PostgreSQL solo escucha en `localhost` o el NSG de VM2 bloquea el puerto `5432` | Verificar `listen_addresses = '*'` en `postgresql.conf`, reiniciar PostgreSQL y abrir el puerto `5432` en el NSG de VM2 para la IP privada de VM1 |
| `no pg_hba.conf entry for host "172.16.0.x"` | La subred `172.16.0.0/24` no fue agregada en `pg_hba.conf` | Agregar `host taller2_db api_user 172.16.0.0/24 scram-sha-256` al final de `pg_hba.conf` y ejecutar `sudo systemctl restart postgresql` |
