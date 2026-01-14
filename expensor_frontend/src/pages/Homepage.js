import React, { useEffect, useState } from "react";
import { getExpensesByCategory, getRecentExpenses } from "../services/api";
import {
  PieChart,
  Pie,
  Tooltip,
  Legend,
  Cell,
  ResponsiveContainer,
} from "recharts";
import Navbar from "../components/Navbar";
import "../styles/Homepage.css";

const CATEGORY_COLORS = {
  "Alimentari": "#dc750f",
  "Salute": "#9966FF",
  "Trasporti": "#0a70b4",
  "Casa": "#4BC0C0",
  "Intrattenimento": "#FFCE56",
  "Altro": "#319e74"
};

const DEFAULT_COLOR = "#CCCCCC";

const Homepage = () => {
  const [chartData, setChartData] = useState([]);
  const [recentExpenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const categoriesData = await getExpensesByCategory();
        setChartData(categoriesData);

        const expenses = await getRecentExpenses();
        setExpenses(expenses);
      } catch (err) {
        console.error("Errore nel recupero dati:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="homepage-wrapper">
      <Navbar />

      <div className="homepage-content">
        <h1 className="homepage-title">📊 Dashboard Spese</h1>

        <div className="dashboard-grid">
          <div className="chart-container">
            <h2 className="chart-title">📌 Distribuzione delle spese</h2>

            {loading ? (
              <p>🔄 Caricamento dati...</p>
            ) : chartData.length > 0 ? (
              <div className="chart-wrapper-inner">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="total"
                      nameKey="category_name"
                      cx="50%"
                      cy="45%"
                      innerRadius="40%"
                      outerRadius="70%"
                      paddingAngle={2}
                      label
                      stroke="none"
                    >
                      {chartData.map((entry, index) => {
                        const color = CATEGORY_COLORS[entry.category_name] || DEFAULT_COLOR;
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={color}
                          />
                        );
                      })}
                    </Pie>
                    <Tooltip />

                    <Legend
                      verticalAlign="bottom"
                      height={60}
                      iconSize={18}
                      wrapperStyle={{
                        fontSize: "16px",
                        fontWeight: "600",
                        paddingTop: "20px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="empty-message">⚠️ Nessuna spesa registrata.</p>
            )}
          </div>

          <div className="recent-expenses">
            <h3>🧾 Ultime Spese</h3>
            {recentExpenses.length > 0 ? (
              <ul>
                {recentExpenses.map((exp, index) => (
                  <li key={index}>
                    <strong>
                      {exp.description || "Senza descrizione"} (
                      {exp.category_name})
                    </strong>{" "}
                    <br />
                    {new Date(exp.date).toLocaleDateString("it-IT")} <br />
                    <span style={{ color: "#e74c3c", fontWeight: "bold" }}>
                      - € {parseFloat(exp.amount).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-message">⚠️ Nessuna spesa registrata</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Homepage;