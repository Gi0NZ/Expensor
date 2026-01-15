import React from "react";
import { useNavigate } from "react-router-dom";
import { loginWithMicrosoft, logout } from "../services/AuthService";

const AuthButtons = ({ isAuthenticated }) => {
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      await loginWithMicrosoft();
    } catch (error) {
      console.error("Errore durante il login:", error);
    }
  };

  const handleLogout = async () => {
    await localLogout();
    navigate("/login");
  };

  return (
    <div>
      {isAuthenticated ? (
        <button onClick={handleLogout} className="auth-button logout">
          Logout
        </button>
      ) : (
        <button onClick={handleLogin} className="auth-button login">
          Login con Microsoft
        </button>
      )}
    </div>
  );
};

export default AuthButtons;
