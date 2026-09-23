require("dotenv").config();
const express = require("express");
const clientesRoutes = require("./routes/clientes.routes");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json())
app.use("/clientes", clientesRoutes);

app.get("/", async (req, res) => {
    try {
        const resultado = await pool.query("SELECT NOW()");

        res.status(200).json({
            mensaje: "Conexion exitosa, cliente-api activa",
            fechaPostgres: resultado.rows[0]
        });
    }
    catch (error){
        console.error(error);
        res.status(500).json({
            error: "Error conectando con PostgreSQL"
        })
    }
});

app.listen(PORT, () => {
    console.log(`Cliente-api escuchando en el puerto ${PORT}`);
});