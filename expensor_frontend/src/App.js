import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { MsalProvider, useMsal } from "@azure/msal-react";
import { msalInstance } from "./authConfig";
import Homepage from "./pages/Homepage";
import AddExpense from "./pages/AddExpense";
import Login from "./pages/Login";
import { loginRequest } from "./authConfig";
import { EventType } from "@azure/msal-browser";
import ShowExpenses from "./pages/ShowExpenses";
import GroupExpenses from "./pages/GroupExpenses";
import GroupHandling from "./pages/GroupHandling";
import ExpenseHandling from "./pages/ExpenseHandling";
import ProfilePage from "./pages/ProfilePage";

import { saveUserToBackend } from "./services/api"; 

const AppContent = () => {
  const { instance } = useMsal();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;


    const cbId = instance.addEventCallback(async (event) => {
      if (!mounted) return;

      if (event.eventType === EventType.LOGIN_SUCCESS) {
        const acc = event.payload?.account;
        if (acc) {
          try {
            console.log("Login MSAL riuscito. Sincronizzazione con il Backend...");
            

            await saveUserToBackend({
                microsoft_id: acc.localAccountId, 
                email: acc.username,
                name: acc.name
            });
            
            console.log("Utente salvato e Cookie ricevuto!");

          } catch (error) {
            console.error("Errore critico salvataggio utente:", error);

          }

          instance.setActiveAccount(acc);
          setIsAuthenticated(true);
        }
      }

      if (event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS) {
        const at = event.payload?.accessToken;
        if (at) {
          sessionStorage.setItem("accessToken", at);
          setHasToken(true);
        }
      }
    });

    (async () => {
      await instance.handleRedirectPromise().catch(() => {});

      const all = instance.getAllAccounts();
      const active = instance.getActiveAccount() || all[0] || null;
      
      if (active) {
        instance.setActiveAccount(active);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }

      let token = sessionStorage.getItem("accessToken");
      if (active && !token) {
        try {
          const resp = await instance.acquireTokenSilent({
            ...loginRequest,
            account: active,
          });
          token = resp.accessToken;
          sessionStorage.setItem("accessToken", token);
        } catch {}
      }
      if (mounted) {
        setHasToken(!!token);
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (cbId) instance.removeEventCallback(cbId);
    };
  }, [instance, location.pathname]);

  if (loading) {
    return <h1>🔄 Verifica autenticazione...</h1>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated && hasToken ? (
            <Navigate to="/homepage" replace />
          ) : (
            <Login />
          )
        }
      />
      {isAuthenticated && hasToken ? (
        <>
          <Route path="/homepage" element={<Homepage />} />
          <Route path="/addExpense" element={<AddExpense />} />
          <Route path="/showExpenses" element={<ShowExpenses />} />
          <Route path="/groupExpenses" element={<GroupExpenses />} />
          <Route path="/groupHandling/:groupId" element={<GroupHandling />} />
          <Route
            path="/groupHandling/:groupId/expenseHandling/:expenseId"
            element={<ExpenseHandling />}
          />
          <Route path="/profilePage" element={<ProfilePage />} />

          <Route path="*" element={<Navigate to="/homepage" replace />} />
        </>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
};

const App = () => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    (async () => {
      await msalInstance.initialize();
      setIsInitialized(true);
    })();
  }, []);

  if (!isInitialized) {
    return <h1>Caricamento...</h1>;
  }

  return (
    <MsalProvider instance={msalInstance}>
      <Router>
        <AppContent />
      </Router>
    </MsalProvider>
  );
};

export default App;