import React, { useEffect, useState } from "react";
import { 
  getCategories, 
  addExpense, 
  getBudgetStatus, 
  setBudget 
} from "../services/api";
import "../styles/AddExpense.css";
import Navbar from "../components/Navbar";
import BudgetCard from "../components/BudgetCard";

/**
 * Componente pagina per la creazione di una nuova spesa con gestione budget integrata.
 * * **Funzionalità:**
 * 1. **Gestione Form:** Raccoglie i dati della transazione.
 * 2. **Budget Monitor:** Visualizza e aggiorna il budget mensile contestualmente all'inserimento.
 * 3. **Autenticazione:** Utilizza cookie HttpOnly sicuri per l'identificazione utente (nessun ID passato manualmente).
 * 4. **Feedback UI:** Aggiorna immediatamente lo stato del budget dopo l'inserimento di una spesa.
 * * @component
 * @returns {JSX.Element} La pagina renderizzata con Navbar, BudgetCard e Form.
 */
const AddExpense = () => {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  
  const [categories, setCategories] = useState([]);
  const [budgetStatus, setBudgetStatus] = useState(null);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  /**
   * Effect Hook per l'inizializzazione.
   * Esegue il fetch parallelo delle categorie e dello stato del budget
   * per ottimizzare il tempo di caricamento della pagina.
   */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [catsData, budgetData] = await Promise.all([
          getCategories(),
          getBudgetStatus()
        ]);
        
        setCategories(catsData || []);
        setBudgetStatus(budgetData);
      } catch (error) {
        console.error("Errore nel recupero dati:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  /**
   * Callback per l'aggiornamento del budget utente.
   * Viene invocata dal componente figlio BudgetCard.
   * * @param {number|string} newLimit - Il nuovo limite impostato.
   */
  const handleSetBudget = async (newLimit) => {
    try {
      await setBudget(newLimit);
      const updated = await getBudgetStatus();
      setBudgetStatus(updated);
    } catch (error) {
      console.error("Errore update budget", error);
    }
  };

  /**
   * Gestisce l'invio del form.
   * Invia i dati al backend (che identifica l'utente via cookie) e,
   * in caso di successo, aggiorna immediatamente la visualizzazione del budget.
   * * @param {React.FormEvent} e - L'evento di submit.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: "", message: "" });

    try {
      // Chiamata API senza user_id (gestito da cookie/token backend)
      await addExpense({
        amount,
        date,
        description,
        category_id: parseInt(category, 10),
      });

      setStatus({ type: "success", message: "Spesa aggiunta con successo!" });

      setAmount("");
      setDate("");
      setDescription("");
      setCategory("");

      // Ricarica il budget per riflettere la nuova spesa nella UI
      const updatedBudget = await getBudgetStatus();
      setBudgetStatus(updatedBudget);

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
        <div className="content-stack">
          
          <div className="budget-section-wrapper">
             <BudgetCard 
                budgetStatus={budgetStatus} 
                onSetBudget={handleSetBudget} 
             />
          </div>

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
    </div>
  );
};

export default AddExpense;