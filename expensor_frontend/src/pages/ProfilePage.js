import React, { useState, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import "../styles/Profile.css";
import { msalInstance } from "../authConfig";
import {
  getUserInfo,
  uploadProfileImage,
  deleteProfileImage,
} from "../services/api";
import { showConfirm, showError, showSuccess } from "../components/alerts";

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  const account = msalInstance.getActiveAccount();
  const microsoft_id = account?.localAccountId;

  useEffect(() => {
    const loadData = async () => {
      try {
        const userData = await getUserInfo(microsoft_id);

        setUser(Array.isArray(userData) ? userData[0] : userData);
      } catch (err) {
        console.error("Errore profilo:", err);
      } finally {
        setLoading(false);
      }
    };
    if (microsoft_id) loadData();
  }, [microsoft_id]);

  const handleEditClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showError("Per favore carica un'immagine valida.");
      return;
    }

    const formData = new FormData();
    formData.append("image", file);
    formData.append("microsoft_id", microsoft_id);

    try {
      setLoading(true);
      const res = await uploadProfileImage(formData);

      setUser((prev) => ({ ...prev, profile_image_url: res.url }));
      showSuccess("Immagine aggiornata!");
    } catch (err) {
      console.error("Errore upload:", err);
      showError("Errore durante il caricamento.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!(await showConfirm("Vuoi rimuovere la tua foto profilo?", " ")))
      return;
    try {
      setLoading(true);
      await deleteProfileImage(microsoft_id);
      setUser((prev) => ({ ...prev, profile_image_url: null }));
    } catch (err) {
      showError("Errore rimozione foto");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !user)
    return <div className="page-container">Caricamento...</div>;

  return (
    <div className="homepage-container">
      <Navbar />
      <div className="profile-container">
        <div className="profile-card">
          <div className="profile-image-wrapper">
            {user?.profile_image_url ? (
              <img
                src={user.profile_image_url}
                alt="Profile"
                className="profile-img"
              />
            ) : (
              <div className="profile-placeholder">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            )}

            <button
              className="edit-image-btn"
              onClick={handleEditClick}
              title="Carica foto"
            >
              ✎
            </button>

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>

          <h2 className="profile-name">{user?.name}</h2>
          <p className="profile-detail">📧 {user?.email}</p>
          <p
            className="profile-detail"
            style={{ fontSize: "0.9rem", color: "#999" }}
          >
            📅 Membro dal:{" "}
            {user?.created_at
              ? new Date(user.created_at).toLocaleDateString()
              : "..."}
          </p>

          {user?.profile_image_url && (
            <button className="delete-photo-btn" onClick={handleDeletePhoto}>
              🗑 Rimuovi Foto
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
