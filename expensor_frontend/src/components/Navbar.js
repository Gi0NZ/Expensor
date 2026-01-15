import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { localLogout } from "../services/AuthService";
import "../styles/Navbar.css";
import { msalInstance } from "../authConfig";
import { EventType } from "@azure/msal-browser";

const Navbar = () => {
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");

  const [isCollapsed, setIsCollapsed] = useState(() => {
    const savedState = localStorage.getItem("navbarCollapsed");
    return savedState === "true";
  });

  useEffect(() => {
    const updateDisplayName = () => {
      const currentAccount = msalInstance.getActiveAccount();

      if (currentAccount && currentAccount.name) {
        setDisplayName(currentAccount.name);
      } else {
        const storedProfile = localStorage.getItem("userProfile");
        if (storedProfile) {
          try {
            const profile = JSON.parse(storedProfile);
            setDisplayName(profile.name || "Utente");
          } catch (error) {
            setDisplayName("Utente");
          }
        } else {
          setDisplayName("Utente");
        }
      }
    };

    updateDisplayName();

    const callbackId = msalInstance.addEventCallback((event) => {
      if (
        event.eventType === EventType.LOGIN_SUCCESS ||
        event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS ||
        event.eventType === EventType.ACCOUNT_ADDED
      ) {
        const account = event.payload.account;
        msalInstance.setActiveAccount(account);
        updateDisplayName();
      }
    });

    return () => {
      if (callbackId) {
        msalInstance.removeEventCallback(callbackId);
      }
    };
  }, []);

  const handleLogout = async () => {
    try {
      await localLogout();
    } catch (error) {
      console.error("Errore durante il logout", error);
    } finally{
      window.location.href = "/login";
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
        {isCollapsed ? (
          <span className="nav-icon">👤</span>
        ) : (
          <span className="nav-text">{displayName}</span>
        )}
      </button>

      <button onClick={handleLogout} className="logout-button">
        <span className="nav-icon">🚪</span>
        <span className="nav-text">Logout</span>
      </button>
    </nav>
  );
};

export default Navbar;
