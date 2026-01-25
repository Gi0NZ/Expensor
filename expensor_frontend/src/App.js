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
import { EventType } from "@azure/msal-browser";

import Homepage from "./pages/Homepage";
import AddExpense from "./pages/AddExpense";
import Login from "./pages/Login";
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
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const cbId = instance.addEventCallback(async (event) => {
      if (event.eventType === EventType.LOGIN_SUCCESS && event.payload.account) {
        const acc = event.payload.account;
        instance.setActiveAccount(acc);
        setIsAuthenticated(true);

        try {
          await saveUserToBackend({
            microsoft_id: acc.localAccountId,
            email: acc.username,
            name: acc.name,
          });
          if (mounted) setIsBackendReady(true);
        } catch (error) {
          console.error(error);
        }
      }
    });

    (async () => {
      await instance.handleRedirectPromise().catch(() => {});
      const active = instance.getActiveAccount();

      if (active) {
        setIsAuthenticated(true);
        try {
          await saveUserToBackend({
            microsoft_id: active.localAccountId,
            email: active.username,
            name: active.name,
          });
          if (mounted) setIsBackendReady(true);
        } catch (err) {
          console.error(err);
        }
      } else {
        setIsAuthenticated(false);
      }

      if (mounted) {
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (cbId) instance.removeEventCallback(cbId);
    };
  }, [instance]);

  if (loading) {
    return <h1>Caricamento...</h1>;
  }

  const canShowApp = isAuthenticated && isBackendReady;

  return (
    <Routes>
      <Route
        path="/login"
        element={canShowApp ? <Navigate to="/homepage" replace /> : <Login />}
      />
      {canShowApp ? (
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
        <Route
          path="*"
          element={
            isAuthenticated ? (
              <h1>Sincronizzazione in corso...</h1>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
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
    return <h1>Inizializzazione...</h1>;
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