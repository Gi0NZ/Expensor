import React, { useEffect, useState } from "react";
import { getAllExpenses, removeExpense } from "../services/api";
import Navbar from "../components/Navbar";
import "../styles/ShowExpenses.css";
import { showConfirm, showError } from "../components/alerts";

const ShowExpenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");

  const handleDelete = async (id) => {
    if (await showConfirm("Sei sicuro di voler eliminare questo elemento?")) {
      try {
        await removeExpense(id);
        setExpenses((prev) => prev.filter((exp) => exp.id !== id));
      } catch (error) {
        showError("Errore durante l'eliminazione della spesa!");
        console.error(error);
      }
    }
  };

  const sortExpenses = (expensesList, criterion, order = "desc") => {
    const safe = Array.isArray(expensesList) ? expensesList : [];
    const sorted = [...safe];

    switch (criterion) {
      case "amount":
        sorted.sort((a, b) => a.amount - b.amount);
        break;
      case "category":
        sorted.sort((a, b) =>
          (a.category_name || "").localeCompare(b.category_name || "")
        );
        break;
      case "date":
      default:
        sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
        break;
    }

    return order === "desc" ? sorted.reverse() : sorted;
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const allExpenses = await getAllExpenses();
        const sorted = sortExpenses(allExpenses, sortBy, sortOrder);
        setExpenses(sorted);
      } catch (error) {
        console.error("Errore nel recupero spese:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    setExpenses((prev) => sortExpenses(prev, sortBy, sortOrder));
  }, [sortBy, sortOrder]);

  return (
    <div className="show-expenses__wrapper">
      <Navbar />

      <div className="show-expenses__content">
        <div className="show-expenses__card">
          <div className="show-expenses__header">
            <h2>🧾 Elenco Spese</h2>

            <div className="show-expenses__sort-controls">
              <span className="show-expenses__sort-label">Ordina per:</span>

              <div className="show-expenses__select-wrapper">
                <select
                  id="sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="show-expenses__sort-select"
                >
                  <option value="date">📅 Data</option>
                  <option value="amount">💰 Importo</option>
                  <option value="category">📝 Categoria</option>
                </select>
              </div>

              <button
                onClick={() =>
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                }
                className="show-expenses__sort-toggle-btn"
                title={sortOrder === "asc" ? "Crescente" : "Decrescente"}
              >
                {sortOrder === "asc" ? "⬆️" : "⬇️"}
              </button>
            </div>
          </div>

          <div className="show-expenses__list-container">
            {loading ? (
              <div className="show-expenses__loading">
                <div className="show-expenses__spinner"></div>
                <p>Caricamento spese...</p>
              </div>
            ) : Array.isArray(expenses) && expenses.length > 0 ? (
              <ul className="show-expenses__list">
                {expenses.map((exp) => (
                  <li key={exp.id} className="show-expenses__row">
                    <div className="show-expenses__info">
                      <div className="show-expenses__date">
                        {new Date(exp.date).toLocaleDateString("it-IT", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>

                      <div className="show-expenses__details">
                        <span className="show-expenses__desc">
                          {exp.description || "Nessuna descrizione"}
                        </span>
                        <span className="show-expenses__category">
                          {exp.category_name || "Generale"}
                        </span>
                      </div>
                    </div>

                    <div className="show-expenses__actions">
                      <span className="show-expenses__amount">
                        € {parseFloat(exp.amount).toFixed(2)}
                      </span>

                      <button
                        className="show-expenses__delete-btn"
                        onClick={() => handleDelete(exp.id)}
                        title="Elimina spesa"
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="show-expenses__empty">
                <p>⚠️ Nessuna spesa registrata</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShowExpenses;
