# Construcción
docker build -t nombre:tag .            # Construir imagen
docker build --no-cache -t nombre:tag . # Construir sin caché

# Ejecución
docker run -d -p host:contenedor --name nombre imagen  # Ejecutar en background
docker run -it imagen bash              # Ejecutar interactivo con terminal

# Gestión de contenedores
docker ps                  # Contenedores en ejecución
docker ps -a               # Todos los contenedores
docker stop nombre         # Detener
docker start nombre        # Iniciar detenido
docker rm nombre           # Eliminar (debe estar detenido)
docker rm -f nombre        # Eliminar forzando detención

# Gestión de imágenes
docker images              # Listar imágenes
docker rmi nombre:tag      # Eliminar imagen
docker pull imagen:tag     # Descargar imagen sin ejecutar

# Inspección y logs
docker logs nombre         # Ver logs
docker logs -f nombre      # Logs en tiempo real
docker exec -it nombre sh  # Abrir shell en contenedor activo
docker inspect nombre      # Información detallada en JSON

# Limpieza
docker system prune        # Eliminar todo lo no usado (pide confirmación)
docker system prune -a     # Incluye imágenes no referenciadas
