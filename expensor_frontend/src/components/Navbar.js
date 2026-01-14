import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../services/AuthService";
import "../styles/Navbar.css";

const Navbar = () => {
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");

  const [isCollapsed, setIsCollapsed] = useState(() => {
    const savedState = localStorage.getItem("navbarCollapsed");
    return savedState === "true";
  });

  useEffect(() => {
    const storedProfile = localStorage.getItem("userProfile");

    if (storedProfile) {
      try {
        const profile = JSON.parse(storedProfile);

        setDisplayName(profile.name || "Utente");
      } catch (error) {
        console.error("Errore parsing profilo utente", error);
        setDisplayName("Utente");
      }
    } else {
      setDisplayName("Utente");
    }
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Errore durante il logout", error);
      navigate("/login");
    }
  };

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const newState = !prev;
      localStorage.setItem("navbarCollapsed", newState);
      return newState;
    });
  };

  useEffect(() => {
    const width = isCollapsed ? "70px" : "200px";
    document.documentElement.style.setProperty("--navbar-width", width);
  }, [isCollapsed]);

  return (
    <nav className={`navbar ${isCollapsed ? "collapsed" : ""}`}>
      <button
        onClick={toggleSidebar}
        className="toggle-button"
        title={isCollapsed ? "Espandi" : "Riduci"}
      >
        {isCollapsed ? ">" : "<"}
      </button>

      <button onClick={() => navigate("/homepage")}>
        <span className="nav-icon">🏠</span>
        <span className="nav-text">Homepage</span>
      </button>

      <button onClick={() => navigate("/addExpense")}>
        <span className="nav-icon">➕</span>
        <span className="nav-text">Aggiungi Spesa</span>
      </button>

      <button onClick={() => navigate("/showExpenses")}>
        <span className="nav-icon">🧾</span>
        <span className="nav-text">Elenco Spese</span>
      </button>

      <button onClick={() => navigate("/groupExpenses")}>
        <span className="nav-icon">👥</span>
        <span className="nav-text">Gruppi Spesa</span>
      </button>

      <div className="spacer"></div>

      <button onClick={() => navigate("/profilePage")} className="name-button">
        <span className="nav-text">{displayName}</span>
      </button>

      <button onClick={handleLogout} className="logout-button">
        <span className="nav-icon">🚪</span>
        <span className="nav-text">Logout</span>
      </button>
    </nav>
  );
};

export default Navbar;
