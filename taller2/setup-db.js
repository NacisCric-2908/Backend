const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = process.env.DB_PORT || 5432;
const DB_USER = process.env.DB_USER || "postgres";
const DB_PASSWORD = process.env.DB_PASSWORD || "postgres";
const DB_NAME = process.env.DB_NAME || "taller2_db";

async function setup() {
    console.log(`Conectando al servidor PostgreSQL en ${DB_HOST}:${DB_PORT} como usuario '${DB_USER}'...`);

    // 1. Conectar a la base de datos por defecto 'postgres' para verificar/crear la BD de la app
    const rootClient = new Client({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: "postgres"
    });

    try {
        await rootClient.connect();
        const checkDb = await rootClient.query(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            [DB_NAME]
        );

        if (checkDb.rows.length === 0) {
            console.log(`Creando base de datos '${DB_NAME}'...`);
            await rootClient.query(`CREATE DATABASE "${DB_NAME}"`);
            console.log(`Base de datos '${DB_NAME}' creada con éxito.`);
        } else {
            console.log(`La base de datos '${DB_NAME}' ya existe.`);
        }
    } catch (error) {
        console.error("Error al conectar con PostgreSQL o crear la base de datos:", error.message);
        process.exit(1);
    } finally {
        await rootClient.end();
    }

    // 2. Conectar a la base de datos de la app para ejecutar el script init.sql
    const appClient = new Client({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME
    });

    try {
        await appClient.connect();
        console.log(`Conectado a '${DB_NAME}'. Ejecutando init.sql...`);

        const sql = fs.readFileSync(path.join(__dirname, "init.sql"), "utf-8");
        await appClient.query(sql);

        const clientes = await appClient.query("SELECT COUNT(*) FROM cliente");
        const productos = await appClient.query("SELECT COUNT(*) FROM producto");
        const compras = await appClient.query("SELECT COUNT(*) FROM compra");

        console.log("\n=================================");
        console.log(" Base de datos configurada con éxito");
        console.log("=================================");
        console.log(`- Clientes registrados:  ${clientes.rows[0].count}`);
        console.log(`- Productos registrados: ${productos.rows[0].count}`);
        console.log(`- Compras registradas:   ${compras.rows[0].count}`);
        console.log("=================================\n");
    } catch (error) {
        console.error("Error ejecutando el script init.sql:", error.message);
        process.exit(1);
    } finally {
        await appClient.end();
    }
}

setup();
