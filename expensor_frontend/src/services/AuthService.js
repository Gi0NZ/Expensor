import { msalInstance, loginRequest } from "../authConfig";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const setServerSession = async (userProfile) => {
  const response = await fetch(`${API_BASE_URL}/SaveUser`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userProfile),
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Errore Server (${response.status}): ${errorText}`);
  }
};

export const loginWithMicrosoft = async () => {
  try {
    const response = await msalInstance.loginPopup(loginRequest);
    msalInstance.setActiveAccount(response.account);

    const account = response.account;

    const userProfile = {
      microsoft_id: account.localAccountId,
      name: account.name || "Utente",
      email: account.username || "",
    };

    await setServerSession(userProfile);

    localStorage.setItem("userProfile", JSON.stringify(userProfile));

    return account;
  } catch (error) {
    console.error("Errore durante il login:", error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await fetch(`${API_BASE_URL}/Logout`, {
      method: "POST",
      credentials: "include",
    });

    localStorage.removeItem("userProfile");
    await msalInstance.logoutPopup();
  } catch (error) {
    console.error("Errore durante il logout:", error);
  }
};

export const localLogout = async () => {
  try {
    await fetch(`${API_BASE_URL}/Logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("Errore logout backend:", error);
  } finally {
    localStorage.clear(); // Pulisce userProfile, navbarCollapsed, e cache MSAL se presente

    const account = msalInstance.getActiveAccount();
    if (account) {
      msalInstance.setActiveAccount(null);
    }

    sessionStorage.clear();
  }
};
