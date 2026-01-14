const express = require("express");
const { connectDB } = require("../db");

const router = express.Router();

// Endpoint per ottenere tutti gli utenti dal database
router.get("/", async (req, res) => {
    try {
        const pool = await connectDB();
        const result = await pool.request().query("SELECT id, name, email FROM users");
        res.json({ success: true, users: result.recordset });
    } catch (error) {
        console.error("Errore nel recupero degli utenti:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
