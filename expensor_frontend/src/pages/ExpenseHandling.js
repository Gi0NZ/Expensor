import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import {
  getExpenseDetails,
  getExpenseSplits,
  getGroupMembers,
  addExpenseSplit,
  getGroupAdmin,
  removeExpenseSplit,
} from "../services/api";
import "../styles/ExpenseHandling.css";
import { showError, showSuccess, showConfirm } from "../components/alerts";

const ExpenseHandling = () => {
  const params = useParams();
  const { expenseId, groupId } = params;

  const [expense, setExpense] = useState(null);
  const [splits, setSplits] = useState([]);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupAdminId, setGroupAdminId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [splitAmount, setSplitAmount] = useState("");

  useEffect(() => {
    const storedProfile = localStorage.getItem("userProfile");
    if (storedProfile) {
      const profile = JSON.parse(storedProfile);
      setCurrentUserId(profile.microsoft_id);
    }
  }, []);

  const isUserAdmin = currentUserId === groupAdminId;

  useEffect(() => {
    if (!expenseId || !groupId) return;

    const loadData = async () => {
      try {
        setLoading(true);

        const [expData, membersData, splitsData, adminData] = await Promise.all(
          [
            getExpenseDetails({ expenseId, groupId }),
            getGroupMembers(groupId),
            getExpenseSplits({ expenseId, groupId }),
            getGroupAdmin(groupId),
          ]
        );

        setExpense(Array.isArray(expData) ? expData[0] : expData);
        setAvailableMembers(membersData);
        setSplits(splitsData);

        const adminId = Array.isArray(adminData)
          ? adminData[0].admin
          : adminData.admin;
        setGroupAdminId(adminId);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [expenseId, groupId]);

  const totalCovered = splits.reduce(
    (acc, curr) => acc + parseFloat(curr.amount),
    0
  );
  const totalAmount = expense ? parseFloat(expense.amount) : 0;
  const remaining = totalAmount - totalCovered;

  const percentage =
    totalAmount > 0 ? Math.min((totalCovered / totalAmount) * 100, 100) : 0;
  const progressColor = remaining < -0.01 ? "#e74c3c" : "#27ae60";

  const handleAddSplit = async (e) => {
    e.preventDefault();

    if (!isUserAdmin) {
      showError("Solo l'admin può modificare le quote.");
      return;
    }

    const amountToAdd = parseFloat(splitAmount);

    if (
      amountToAdd > 0 &&
      amountToAdd > parseFloat(remaining.toFixed(2)) + 0.01
    ) {
      showError("La quota inserita supera il rimanente!");
      return;
    }

    const existingSplit = splits.find((s) => s.user_id === selectedMemberId);
    const currentQuota = existingSplit ? parseFloat(existingSplit.amount) : 0;

    if (currentQuota + amountToAdd < 0) {
      showError(
        `Impossibile rimuovere ${Math.abs(
          amountToAdd
        )}€. L'utente ha solo ${currentQuota.toFixed(2)}€ assegnati.`
      );
      return;
    }

    try {
      await addExpenseSplit({
        expense_id: expenseId,
        user_id: selectedMemberId,
        amount: amountToAdd,
      });

      showSuccess("Quota aggiornata con successo!");

      setSplitAmount("");
      setSelectedMemberId("");

      const updatedSplits = await getExpenseSplits({ expenseId, groupId });
      setSplits(updatedSplits);
    } catch (err) {
      console.error(err);
      showError(err.message || "Errore durante l'assegnazione della quota");
    }
  };

  const handleDeleteSplit = async (e, userId) => {
    e.preventDefault();

    const isConfirmed = await showConfirm(
      "Rimuovere quota?",
      "Sei sicuro di voler rimuovere questa quota di spesa?"
    );

    if (!isConfirmed) return;

    try {
      await removeExpenseSplit({ expenseId, userId });
      showSuccess("Quota rimossa con successo");

      const updatedSplits = await getExpenseSplits({ expenseId, groupId });
      setSplits(updatedSplits);
    } catch (err) {
      console.error(err);
      showError("Errore durante l'eliminazione della quota");
    }
  };

  if (loading)
    return (
      <div className="expense-handling-wrapper">
        <Navbar />
        <div className="expense-handling-content">
          <p style={{ textAlign: "center", marginTop: "50px" }}>
            Caricamento dettagli spesa...
          </p>
        </div>
      </div>
    );

  if (!expense)
    return (
      <div className="expense-handling-wrapper">
        <Navbar />
        <div className="expense-handling-content">
          <p style={{ textAlign: "center", marginTop: "50px", color: "red" }}>
            Spesa non trovata o errore nel caricamento.
          </p>
        </div>
      </div>
    );

  return (
    <div className="expense-handling-wrapper">
      <Navbar />

      <div className="expense-handling-content">
        <div className="expense-handling-header">
          <h1 className="expense-handling-title">{expense.description}</h1>
          <h2 className="expense-handling-subtitle">
            Totale: {totalAmount.toFixed(2)} €
          </h2>
          <p className="expense-handling-info">
            Pagata da:{" "}
            <strong>
              {expense.paid_by_name || expense.paid_by || "..."}
            </strong>
          </p>
        </div>

        <div className="expense-handling-row">
          <div className="expense-handling-card expense-handling-col-left">
            <h3>➕ Gestisci Pagamenti</h3>

            {!isUserAdmin ? (
              <p
                style={{
                  color: "#e74c3c",
                  fontWeight: "bold",
                  textAlign: "center",
                }}
              >
                🔒 Solo l'admin del gruppo può aggiungere quote.
              </p>
            ) : (
              <p style={{ textAlign: "center", color: "#7f8c8d" }}>
                Assegna una parte della spesa a un membro.
              </p>
            )}

            <form onSubmit={handleAddSplit}>
              <div className="expense-handling-form-group">
                <label className="expense-handling-label">
                  Membro del gruppo
                </label>
                <select
                  className="expense-handling-select"
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  required
                  disabled={!isUserAdmin}
                >
                  <option value="">-- Seleziona un membro --</option>
                  {availableMembers.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.user_email} ({member.user_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="expense-handling-form-group">
                <label className="expense-handling-label">
                  Importo dovuto (€)
                </label>
                <input
                  className="expense-handling-input"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={splitAmount}
                  onChange={(e) => setSplitAmount(e.target.value)}
                  required
                  disabled={!isUserAdmin}
                />
                <small
                  style={{
                    color: "#7f8c8d",
                    display: "block",
                    marginTop: "5px",
                  }}
                >
                  Rimanente da assegnare: <b>{remaining.toFixed(2)} €</b>
                </small>
              </div>

              <button
                type="submit"
                className="expense-handling-btn"
                disabled={!isUserAdmin}
              >
                {isUserAdmin ? "Aggiorna Quota" : "Solo Admin"}
              </button>
            </form>
          </div>

          <div className="expense-handling-card expense-handling-col-right">
            <h3>👥 Pagamenti Ricevuti</h3>

            <div className="expense-progress-container">
              <div
                className="expense-progress-bar"
                style={{
                  backgroundColor: progressColor,
                  width: `${percentage}%`,
                }}
              ></div>
            </div>

            <div className="expense-splits-list">
              {splits.length === 0 ? (
                <p
                  style={{
                    color: "#7f8c8d",
                    textAlign: "center",
                    fontStyle: "italic",
                  }}
                >
                  Nessuna divisione specificata.
                </p>
              ) : (
                splits.map((split) => (
                  <div
                    key={split.user_id}
                    className={`expense-split-item ${
                      isUserAdmin ? "admin-view" : ""
                    }`}
                  >
                    <div className="expense-split-details">
                      <strong>{split.user_name}</strong>
                      <span>
                        {split.last_updated
                          ? `Aggiornato: ${new Date(
                              split.last_updated
                            ).toLocaleDateString()}`
                          : "Data n/d"}
                      </span>
                    </div>

                    <div className="expense-split-action-wrapper">
                      <span className="expense-split-amount-display">
                        {parseFloat(split.amount).toFixed(2)} €
                      </span>

                      {isUserAdmin && (
                        <button
                          className="expense-split-delete-btn"
                          onClick={(e) => handleDeleteSplit(e, split.user_id)}
                        >
                          Elimina
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="expense-handling-footer">
              <strong>Totale Restituito:</strong>
              <span
                style={{
                  color: remaining !== 0 ? "#f39c12" : "#27ae60",
                  fontWeight: "bold",
                  fontSize: "1.1rem",
                }}
              >
                {totalCovered.toFixed(2)} / {totalAmount.toFixed(2)} €
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseHandling;