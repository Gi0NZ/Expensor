const express = require("express");
const { connectDB, sql } = require("../db");

const router = express.Router();

// Endpoint per ottenere tutte le categorie
router.get("/all", async (req, res) => {
    try {
        const pool = await connectDB();
        const result = await pool.request().query("SELECT * FROM categories ORDER BY id ASC");
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error("❌ Errore nel recupero delle categorie:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
