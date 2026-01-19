import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import {
  getGroupMembers,
  getGroupExpenses,
  getGroupInfo,
  addGroupExpense,
  addGroupMember,
  getSingleGroupMember,
  getUserByMail,
  getGroupAdmin,
  removeGroupExpense,
  removeGroupMember,
} from "../services/api";
import { showSuccess, showError, showConfirm } from "../components/alerts";
import "../styles/GroupHandling.css";

const GroupHandling = () => {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminId, setAdminId] = useState(null);
  const [adminName, setAdminName] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");

  useEffect(() => {
    const storedProfile = localStorage.getItem("userProfile");
    if (storedProfile) {
      const profile = JSON.parse(storedProfile);
      setCurrentUserId(profile.microsoft_id);
    }
  }, []);

  useEffect(() => {
    if (!groupId) return;
    const loadData = async () => {
      try {
        setLoading(true);
        const [groupData, groupMembers, expensesData, adminData] =
          await Promise.all([
            getGroupInfo(groupId),
            getGroupMembers(groupId),
            getGroupExpenses(groupId),
            getGroupAdmin(groupId),
          ]);
        setGroup(groupData);
        setExpenses(expensesData);
        setMembers(groupMembers);
        if (adminData && adminData.length > 0) {
          setAdminId(adminData[0].admin);
          setAdminName(adminData[0].name);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [groupId]);

  const isUserAdmin = currentUserId === adminId;

  const handleAddExpense = async (e) => {
    e.preventDefault();

    if (!isUserAdmin) return;

    try {
      const group_id = group[0].id;

      const res = await addGroupExpense({
        group_id,
        description,
        amount,
      });

      showSuccess(res.message || "Spesa aggiunta correttamente!");

      setAmount("");
      setDescription("");
      const updatedExpenses = await getGroupExpenses(groupId);
      setExpenses(updatedExpenses);
    } catch (err) {
      console.error(err);
      showError(err.message || "Impossibile salvare la spesa.");
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();

    if (!isUserAdmin) return;

    try {
      const usersFound = await getUserByMail(newMemberEmail);

      if (!usersFound || usersFound.length === 0) {
        showError(
          "La mail selezionata non corrisponde ad un utente registrato!",
        );
        return;
      }

      const userToAdd_microsoft_id = usersFound[0].microsoft_id;
      const alrExistsMember = await getSingleGroupMember(
        groupId,
        userToAdd_microsoft_id,
      );

      if (alrExistsMember && alrExistsMember.length > 0) {
        showError("L'utente inserito fa già parte del gruppo");
        return;
      }

      await addGroupMember({
        group_id: groupId,
        microsoft_id: userToAdd_microsoft_id,
      });

      showSuccess("Membro aggiunto con successo!");
      setNewMemberEmail("");

      const updatedMembers = await getGroupMembers(groupId);
      setMembers(updatedMembers);
    } catch (err) {
      console.error(err);
      showError("Errore durante l'aggiunta del membro.");
    }
  };

  const handleDeleteGroupExpense = async (e, expenseId) => {
    e.preventDefault();
    e.stopPropagation();

    const isConfirmed = await showConfirm(
      "Elimina Spesa",
      "Sei sicuro di voler eliminare questa spesa? L'azione è irreversibile.",
    );

    if (!isConfirmed) return;

    try {
      await removeGroupExpense({
        groupId: groupId,
        expenseId: expenseId,
      });

      showSuccess("Spesa eliminata con successo");
      const updatedExpenses = await getGroupExpenses(groupId);
      setExpenses(updatedExpenses);
    } catch (err) {
      console.error(err);
      showError("Errore durante l'eliminazione");
    }
  };

  const handleDeleteGroupMember = async (e, user_id) => {
    e.preventDefault();
    e.stopPropagation();

    const isConfirmed = await showConfirm(
      "Espelli Utente",
      "Sei sicuro? Se lo elimini, i suoi dati storici nel gruppo potrebbero diventare inconsistenti.",
    );

    if (!isConfirmed) return;

    try {
      await removeGroupMember({
        groupId: groupId,
        removedId: user_id,
      });

      showSuccess("Utente espulso dal gruppo");
      const updatedMembers = await getGroupMembers(groupId);
      setMembers(updatedMembers);
    } catch (err) {
      console.error(err);
      showError("Errore durante l'eliminazione");
    }
  };

  if (loading)
    return (
      <div className="group-handling-wrapper">
        <Navbar />
        <div className="group-handling-content">
          <p>Caricamento...</p>
        </div>
      </div>
    );
  if (!group)
    return (
      <div className="group-handling-wrapper">
        <Navbar />
        <div className="group-handling-content">
          <p>Gruppo non trovato.</p>
        </div>
      </div>
    );

  return (
    <div className="group-handling-wrapper">
      <Navbar />

      <div className="group-handling-content">
        <h1 className="group-handling-title">{group[0].name}</h1>

        <h2 className="group-handling-section-title">Gestione Spese</h2>
        <div className="group-handling-section-row">
          <div className="group-handling-card group-handling-col-left">
            <h3>➕ Aggiungi una spesa</h3>

            {!isUserAdmin && (
              <p
                style={{
                  color: "#e74c3c",
                  fontWeight: "bold",
                  textAlign: "center",
                  fontSize: "0.9rem",
                  marginBottom: "15px",
                }}
              >
                🔒 Solo l'admin può aggiungere spese.
              </p>
            )}

            <form onSubmit={handleAddExpense}>
              <div className="group-handling-form-group">
                <label className="group-handling-label" htmlFor="description">
                  Descrizione
                </label>
                <input
                  className="group-handling-input"
                  type="text"
                  value={description}
                  placeholder="Es. Cena"
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  disabled={!isUserAdmin}
                />
              </div>
              <div className="group-handling-form-group">
                <label className="group-handling-label" htmlFor="amount">
                  Importo
                </label>
                <input
                  className="group-handling-input"
                  type="number"
                  value={amount}
                  placeholder="0.00"
                  step="0.01"
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  disabled={!isUserAdmin}
                />
              </div>
              <button
                type="submit"
                className="group-handling-save-btn"
                disabled={!isUserAdmin}
              >
                {isUserAdmin ? "Salva spesa" : "Solo Admin"}
              </button>
            </form>
          </div>

          <div className="group-handling-card group-handling-col-right">
            <h3>🧾 Elenco Spese</h3>
            <div className="group-handling-list">
              {expenses.length === 0 ? (
                <p style={{ color: "#7f8c8d", textAlign: "center" }}>
                  Nessuna spesa ancora registrata.
                </p>
              ) : (
                expenses.map((expense) => (
                  <Link
                    key={expense.id}
                    to={`/groupHandling/${groupId}/expenseHandling/${expense.id}`}
                    className={`group-handling-item ${
                      isUserAdmin ? "admin-view" : ""
                    }`}
                  >
                    <div className="group-handling-item-details">
                      <strong>{expense.description}</strong>
                    </div>

                    <div className="group-handling-action-wrapper">
                      <span className="group-handling-amount-display">
                        {expense.amount.toFixed(2)} €
                      </span>

                      {isUserAdmin && (
                        <button
                          className="group-handling-delete-btn"
                          onClick={(e) =>
                            handleDeleteGroupExpense(e, expense.id)
                          }
                        >
                          Elimina
                        </button>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        <h2 className="group-handling-section-title">Partecipanti</h2>
        <div
          className="group-handling-section-row"
          style={{ marginBottom: "40px" }}
        >
          <div className="group-handling-card group-handling-col-left">
            <h3>➕ Aggiungi Partecipante</h3>

            {!isUserAdmin && (
              <p
                style={{
                  color: "#e74c3c",
                  fontWeight: "bold",
                  textAlign: "center",
                  fontSize: "0.9rem",
                  marginBottom: "15px",
                }}
              >
                🔒 Solo l'admin può invitare utenti.
              </p>
            )}

            <form onSubmit={handleAddMember}>
              <div className="group-handling-form-group">
                <label className="group-handling-label" htmlFor="memberEmail">
                  Email Utente
                </label>
                <input
                  className="group-handling-input"
                  type="email"
                  id="memberEmail"
                  value={newMemberEmail}
                  placeholder="mario.rossi@email.com"
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  required
                  disabled={!isUserAdmin}
                />
              </div>

              <p
                style={{
                  fontSize: "0.85rem",
                  color: "#666",
                  marginTop: "10px",
                }}
              >
                L'utente verrà aggiunto con un saldo iniziale di 0,00 €.
              </p>

              <button
                type="submit"
                className="group-handling-save-btn"
                disabled={!isUserAdmin}
              >
                {isUserAdmin ? "Aggiungi al Gruppo" : "Solo Admin"}
              </button>
            </form>
          </div>

          <div className="group-handling-card group-handling-col-right">
            <h3>👥 Elenco Partecipanti</h3>
            <div className="group-handling-list">
              <div
                className="group-handling-item"
                style={{
                  cursor: "default",
                  backgroundColor: "#fdfdfd",
                  borderLeft: "4px solid #f1c40f",
                }}
              >
                <div className="group-handling-item-details">
                  <strong>👑 {adminName} (Amministratore)</strong>
                </div>
              </div>

              {members.length === 0 ? (
                <p style={{ color: "#7f8c8d", textAlign: "center" }}>
                  Nessun altro membro nel gruppo.
                </p>
              ) : (
                members.map((member) => (
                  <div
                    key={member.user_id}
                    className={`group-handling-item ${
                      isUserAdmin ? "admin-view" : ""
                    }`}
                    style={{ cursor: "default" }}
                  >
                    <div className="group-handling-item-details">
                      <strong>👤 {member.user_name}</strong>
                      <span>{member.user_email}</span>
                    </div>

                    <div className="group-handling-action-wrapper">
                      {isUserAdmin && (
                        <button
                          className="group-handling-delete-btn"
                          onClick={(e) =>
                            handleDeleteGroupMember(e, member.user_id)
                          }
                        >
                          Espelli
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupHandling;
