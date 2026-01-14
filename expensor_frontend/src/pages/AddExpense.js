import React, { useEffect, useState } from "react";
import { getCategories, addExpense } from "../services/api";
import "../styles/AddExpense.css";
import { msalInstance } from "../authConfig";
import Navbar from "../components/Navbar";

const AddExpense = () => {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      try {
        const data = await getCategories();
        setCategories(data || []);
      } catch (error) {
        console.error("Errore nel recupero delle categorie:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: "", message: "" });

    try {
      const account = msalInstance.getActiveAccount();
      const microsoft_id = account?.localAccountId;

      await addExpense({
        amount,
        date,
        description,
        category_id: parseInt(category, 10),
        user_id: microsoft_id,
      });

      setStatus({ type: "success", message: "Spesa aggiunta con successo!" });

      setAmount("");
      setDate("");
      setDescription("");
      setCategory("");

      setTimeout(() => setStatus({ type: "", message: "" }), 3000);
    } catch (err) {
      console.error("Errore nell'aggiunta della spesa:", err);
      setStatus({ type: "error", message: "Errore: " + err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-wrapper">
      <Navbar />

      <div className="page-content">
        <div className="add-expense-card">
          <div className="add-expense-card-header">
            <h2>Nuova Spesa</h2>
            <p>Inserisci i dettagli della tua transazione</p>
          </div>

          {status.message && (
            <div className={`status-message ${status.type}`}>
              {status.message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="expense-form">
            <div className="form-group">
              <label htmlFor="amount">Importo (€)</label>
              <input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group half">
                <label htmlFor="date">Data</label>
                <input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>

              <div className="form-group half">
                <label htmlFor="category">Categoria</label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  disabled={loading}
                >
                  <option value="">Seleziona...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description">Descrizione (Opzionale)</label>
              <input
                id="description"
                type="text"
                placeholder="Es. Cena con amici..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Salvataggio..." : "Aggiungi Spesa"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddExpense;
