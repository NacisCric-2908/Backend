# Guía de Peticiones con cURL - API Catálogo de Libros

Esta guía contiene todos los comandos `curl` disponibles para interactuar con la API REST de catálogo de libros.

---

## 🚀 Requisitos Previos: Iniciar el Servidor

Antes de ejecutar las peticiones, asegúrate de tener el servidor en ejecución:

```bash
cd catalogo-libros-api
npm run dev
# O alternativamente:
# npm start
```

* **URL base por defecto:** `http://localhost:3000`
* **Formato de datos:** JSON (`application/json`)

> [!TIP]
> **Flags útiles de cURL:**
> * `-i`: Muestra las cabeceras HTTP de la respuesta (código de estado, Content-Type, etc.). Esencial para verificar respuestas como `204 No Content` o códigos de error `404` / `400`.
> * `-X <MÉTODO>`: Especifica el método HTTP (`GET`, `POST`, `PUT`, `DELETE`).
> * `-H "Header: Valor"`: Envía encabezados HTTP (por ejemplo, `-H "Content-Type: application/json"`).
> * `-d 'datos'`: Envía el cuerpo de la petición (payload en formato JSON).
> * `| jq .`: Si tienes instalado el comando `jq`, puedes añadirlo al final de cualquier petición para ver el JSON formateado con colores.
> * **Comillas en URLs:** En URLs con parámetros (`?`, `&`), encierra siempre la URL entre comillas dobles (`"..."`) para evitar que la terminal interprete el `&` como ejecución en segundo plano.

---

## 📋 Resumen de Endpoints

| Método | Endpoint | Descripción | Código Éxito |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Comprobación de estado (Health check) | `200 OK` |
| `GET` | `/libros` | Listar libros (con filtros opcionales) | `200 OK` |
| `GET` | `/libros/:id` | Obtener un libro por ID | `200 OK` |
| `POST` | `/libros` | Registrar un nuevo libro | `201 Created` |
| `PUT` | `/libros/:id` | Actualizar los datos de un libro | `200 OK` |
| `DELETE` | `/libros/:id` | Eliminar un libro del catálogo | `204 No Content` |

---

## 1. Verificación de Estado (Health Check)

Verifica que el servidor esté encendido y respondiendo peticiones.

### Petición
```bash
curl http://localhost:3000/
```

### Con cabeceras HTTP (`-i`)
```bash
curl -i http://localhost:3000/
```

### Respuesta esperada (`200 OK`)
```json
{
  "mensaje": "API de catálogo de libros activa"
}
```

---

## 2. Listar Libros (`GET /libros`)

### 2.1. Obtener todos los libros
```bash
curl http://localhost:3000/libros
```

### 2.2. Filtrar por autor (búsqueda parcial insensible a mayúsculas)
Filtra los libros cuyo autor contenga la palabra especificada:
```bash
curl "http://localhost:3000/libros?autor=Orwell"
```

O buscando parte del nombre:
```bash
curl "http://localhost:3000/libros?autor=García"
```

### 2.3. Filtrar por género
Filtra por coincidencia exacta de género:
```bash
curl "http://localhost:3000/libros?genero=novela"
```

```bash
curl "http://localhost:3000/libros?genero=distopía"
```

### 2.4. Filtrar por disponibilidad
Solo libros disponibles (`true`):
```bash
curl "http://localhost:3000/libros?disponible=true"
```

Solo libros no disponibles (`false`):
```bash
curl "http://localhost:3000/libros?disponible=false"
```

### 2.5. Combinar múltiples filtros
Puedes combinar los parámetros usando el operador `&`:
```bash
curl "http://localhost:3000/libros?genero=novela&disponible=true"
```

### Respuesta esperada (`200 OK`)
```json
[
  {
    "id": 1,
    "titulo": "Cien años de soledad",
    "autor": "Gabriel García Márquez",
    "genero": "novela",
    "disponible": true
  }
]
```

---

## 3. Obtener un Libro por ID (`GET /libros/:id`)

### 3.1. Caso exitoso (Libro existente)
Obtiene el libro con ID `1`:
```bash
curl http://localhost:3000/libros/1
```

#### Respuesta esperada (`200 OK`)
```json
{
  "id": 1,
  "titulo": "Cien años de soledad",
  "autor": "Gabriel García Márquez",
  "genero": "novela",
  "disponible": true
}
```

### 3.2. Caso de error (Libro no encontrado)
Solicitar un identificador inexistente:
```bash
curl -i http://localhost:3000/libros/99
```

#### Respuesta esperada (`404 Not Found`)
```json
{
  "mensaje": "Libro no encontrado"
}
```

---

## 4. Crear un Nuevo Libro (`POST /libros`)

Para crear un libro se deben enviar los datos en formato JSON mediante el flag `-d` y especificar la cabecera `-H "Content-Type: application/json"`.

* **Campos obligatorios:** `titulo`, `autor`.
* **Campos opcionales:** `genero` (por defecto: `"sin clasificar"`), `disponible` (por defecto: `true`).

### 4.1. Creación completa con todos los campos
```bash
curl -i -X POST http://localhost:3000/libros \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Fahrenheit 451",
    "autor": "Ray Bradbury",
    "genero": "ciencia ficción",
    "disponible": true
  }'
```

#### Respuesta esperada (`201 Created`)
```json
{
  "id": 4,
  "titulo": "Fahrenheit 451",
  "autor": "Ray Bradbury",
  "genero": "ciencia ficción",
  "disponible": true
}
```

### 4.2. Creación con campos mínimos (valores por defecto)
```bash
curl -i -X POST http://localhost:3000/libros \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Don Quijote de la Mancha",
    "autor": "Miguel de Cervantes"
  }'
```

#### Respuesta esperada (`201 Created`)
```json
{
  "id": 5,
  "titulo": "Don Quijote de la Mancha",
  "autor": "Miguel de Cervantes",
  "genero": "sin clasificar",
  "disponible": true
}
```

### 4.3. Caso de error: campos obligatorios faltantes
Si omites `titulo` o `autor`:
```bash
curl -i -X POST http://localhost:3000/libros \
  -H "Content-Type: application/json" \
  -d '{
    "genero": "poesía"
  }'
```

#### Respuesta esperada (`400 Bad Request`)
```json
{
  "mensaje": "Los campos 'titulo' y 'autor' son obligatorios"
}
```

---

## 5. Actualizar un Libro (`PUT /libros/:id`)

El método `PUT` actualiza las propiedades que envíes en el cuerpo de la petición.

### 5.1. Actualizar disponibilidad
Cambiar el estado de disponibilidad del libro con ID `1` a `false`:
```bash
curl -i -X PUT http://localhost:3000/libros/1 \
  -H "Content-Type: application/json" \
  -d '{
    "disponible": false
  }'
```

### 5.2. Actualizar múltiples propiedades
```bash
curl -i -X PUT http://localhost:3000/libros/2 \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "El Principito (Edición de Lujo)",
    "genero": "fábula infantil",
    "disponible": false
  }'
```

#### Respuesta esperada (`200 OK`)
```json
{
  "id": 2,
  "titulo": "El Principito (Edición de Lujo)",
  "autor": "Antoine de Saint-Exupéry",
  "genero": "fábula infantil",
  "disponible": false
}
```

### 5.3. Caso de error: actualizar libro inexistente
```bash
curl -i -X PUT http://localhost:3000/libros/99 \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "No existe"
  }'
```

#### Respuesta esperada (`404 Not Found`)
```json
{
  "mensaje": "Libro no encontrado"
}
```

---

## 6. Eliminar un Libro (`DELETE /libros/:id`)

### 6.1. Caso exitoso (Libro eliminado)
Elimina el libro con ID `3`:
```bash
curl -i -X DELETE http://localhost:3000/libros/3
```

#### Respuesta esperada (`204 No Content`)
> La respuesta tiene cabecera `HTTP/1.1 204 No Content` y el cuerpo está vacío. El flag `-i` permite verificar el código `204`.

### 6.2. Caso de error: eliminar libro inexistente
```bash
curl -i -X DELETE http://localhost:3000/libros/99
```

#### Respuesta esperada (`404 Not Found`)
```json
{
  "mensaje": "Libro no encontrado"
}
```

---

## 💡 Guía Rápida para Probar Todo el Flujo en una Sola Sesión

Puedes ejecutar estos comandos en tu terminal en secuencia para verificar todo el ciclo CRUD:

```bash
# 1. Comprobar salud
curl -s http://localhost:3000/

# 2. Ver lista inicial
curl -s http://localhost:3000/libros

# 3. Crear nuevo libro
curl -s -X POST http://localhost:3000/libros \
  -H "Content-Type: application/json" \
  -d '{"titulo": "Un mundo feliz", "autor": "Aldous Huxley", "genero": "distopía"}'

# 4. Obtener el libro recién creado (id 4)
curl -s http://localhost:3000/libros/4

# 5. Modificar el libro
curl -s -X PUT http://localhost:3000/libros/4 \
  -H "Content-Type: application/json" \
  -d '{"disponible": false}'

# 6. Eliminar el libro
curl -i -s -X DELETE http://localhost:3000/libros/4

# 7. Confirmar eliminación (debe devolver 404)
curl -i -s http://localhost:3000/libros/4
```
