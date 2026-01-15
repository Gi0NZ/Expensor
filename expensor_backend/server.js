// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// const morgan = require("morgan");
// const { connectDB, sql } = require("./db");
// const usersRouter = require("./routes/users");
// const expensesRouter = require("./routes/expenses");
// const categoriesRouter = require("./routes/categories");



// const app = express();
// const PORT = process.env.PORT || 5000;


// app.use(cors());
// app.use(express.json());
// app.use(morgan("dev"));
// app.use("/categories", categoriesRouter);



// app.get("/", (req, res) => {
//     res.send("Expensor API is running!");
// });

// // Test connessione database
// /*app.get("/test-db", async (req, res) => {
//     try {
//         const pool = await connectDB();
//         const result = await pool.request().query("SELECT * FROM expenses");
//         res.json({ success: true, data: result.recordset });
//     } catch (err) {
//         console.error("❌ Errore nella query:", err);
//         res.status(500).json({ success: false, error: err.message });
//     }
// });*/



// app.use("/users", usersRouter); // Registra la route
// app.use("/expenses", expensesRouter);

// app.get("/test-db", async (req, res) => {
//     try {
//         const pool = await connectDB();
//         const result = await pool.request().query("SELECT * FROM expenses");
//         res.json({ success: true, data: result.recordset });
//     } catch (err) {
//         console.error("❌ Errore nella query:", err);
//         res.status(500).json({ success: false, error: err.message });
//     }
// });

// app.listen(PORT, () => {
//     console.log(`🚀 Server in esecuzione sulla porta ${PORT}`);
// });

