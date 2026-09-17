# Documentación y Explicación del Repositorio

Este repositorio contiene una **API REST básica en Node.js y Express** para la gestión de un catálogo de libros (`catalogo-libros-api`). A continuación se detallan la arquitectura, el propósito y el funcionamiento de cada archivo del proyecto.

---

## 📁 Estructura General del Proyecto

```text
Backend/
├── .gitignore
├── README.md
├── EXPLICACION_PROYECTO.md       # Este documento explicativo
└── catalogo-libros-api/
    ├── package.json
    ├── package-lock.json
    ├── .env / .env.example
    └── src/
        ├── server.js               # Punto de entrada y configuración del servidor
        ├── routes/
        │   └── libros.routes.js    # Definición de rutas y lógica CRUD
        └── data/
            └── libros.js           # Simulación de base de datos en memoria
```

---

## 1. Configuración y Dependencias

### 📄 `catalogo-libros-api/package.json`
Es el **manifiesto principal** de la aplicación en Node.js. Declara metadatos, comandos rápidos y las librerías necesarias.

```json
{
  "name": "catalogo-libros-api",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "dependencies": {
    "dotenv": "^17.4.2",
    "express": "^5.2.1"
  },
  "devDependencies": {
    "nodemon": "^3.1.14"
  }
}
```

* **`"type": "commonjs"`**: Indica que el proyecto usa el sistema clásico de módulos de Node.js (`require` y `module.exports`).
* **`"scripts"`**:
  * `npm start`: Inicia el servidor de manera estándar con Node (`node src/server.js`).
  * `npm run dev`: Inicia el servidor usando `nodemon`, permitiendo recarga automática al detectar cambios en el código.
* **`"dependencies"`** (Producción):
  * `express` (`^5.2.1`): Framework web HTTP para gestionar peticiones, respuestas y middlewares.
  * `dotenv` (`^17.4.2`): Lee variables de entorno desde un archivo `.env` y las inyecta en `process.env`.
  * *Nota sobre el prefijo `^`:* Permite que `npm` instale actualizaciones menores o parches compatibles automáticamente.
* **`"devDependencies"`** (Solo desarrollo):
  * `nodemon` (`^3.1.14`): Monitor de archivos para reiniciar el servidor automáticamente durante el desarrollo.

---

### 📄 `catalogo-libros-api/package-lock.json`
Es el **árbol de dependencias exacto y congelado**. Se genera de forma automática por `npm` y no se debe modificar a mano.

* **Propósito:** Garantizar que cualquier máquina o entorno de despliegue instale exactamente las mismas versiones de las librerías y de sus dependencias transitivas (las librerías que Express o Nodemon usan por debajo).
* **Integridad y Seguridad:** Incluye hashes criptográficos (`integrity: sha512-...`) para verificar que el código descargado del registro de `npm` no haya sido alterado.

---

## 2. Punto de Entrada del Servidor

### 📄 `catalogo-libros-api/src/server.js`
Es el archivo inicial que arranca la aplicación, monta los middlewares y escucha peticiones HTTP.

```javascript
require("dotenv").config();
const express = require("express");
const librosRoutes = require("./routes/libros.routes");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para interpretar cuerpos de petición en formato JSON.
app.use(express.json());

// Se conecta el conjunto de rutas de libros bajo el prefijo /libros.
app.use("/libros", librosRoutes);

// Ruta raíz de verificación (health check).
app.get("/", (req, res) => {
  res.status(200).json({ mensaje: "API de catálogo de libros activa" });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
```

* **`require("dotenv").config()`**: Carga las variables definidas en `.env`.
* **`app.use(express.json())`**: Middleware indispensable para procesar cuerpos de solicitud con formato JSON (`req.body`).
* **`app.use("/libros", librosRoutes)`**: Agrupa y conecta todas las rutas del catálogo bajo el prefijo `/libros`.
* **`GET /` (Health check)**: Ruta de verificación que responde con `{ "mensaje": "API de catálogo de libros activa" }`.
* **`app.listen(PORT, ...)`**: Pone en marcha el servidor en el puerto indicado por `.env` o en el puerto `3000` por defecto.

---

## 3. Capa de Rutas y Lógica de Negocio

### 📄 `catalogo-libros-api/src/routes/libros.routes.js`
Define un router modular de Express que expone un CRUD completo para gestionar los libros.

#### Endpoints implementados:

1. **`GET /libros` (Listar con filtros vía Query Params)**:
   * Permite filtrar opcionalmente por `autor` (búsqueda parcial insensible a mayúsculas), `genero` (coincidencia de texto) y `disponible` (`true`/`false`).
   * Ejemplo: `GET /libros?autor=Orwell&disponible=false`
   * Respuesta: Código `200 OK` con la lista filtrada.

2. **`GET /libros/:id` (Obtener por ID vía Path Params)**:
   * Convierte `req.params.id` a número y busca el libro correspondiente con `.find()`.
   * Si no existe, responde con `404 Not Found`.
   * Si existe, responde con `200 OK` y los datos del libro.

3. **`POST /libros` (Crear nuevo libro)**:
   * Recibe los datos por `req.body`.
   * Valida que `titulo` y `autor` existan obligatoriamente (si faltan, retorna `400 Bad Request`).
   * Asigna un identificador autoincremental (`siguienteId++`) y valores por defecto (`genero: "sin clasificar"`, `disponible: true`).
   * Agrega el libro al arreglo y responde con código `201 Created`.

4. **`PUT /libros/:id` (Actualizar libro)**:
   * Localiza el libro por ID (retorna `404 Not Found` si no existe).
   * Modifica selectivamente las propiedades que vengan presentes en el cuerpo de la petición (`titulo`, `autor`, `genero`, `disponible`).
   * Responde con `200 OK` y el libro actualizado.

5. **`DELETE /libros/:id` (Eliminar libro)**:
   * Busca el índice del libro mediante `.findIndex()`.
   * Si no se encuentra, responde con `404 Not Found`.
   * Si se encuentra, lo remueve con `.splice(indice, 1)` y responde con `204 No Content` (éxito sin contenido en la respuesta).

---

## 4. Capa de Datos (Simulación en Memoria)

### 📄 `catalogo-libros-api/src/data/libros.js`
Contiene la colección de datos inicial de la aplicación.

```javascript
let libros = [
  {
    id: 1,
    titulo: "Cien años de soledad",
    autor: "Gabriel García Márquez",
    genero: "novela",
    disponible: true
  },
  {
    id: 2,
    titulo: "El principito",
    autor: "Antoine de Saint-Exupéry",
    genero: "fábula",
    disponible: true
  },
  {
    id: 3,
    titulo: "1984",
    autor: "George Orwell",
    genero: "distopía",
    disponible: false
  }
];

module.exports = libros;
```

* **Modelo de datos:** Cada libro cuenta con `id` (numérico), `titulo` (string), `autor` (string), `genero` (string) y `disponible` (booleano).
* **Persistencia en memoria (RAM):**
  * Las modificaciones se reflejan en tiempo real mientras el servidor esté activo.
  * **Limitación importante:** Cada vez que el servidor se detiene o se reinicia (por ejemplo, al guardar código usando `nodemon`), el estado vuelve a sus 3 libros originales.
