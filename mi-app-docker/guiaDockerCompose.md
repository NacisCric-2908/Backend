docker compose up -d             # Levantar todos los servicios
docker compose up -d --build     # Levantar reconstruyendo imágenes
docker compose down              # Bajar y eliminar contenedores y red
docker compose ps                # Ver estado de los servicios
docker compose logs -f           # Logs en tiempo real de todos
docker compose logs -f servicio  # Logs de un servicio específico
docker compose exec web sh       # Shell en el servicio 'web'
docker compose restart web       # Reiniciar un servicio
docker compose stop              # Detener sin eliminar
docker compose start             # Iniciar servicios detenidos
