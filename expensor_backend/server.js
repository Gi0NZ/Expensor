require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { connectDB, sql } = require("./db");
const usersRouter = require("./routes/users");
const expensesRouter = require("./routes/expenses");
const categoriesRouter = require("./routes/categories");



const app = express();
const PORT = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use("/categories", categoriesRouter);


// Test API
app.get("/", (req, res) => {
    res.send("Expensor API is running!");
});

// Test connessione database
/*app.get("/test-db", async (req, res) => {
    try {
        const pool = await connectDB();
        const result = await pool.request().query("SELECT * FROM expenses");
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error("❌ Errore nella query:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});*/


// Avvio del server

app.use("/users", usersRouter); // Registra la route
app.use("/expenses", expensesRouter);


/*// Endpoint per inserire una spesa predefinita
app.post("/add-expense", async (req, res) => {
    try {
        const pool = await connectDB();
        await pool.request()
            .input("user_id", sql.Int, 1)
            .input("description", sql.NVarChar, "Serata fuori")
            .input("amount", sql.Decimal, 10.00)
            .input("category", sql.NVarChar, "Svago")                         
            .query("INSERT INTO expenses (user_id, description, amount, category, created_at) VALUES (@user_id, @description, @amount, @category, GETDATE())");

        res.json({ success: true, message: "✅ Spesa aggiunta con successo!" });
    } catch (err) {
        console.error("❌ Errore nell'inserimento della spesa:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});*/

// Endpoint per ottenere tutte le spese
app.get("/test-db", async (req, res) => {
    try {
        const pool = await connectDB();
        const result = await pool.request().query("SELECT * FROM expenses");
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error("❌ Errore nella query:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server in esecuzione sulla porta ${PORT}`);
});

