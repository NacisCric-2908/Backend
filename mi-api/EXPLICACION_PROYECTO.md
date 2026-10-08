# Documentación Técnica Completa: API REST de Videojuegos con PostgreSQL, Sequelize y Docker Compose

Este documento detalla de manera exhaustiva la arquitectura por capas, el funcionamiento de cada componente, las instrucciones de puesta en marcha y una guía completa para probar la API contenerizada utilizando **Postman**.

---

## 📁 1. Estructura del Proyecto

La API sigue una arquitectura modular por capas con separación de responsabilidades:

```text
mi-api/
├── src/
│   ├── config/
│   │   └── database.js          # Conexión a PostgreSQL mediante Sequelize ORM
│   ├── models/
│   │   └── juego.js             # Definición del modelo y tabla 'videojuegos'
│   ├── controllers/
│   │   └── juegoController.js   # Lógica de negocio y manejo de peticiones CRUD
│   ├── routes/
│   │   └── juegoRoutes.js       # Definición de rutas y endpoints HTTP
│   └── app.js                   # Configuración de Express y middlewares
├── index.js                     # Punto de entrada: conexión a BD y arranque del servidor
├── .env                         # Variables de entorno locales (credenciales, no en Git)
├── .env.example                 # Plantilla de variables de entorno (rastreado en Git)
├── .dockerignore                # Exclusiones de contexto para Docker
├── .gitignore                   # Exclusiones para control de versiones Git
├── Dockerfile                   # Construcción de la imagen Docker de la API Node.js
├── docker-compose.yml           # Orquestación de contenedores (API + PostgreSQL)
├── package.json                 # Manifiesto de dependencias y scripts
└── package-lock.json            # Árbol de versiones determinista de npm
```

### ¿Por qué esta arquitectura por capas?
* **`config/`**: Centraliza la configuración de la base de datos. Si cambian las credenciales o el host, solo se modifica aquí o en las variables de entorno.
* **`models/`**: Define el esquema de datos y los tipos de columnas con Sequelize. Sequelize se encarga de crear o alterar las tablas en PostgreSQL automáticamente.
* **`controllers/`**: Contiene la lógica CRUD aislada. Cada función es asíncrona (`async/await`) y maneja respuestas HTTP y códigos de estado adecuados.
* **`routes/`**: Asocia los métodos y rutas HTTP a sus controladores correspondientes, manteniendo Express limpio.
* **`app.js`**: Ensambla Express y registra middlewares sin mezclar la inicialización del servidor o de la base de datos.
* **`index.js`**: Coordina el ciclo de vida: valida conexión, sincroniza modelos con la base de datos e inicia el puerto HTTP.

---

## ⚙️ 2. Variables de Entorno y Configuración

### Archivo `.env` (Local)
Define los parámetros de conexión que lee `dotenv`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=videojuegos_db
DB_USER=postgres
DB_PASSWORD=postgres123
PORT=3000
```
> **Nota:** Al ejecutar dentro de Docker Compose, la variable `DB_HOST` se sobreescribe como `db` (el nombre del servicio de PostgreSQL dentro de la red interna de Docker).

### Archivo `.env.example`
Plantilla sin secretos para distribución en repositorios:
```env
DB_HOST=
DB_PORT=5432
DB_NAME=
DB_USER=
DB_PASSWORD=
PORT=3000
```

---

## 🗄️ 3. Modelo de Datos (`Videojuegos`)

El modelo está definido en `src/models/juego.js` sobre la tabla `videojuegos`:

| Campo | Tipo Sequelize | Tipo PostgreSQL | Restricciones / Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `INTEGER` | **Clave Primaria (`primaryKey: true`)**, obligatorio (`allowNull: false`). Proporcionado manualmente por el cliente. |
| `titulo` | `STRING` | `VARCHAR(255)` | Obligatorio (`allowNull: false`). Nombre del juego. |
| `genero` | `STRING` | `VARCHAR(255)` | Obligatorio (`allowNull: false`). Categoría o género. |
| `plataforma` | `STRING` | `VARCHAR(255)` | Obligatorio (`allowNull: false`). Consola/PC. |
| `año` | `INTEGER` | `INTEGER` | Opcional (`allowNull: true`). Año de lanzamiento. |
| `disponible`| `BOOLEAN` | `BOOLEAN` | Opcional, por defecto `true`. Disponibilidad. |
| `createdAt` | `DATE` | `TIMESTAMP WITH TIME ZONE` | Generado automáticamente por Sequelize. |
| `updatedAt` | `DATE` | `TIMESTAMP WITH TIME ZONE` | Actualizado automáticamente por Sequelize. |

---

## 🌐 4. Métodos HTTP y Endpoints Disponibles

La API implementa todos los verbos HTTP estándar de RESTful:

| Método | Endpoint | Descripción | Códigos HTTP |
| :--- | :--- | :--- | :--- |
| **GET** | `/` | Comprobación de estado del servicio e información de rutas | `200 OK` |
| **GET** | `/juegos` | Obtiene el listado completo de videojuegos | `200 OK`, `500 Internal Error` |
| **GET** | `/juegos/:id` | Obtiene un videojuego específico por su identificador | `200 OK`, `400 Bad Request`, `404 Not Found`, `500` |
| **POST** | `/juegos` | Registra un nuevo videojuego | `201 Created`, `400 Bad Request`, `409 Conflict`, `500` |
| **PUT** | `/juegos/:id` | Actualiza los datos de un videojuego existente (el `id` no cambia) | `200 OK`, `400 Bad Request`, `404 Not Found`, `500` |
| **DELETE**| `/juegos/:id` | Elimina un videojuego por su identificador | `200 OK`, `400 Bad Request`, `404 Not Found`, `500` |

---

## 🚀 5. Puesta en Marcha con Docker Compose

La arquitectura contenerizada levanta dos servicios:
1. **`api`**: Contenedor basado en Node.js 20 Alpine con el código fuente y dependencias mínimas.
2. **`db`**: Contenedor oficial de PostgreSQL 16 Alpine con un volumen permanente (`postgres_data`) y comprobación de salud (`healthcheck`).

### 5.1 Iniciar los servicios
Desde la carpeta `mi-api/`:
```bash
docker compose up -d --build
```
> El contenedor de la API espera automáticamente a que PostgreSQL esté saludable (`condition: service_healthy`) antes de iniciar, evitando caídas por conexión rechazada.

### 5.2 Verificar estado y registros
```bash
# Ver estado de los contenedores
docker compose ps

# Ver logs de la API en tiempo real
docker compose logs -f api
```
Deberás observar en la salida:
```text
Conexión a la base de datos establecida.
Modelos sincronizados con la base de datos.
🎮 API corriendo en http://localhost:3000
```

### 5.3 Acceso directo a PostgreSQL (Opcional)
Para auditar las tablas y datos creados por Sequelize dentro del contenedor:
```bash
docker compose exec db psql -U postgres -d videojuegos_db
```
Comandos en `psql`:
```sql
\dt                  -- Lista las tablas (aparecerá 'videojuegos')
SELECT * FROM videojuegos;
\q                   -- Salir de psql
```

### 5.4 Detener los servicios
```bash
# Detener contenedores conservando los datos persistidos en el volumen
docker compose down

# Detener contenedores Y eliminar el volumen de datos (reinicio total en limpio)
docker compose down -v
```

---

## 📮 6. Guía Paso a Paso para Probar la API con Postman

Abre **Postman** y crea una colección llamada **"API Videojuegos PostgreSQL"**.

URL Base: `http://localhost:3000`

---

### Prueba 1: Comprobar que la API está viva (Healthcheck / Raíz)
* **Método:** `GET`
* **URL:** `http://localhost:3000/`
* **Headers:** No requeridos
* **Respuesta esperada (`200 OK`):**
```json
{
  "mensaje": "🎮 API REST de Videojuegos con PostgreSQL y Sequelize",
  "recurso": "/juegos"
}
```

---

### Prueba 2: Consultar todos los videojuegos
* **Método:** `GET`
* **URL:** `http://localhost:3000/juegos`
* **Respuesta esperada (`200 OK`):**
  - Si la base de datos acaba de crearse: `[]`
  - Si ya hay registros: lista en formato JSON con todos los objetos de videojuegos.

---

### Prueba 3: Crear un nuevo videojuego (`POST`)
* **Método:** `POST`
* **URL:** `http://localhost:3000/juegos`
* **Headers:**
  - `Content-Type: application/json`
* **Body:** Seleccionar **raw** -> formato **JSON**:
```json
{
  "id": 1,
  "titulo": "The Legend of Zelda: Breath of the Wild",
  "genero": "Aventura / Acción",
  "plataforma": "Nintendo Switch",
  "año": 2017,
  "disponible": true
}
```
* **Respuesta esperada (`201 Created`):**
```json
{
  "id": 1,
  "titulo": "The Legend of Zelda: Breath of the Wild",
  "genero": "Aventura / Acción",
  "plataforma": "Nintendo Switch",
  "año": 2017,
  "disponible": true,
  "createdAt": "2026-10-08T02:02:54.199Z",
  "updatedAt": "2026-10-08T02:02:54.199Z"
}
```

---

### Prueba 4: Probar validaciones y control de duplicados
#### Caso 4A: Clave primaria duplicada (`409 Conflict`)
* Vuelve a presionar **Send** con el mismo body anterior (`"id": 1`).
* **Respuesta esperada (`409 Conflict`):**
```json
{
  "error": "Ya existe un videojuego con id 1"
}
```

#### Caso 4B: Falta el campo obligatorio `id` (`400 Bad Request`)
* **Body:**
```json
{
  "titulo": "Super Mario Odyssey",
  "genero": "Plataformas",
  "plataforma": "Nintendo Switch"
}
```
* **Respuesta esperada (`400 Bad Request`):**
```json
{
  "error": "id es obligatorio"
}
```

---

### Prueba 5: Crear un segundo videojuego
* **Método:** `POST`
* **URL:** `http://localhost:3000/juegos`
* **Body:**
```json
{
  "id": 2,
  "titulo": "Elden Ring",
  "genero": "Action RPG",
  "plataforma": "PC / PS5 / Xbox Series X",
  "año": 2022,
  "disponible": true
}
```
* **Respuesta esperada (`201 Created`)**.

---

### Prueba 6: Obtener un videojuego por ID (`GET /:id`)
#### Caso 6A: Registro existente
* **Método:** `GET`
* **URL:** `http://localhost:3000/juegos/1`
* **Respuesta esperada (`200 OK`):**
```json
{
  "id": 1,
  "titulo": "The Legend of Zelda: Breath of the Wild",
  "genero": "Aventura / Acción",
  "plataforma": "Nintendo Switch",
  "año": 2017,
  "disponible": true,
  "createdAt": "2026-10-08T02:02:54.199Z",
  "updatedAt": "2026-10-08T02:02:54.199Z"
}
```

#### Caso 6B: Registro inexistente
* **Método:** `GET`
* **URL:** `http://localhost:3000/juegos/999`
* **Respuesta esperada (`404 Not Found`):**
```json
{
  "error": "No se encontró el videojuego con id 999"
}
```

---

### Prueba 7: Actualizar un videojuego (`PUT /:id`)
* **Método:** `PUT`
* **URL:** `http://localhost:3000/juegos/1`
* **Headers:**
  - `Content-Type: application/json`
* **Body:**
```json
{
  "titulo": "The Legend of Zelda: Tears of the Kingdom",
  "genero": "Aventura / Acción",
  "plataforma": "Nintendo Switch",
  "año": 2023,
  "disponible": false
}
```
* **Respuesta esperada (`200 OK`):**
```json
{
  "id": 1,
  "titulo": "The Legend of Zelda: Tears of the Kingdom",
  "genero": "Aventura / Acción",
  "plataforma": "Nintendo Switch",
  "año": 2023,
  "disponible": false,
  "createdAt": "2026-10-08T02:02:54.199Z",
  "updatedAt": "2026-10-08T02:05:33.298Z"
}
```

---

### Prueba 8: Eliminar un videojuego (`DELETE /:id`)
* **Método:** `DELETE`
* **URL:** `http://localhost:3000/juegos/1`
* **Respuesta esperada (`200 OK`):**
```json
{
  "mensaje": "Videojuego eliminado exitosamente",
  "eliminado": {
    "id": 1,
    "titulo": "The Legend of Zelda: Tears of the Kingdom",
    "genero": "Aventura / Acción",
    "plataforma": "Nintendo Switch",
    "año": 2023,
    "disponible": false,
    "createdAt": "2026-10-08T02:02:54.199Z",
    "updatedAt": "2026-10-08T02:05:33.298Z"
  }
}
```

---

### Prueba 9: Verificación de Persistencia tras Reinicio de Contenedores
Esta prueba demuestra que la base de datos real en Docker persiste la información:

1. Crea o asegura la existencia de un juego (ej. `id: 2` de Elden Ring).
2. En la terminal, detén y destruye los contenedores:
   ```bash
   docker compose down
   ```
3. Vuelve a levantarlos:
   ```bash
   docker compose up -d
   ```
4. En Postman, ejecuta de nuevo:
   * **`GET http://localhost:3000/juegos`**
5. **Resultado:** El videojuego con `id: 2` sigue existiendo. Los datos no se perdieron porque están almacenados en el volumen administrado `postgres_data`.
