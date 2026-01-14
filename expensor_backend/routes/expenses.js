const express = require("express");
const { connectDB, sql } = require("../db");

const router = express.Router();

// Inserire una spesa
router.post("/add", async (req, res) => {
    const { description, amount } = req.body;
    
    if (!description || !amount) {
        return res.status(400).json({ success: false, message: "Tutti i campi sono obbligatori" });
    }

    try {
        const pool = await connectDB();
        await pool.request()
            .input("description", sql.NVarChar, description)
            .input("amount", sql.Decimal(10,2), amount)
            .query("INSERT INTO expenses (description, amount) VALUES (@description, @amount)");

        res.json({ success: true, message: "Spesa aggiunta con successo!" });
    } catch (err) {
        console.error("❌ Errore nell'inserimento:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Recuperare tutte le spese
router.get("/all", async (req, res) => {
    try {
        const pool = await connectDB();
        const result = await pool.request().query("SELECT * FROM expenses ORDER BY created_at DESC");
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error("❌ Errore nel recupero delle spese:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
