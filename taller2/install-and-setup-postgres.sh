#!/usr/bin/env bash
set -e

echo "=========================================================="
echo " 1. Instalando PostgreSQL y utilidades en Linux Mint"
echo "=========================================================="
sudo apt update
sudo apt install -y postgresql postgresql-contrib

echo "=========================================================="
echo " 2. Iniciando y habilitando servicio PostgreSQL"
echo "=========================================================="
sudo systemctl start postgresql
sudo systemctl enable postgresql

echo "=========================================================="
echo " 3. Configurando contraseña del usuario postgres a 'postgres'"
echo "=========================================================="
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"

echo "=========================================================="
echo " 4. Inicializando base de datos taller2_db y tablas"
echo "=========================================================="
cd "$(dirname "$0")"
node setup-db.js

echo "=========================================================="
echo " ¡Instalación y configuración completadas con éxito!"
echo "=========================================================="
