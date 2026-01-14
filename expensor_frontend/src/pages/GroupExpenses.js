import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import {
  getGroupsByUser,
  saveGroup,
  getGroupMembers,
  getGroupAdmin,
  removeGroup,
} from "../services/api";
import "../styles/GroupExpenses.css";
import { showConfirm, showError, showSuccess } from "../components/alerts";

const GroupExpenses = () => {
  const [name, setGroupName] = useState("");
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState({});
  const [admins, setAdmins] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    const storedProfile = localStorage.getItem("userProfile");
    if (storedProfile) {
      const profile = JSON.parse(storedProfile);
      setCurrentUserId(profile.microsoft_id);
    }
  }, []);

  useEffect(() => {
    async function fetchGroups() {
      try {
        const fetchedGroups = await getGroupsByUser();
        setGroups(fetchedGroups);

        for (const group of fetchedGroups) {
          await handleLoadGroupsAdmin(group.id);
          await handleLoadGroupMembers(group.id);
        }
      } catch (err) {
        console.error("Errore nel recupero gruppi:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchGroups();
  }, []);

  const handleDeleteGroup = async (groupId, e) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmDelete = await showConfirm(
      "Sei sicuro di voler eliminare questo gruppo?",
      "Verranno cancellate anche tutte le spese associate."
    );
    if (!confirmDelete) return;

    try {
      await removeGroup(groupId);
      setGroups((prevGroups) => prevGroups.filter((g) => g.id !== groupId));
      showSuccess("Gruppo eliminato con successo.");
    } catch (err) {
      console.error("Errore eliminazione gruppo:", err);
      showError("Impossibile eliminare il gruppo: " + err.message);
    }
  };

  const handleLoadGroupsAdmin = async (groupId) => {
    try {
      const admin = await getGroupAdmin(groupId);
      const adminObject = Array.isArray(admin) ? admin[0] : admin;
      if (!adminObject) return;

      setAdmins((prev) => ({
        ...prev,
        [groupId]: admin,
      }));
    } catch (err) {
      console.error(`Errore nel caricamento admin del gruppo ${groupId}`, err);
    }
  };

  const handleLoadGroupMembers = async (groupId) => {
    try {
      const membersList = await getGroupMembers(groupId);
      setMembers((prev) => ({
        ...prev,
        [groupId]: membersList,
      }));
    } catch (err) {
      console.error(`Errore nel caricamento membri del gruppo ${groupId}`, err);
    }
  };

  const handleSaveGroup = async (e) => {
    if (!name.trim()) return;
    try {
      const res = await saveGroup({
        name,
      });

      showSuccess(res.message || "Gruppo creato correttamente");
      setGroupName("");

      const updatedGroups = await getGroupsByUser();
      setGroups(updatedGroups);

      for (const group of updatedGroups) {
        if (!admins[group.id]) await handleLoadGroupsAdmin(group.id);
        if (!members[group.id]) await handleLoadGroupMembers(group.id);
      }
    } catch (err) {
      console.error("Errore nel salvataggio del gruppo", err);
      showError(`Errore: ${err.message}`);
    }
  };

  return (
    <div className="group-expenses-wrapper">
      <Navbar />

      <div className="group-expenses-content">
        <h1 className="group-expenses-title">👥 Gestione Gruppi</h1>

        <div className="group-expenses-sections">
          <div className="group-expenses-card">
            <h2 className="group-expenses-card-title">➕ Crea Nuovo Gruppo</h2>
            <div className="group-expenses-form">
              <input
                type="text"
                className="group-expenses-input"
                placeholder="Nome del gruppo..."
                value={name}
                onChange={(e) => setGroupName(e.target.value)}
              />
              <button
                className="group-expenses-save-btn"
                onClick={handleSaveGroup}
              >
                💾 Salva Gruppo
              </button>
            </div>
          </div>

          <div className="group-expenses-card">
            <h2 className="group-expenses-card-title">📋 I Miei Gruppi</h2>

            <ul className="group-expenses-list">
              {loading ? (
                <p style={{ textAlign: "center", color: "#7f8c8d" }}>
                  Caricamento gruppi...
                </p>
              ) : groups.length > 0 ? (
                groups.map((group) => {
                  const groupAdminInfo =
                    admins[group.id] && admins[group.id][0];
                  const groupAdminId = groupAdminInfo
                    ? groupAdminInfo.admin
                    : null;

                  const isGroupAdmin = currentUserId === groupAdminId;

                  return (
                    <li key={group.id} className="group-expenses-item">
                      <Link
                        to={`/groupHandling/${group.id}`}
                        className="group-expenses-link"
                      >
                        <div className="group-expenses-info">
                          <h3>{group.name}</h3>

                          {members[group.id] && admins[group.id] ? (
                            <p>
                              👑 <b>{admins[group.id][0].name}</b> • 👥{" "}
                              {members[group.id].length} membri
                            </p>
                          ) : (
                            <p>🔄 Caricamento info...</p>
                          )}
                        </div>

                        {isGroupAdmin && (
                          <button
                            className="group-expenses-delete-btn"
                            onClick={(e) => handleDeleteGroup(group.id, e)}
                            title="Elimina Gruppo"
                          >
                            🗑️
                          </button>
                        )}
                      </Link>
                    </li>
                  );
                })
              ) : (
                <p style={{ textAlign: "center", padding: "20px" }}>
                  Non sei ancora membro di nessun gruppo.
                </p>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupExpenses;
