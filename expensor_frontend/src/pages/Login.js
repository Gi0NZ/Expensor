import React, { useEffect, useRef } from "react";
import { useMsal } from "@azure/msal-react";
import { useLocation, useNavigate } from "react-router-dom";
import { loginWithMicrosoft } from "../services/AuthService";
import "../styles/Login.css";
import { InteractionStatus } from "@azure/msal-browser";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { inProgress, instance } = useMsal();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (inProgress !== InteractionStatus.None) return;
    if (redirectedRef.current) return;

    const activeAccount = instance.getActiveAccount();
    const userProfile = localStorage.getItem("userProfile");

    if (activeAccount && userProfile && location.pathname === "/login") {
      navigate("/homepage", { replace: true });
    }
  }, [inProgress, instance, navigate, location.pathname]);

  const handleLogin = async () => {
    try {
      await loginWithMicrosoft();
      navigate("/homepage", { replace: true });
    } catch (error) {
      console.error("Errore nel login:", error);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="login-title">Benvenuto su Expensor</h1>
        <p className="login-subtitle">
          Accedi con il tuo account Microsoft per continuare
        </p>
        <button className="login-button" onClick={handleLogin}>
          Accedi con Microsoft
        </button>
      </div>
    </div>
  );
};

export default Login;
