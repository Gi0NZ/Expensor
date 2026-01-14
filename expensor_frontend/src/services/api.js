import { msalInstance } from "../authConfig";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

/**
 * Genera gli header standard per le richieste autenticate.
 * Recupera il token da sessionStorage e l'ID utente da MSAL.
 * @returns {object} Oggetto contenente gli header (Authorization, Content-Type, x-microsoft-id).
 * @throws {Error} Se il token non è disponibile.
 */
// const getAuthHeaders = () => {
//   const account = msalInstance.getActiveAccount();
//   //const token = sessionStorage.getItem("accessToken");
//   const microsoft_id = account?.localAccountId;

//   if (!token) {
//     console.error("⚠️ Nessun token trovato nel sessionStorage!");
//     throw new Error("Token non disponibile");
//   }

//   return {
//     Authorization: `Bearer ${token}`,
//     "Content-Type": "application/json",
//     "x-microsoft-id": microsoft_id,
//   };
// };

const headers = {"Content-Type": "application/json",};

/**
 * Recupera la lista di tutte le categorie disponibili per le spese.
 * @returns {Promise<Array<{id: number, name: string}>>} Array di oggetti categoria.
 */
export const getCategories = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/GetCategories`, {
      method: "GET",
      //headers: getAuthHeaders(),
      credentials: "include",
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || `Errore HTTP: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Errore nel recupero delle categorie:", error);
    throw error;
  }
};

/**
 * Aggiunge una nuova spesa personale.
 * @param {object} expenseData - Dati della spesa.
 * @param {number} expenseData.amount - Importo.
 * @param {string} expenseData.description - Descrizione.
 * @param {string} expenseData.date - Data (YYYY-MM-DD).
 * @param {number} expenseData.category_id - ID categoria.
 * @returns {Promise<object>} Risposta del server (messaggio successo).
 */
export async function addExpense(expenseData) {
  const res = await fetch(`${API_BASE_URL}/AddExpense`, {
    method: "POST",
    //headers: getAuthHeaders(),
    body: JSON.stringify(expenseData),
    credentials: "include",
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Errore sconosciuto");
  }

  return await res.json();
}

/**
 * Rimuove una spesa personale tramite ID.
 * @param {number} id - ID della spesa da eliminare.
 * @returns {Promise<object>} Conferma eliminazione.
 */
export async function removeExpense(id) {
  const response = await fetch(`${API_BASE_URL}/RemoveExpense`, {
    method: "POST",
    //headers: getAuthHeaders(),
    body: JSON.stringify({ id }),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Errore Sconosciuto");
  }

  return await response.json();
}

/**
 * Recupera le spese raggruppate per categoria (per grafici/statistiche).
 * Supporta filtri opzionali per mese e anno.
 * * @param {object} [filters={}] - Oggetto opzionale per i filtri (es. { month: 10, year: 2023 }).
 * @returns {Promise<Array<{category_name: string, total: number}>>} Array con totali per categoria.
 */
export async function getExpensesByCategory(filters = {}) {
  const response = await fetch(`${API_BASE_URL}/GetExpensesByCategory`, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(filters), 
    credentials: "include", 
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = "Errore nel recupero delle spese per categoria";
    try {
        const errorObj = JSON.parse(errorText);
        if (errorObj.error) errorMessage = errorObj.error;
    } catch (e) {
        errorMessage += `: ${errorText}`; 
    }
    
    throw new Error(errorMessage);
  }

  return response.json();
}
/**
 * Registra o aggiorna un utente nel backend dopo il login Microsoft.
 * @param {object} userData - Dati utente.
 * @param {string} userData.microsoft_id - ID Microsoft.
 * @param {string} userData.email - Email.
 * @param {string} userData.name - Nome visualizzato.
 * @returns {Promise<object>} Risposta server.
 */
export async function saveUserToBackend({ microsoft_id, email, name }) {
  try {
    const res = await fetch(`${API_BASE_URL}/SaveUser`, {
      method: "POST",
      //headers: getAuthHeaders(),
      body: JSON.stringify({ microsoft_id, email, name }),
      mode: "cors",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } catch (err) {
    console.error("SaveUser error:", err);
    throw err;
  }
}

/**
 * Recupera le ultime 5 spese personali dell'utente.
 * @returns {Promise<Array>} Lista delle spese recenti.
 */
export async function getRecentExpenses() {
  try {
    const response = await fetch(`${API_BASE_URL}/GetRecentExpenses`, {
      method: "GET",
      //headers: getAuthHeaders(),
      credentials: "include",
    });

    if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);

    return await response.json();
  } catch (error) {
    console.error("❌ Errore nel recupero delle ultime spese:", error);
    throw error;
  }
}

/**
 * Recupera lo storico completo delle spese personali.
 * @returns {Promise<Array>} Lista di tutte le spese.
 */
export async function getAllExpenses() {
  try {
    const response = await fetch(`${API_BASE_URL}/GetExpenses`, {
      method: "GET",
      //headers: getAuthHeaders(),
      credentials: "include",
    });

    if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);

    return await response.json();
  } catch (error) {
    console.error("Errore nel recupero di tutte spese:", error);
    throw error;
  }
}

/**
 * Crea un nuovo gruppo di spesa.
 * @param {object} groupData - Dati del gruppo.
 * @param {string} groupData.name - Nome del gruppo.
 * @param {string} groupData.created_by - ID creatore (opzionale se gestito da header).
 * @returns {Promise<object>} Oggetto con messaggio e ID del nuovo gruppo.
 */
export async function saveGroup(groupData) {
  try {
    const response = await fetch(`${API_BASE_URL}/SaveGroup`, {
      method: "POST",
      //headers: getAuthHeaders(),
      body: JSON.stringify(groupData),
      credentials: "include",
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Errore HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      if (data.length > 0) return data[0];
      throw new Error("Il server non ha restituito i dati del gruppo creato.");
    }

    if (data && data.id) {
      return data;
    }

    return { message: "Gruppo creato (Dati non ritornati dal server)" };
  } catch (err) {
    console.error("❌ Errore salvataggio gruppo:", err);
    throw err;
  }
}
/**
 * Recupera tutti i gruppi a cui l'utente partecipa.
 * @returns {Promise<Array>} Lista dei gruppi.
 */
export async function getGroupsByUser() {
  try {
    const response = await fetch(`${API_BASE_URL}/GetGroups`, {
      method: "GET",
      //headers: getAuthHeaders(),
      credentials: "include",
    });

    if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);

    return await response.json();
  } catch (error) {
    console.error("Errore nel recupero dei gruppi:", error);
    throw error;
  }
}

/**
 * Recupera la lista dei membri di un gruppo specifico.
 * @param {number} groupId - ID del gruppo.
 * @returns {Promise<Array>} Lista membri con dettagli.
 */
export async function getGroupMembers(groupId) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/GetGroupMembers?group_id=${groupId}`,
      {
        method: "GET",
        //headers: getAuthHeaders(),
        credentials: "include",
      }
    );

    if (!response.ok) throw new Error(`Errore HTTP ${response.status}`);

    return await response.json();
  } catch (err) {
    console.error("Errore nel recupero partecipanti:", err);
    return [];
  }
}

/**
 * Recupera i dettagli di un singolo membro nel contesto di un gruppo.
 * @param {number} group_id - ID Gruppo.
 * @param {string} microsoft_id - ID Utente.
 * @returns {Promise<Array>} Dati finanziari del membro nel gruppo (o array vuoto).
 */
export async function getSingleGroupMember(group_id, microsoft_id) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/GetSingleGroupMember?group_id=${group_id}&microsoft_id=${microsoft_id}`,
      {
        method: "GET",
        //headers: getAuthHeaders(),
        credentials: "include",
      }
    );

    if (response.status === 404) return [];

    if (!response.ok) throw new Error(`Errore HTTP ${response.status}`);

    return await response.json();
  } catch (err) {
    console.error("Errore recupero membro:", err);
    return [];
  }
}

/**
 * Cerca un utente tramite indirizzo email.
 * @param {string} email - Email da cercare.
 * @returns {Promise<Array>} Utente trovato (o array vuoto).
 */
export async function getUserByMail(email) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/GetUserByMail?email=${email}`,
      {
        method: "GET",
        //headers: getAuthHeaders(),
        credentials: "include",
      }
    );

    if (!response.ok) throw new Error(`Errore HTTP ${response.status}`);

    return await response.json();
  } catch (err) {
    console.error("Utente non trovato:", err);
    return [];
  }
}

/**
 * Recupera le informazioni sull'amministratore di un gruppo.
 * @param {number} groupId - ID del gruppo.
 * @returns {Promise<Array>} Dati dell'admin.
 */
export async function getGroupAdmin(groupId) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/GetGroupAdmin?group_id=${groupId}`,
      {
        method: "GET",
        //headers: getAuthHeaders(),
        credentials: "include",
      }
    );

    if (!response.ok) throw new Error(`Errore HTTP ${response.status}`);

    return await response.json();
  } catch (err) {
    console.error("Errore recupero admin:", err);
    return [];
  }
}

/**
 * Recupera la lista delle spese di un gruppo.
 * @param {number} groupId - ID del gruppo.
 * @returns {Promise<Array>} Lista spese.
 */
export async function getGroupExpenses(groupId) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/GetGroupExpenses?group_id=${groupId}`,
      {
        method: "GET",
        //headers: getAuthHeaders(),
        credentials: "include",
      }
    );

    if (!response.ok) throw new Error(`Errore HTTP ${response.status}`);

    return await response.json();
  } catch (err) {
    console.error("Errore recupero spese gruppo:", err);
    return [];
  }
}

/**
 * Recupera informazioni generali di un gruppo (nome, data creazione).
 * @param {number} groupId - ID Gruppo.
 * @returns {Promise<Array>} Dati del gruppo.
 */
export async function getGroupInfo(groupId) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/GetGroupInfo?group_id=${groupId}`,
      {
        method: "GET",
        //headers: getAuthHeaders(),
        credentials: "include",
      }
    );

    if (!response.ok) throw new Error(`Errore HTTP ${response.status}`);

    return await response.json();
  } catch (err) {
    console.error("Errore recupero info gruppo:", err);
    return [];
  }
}

/**
 * Aggiunge una nuova spesa al gruppo.
 * @param {object} params - Parametri spesa.
 * @param {number} params.group_id - ID Gruppo.
 * @param {string} params.description - Descrizione.
 * @param {number} params.amount - Importo.
 * @param {string} params.paid_by - ID Pagatore.
 * @returns {Promise<object>} Risposta server.
 */
export async function addGroupExpense({
  group_id,
  description,
  amount,
  paid_by,
}) {
  try {
    const res = await fetch(`${API_BASE_URL}/AddGroupExpense`, {
      method: "POST",
      //headers: getAuthHeaders(),
      body: JSON.stringify({ group_id, description, amount, paid_by }),
      mode: "cors",
      credentials: "include",
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } catch (err) {
    console.error("addGroupExpense error:", err);
    throw err;
  }
}

/**
 * Recupera i dettagli di una singola spesa di gruppo.
 * @param {object} params
 * @param {number} params.expenseId - ID Spesa.
 * @param {number} params.groupId - ID Gruppo.
 * @returns {Promise<object>} Dettagli spesa.
 */
export async function getExpenseDetails({ expenseId, groupId }) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/GetExpenseDetails?groupId=${groupId}&expenseId=${expenseId}`,
      {
        method: "GET",
        //headers: getAuthHeaders(),
        credentials: "include",
      }
    );

    if (!response.ok) throw new Error(`Errore HTTP ${response.status}`);

    return await response.json();
  } catch (err) {
    console.error("Errore recupero dettagli spesa:", err);
    return [];
  }
}

/**
 * Recupera le quote (splits) assegnate per una spesa.
 * @param {object} params
 * @param {number} params.expenseId
 * @param {number} params.groupId
 * @returns {Promise<Array>} Lista quote.
 */
export async function getExpenseSplits({ expenseId, groupId }) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/GetExpenseSplits?group_id=${groupId}&expenseId=${expenseId}`,
      {
        method: "GET",
        //headers: getAuthHeaders(),
        credentials: "include",
      }
    );

    if (!response.ok) throw new Error(`Errore HTTP ${response.status}`);

    return await response.json();
  } catch (err) {
    console.error("❌Errore recupero splits:", err);
    return [];
  }
}

/**
 * Aggiunge un utente a un gruppo esistente.
 * @param {object} params
 * @param {number} params.group_id
 * @param {string} params.microsoft_id
 * @returns {Promise<object>} Messaggio successo.
 */
export async function addGroupMember({ group_id, microsoft_id }) {
  try {
    const res = await fetch(`${API_BASE_URL}/AddGroupMember`, {
      method: "POST",
      //headers: getAuthHeaders(),
      body: JSON.stringify({ group_id, microsoft_id }),
      mode: "cors",
      credentials: "include",
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } catch (err) {
    console.error("addGroupMember error:", err);
    throw err;
  }
}

/**
 * Elimina una spesa di gruppo (Solo Admin).
 * @param {object} params
 * @param {number} params.groupId
 * @param {number} params.expenseId
 * @param {string} params.reqId - ID Richiedente (Admin).
 * @returns {Promise<object>} Conferma eliminazione.
 */
export async function removeGroupExpense({ groupId, expenseId, reqId }) {
  const response = await fetch(`${API_BASE_URL}/RemoveGroupExpense`, {
    method: "POST",
    //headers: getAuthHeaders(),
    body: JSON.stringify({ groupId, expenseId, reqId }),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Errore Sconosciuto");
  }

  return await response.json();
}

/**
 * Rimuove un membro dal gruppo (Solo Admin).
 * @param {object} params
 * @param {number} params.groupId
 * @param {string} params.removedId - ID Utente da rimuovere.
 * @param {string} params.reqId - ID Admin.
 * @returns {Promise<object>} Conferma rimozione.
 */
export async function removeGroupMember({ groupId, removedId, reqId }) {
  const response = await fetch(`${API_BASE_URL}/RemoveGroupMember`, {
    method: "POST",
    //headers: getAuthHeaders(),
    body: JSON.stringify({ groupId, removedId, reqId }),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Errore Sconosciuto");
  }

  return await response.json();
}

/**
 * Aggiunge o aggiorna una quota di spesa per un utente.
 * @param {object} params
 * @param {number} params.expense_id
 * @param {string} params.user_id
 * @param {number} params.amount
 * @returns {Promise<object>} Messaggio successo.
 */
export async function addExpenseSplit({ expense_id, user_id, amount }) {
  try {
    const response = await fetch(`${API_BASE_URL}/AddExpenseSplit`, {
      method: "POST",
      //headers: getAuthHeaders(),
      body: JSON.stringify({
        expense_id: parseInt(expense_id),
        user_id: user_id,
        amount: parseFloat(amount),
      }),
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Errore HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error("Errore in addExpenseSplit:", err);
    throw err;
  }
}

/**
 * Elimina un gruppo intero (Solo Admin).
 * @param {number} groupId
 * @returns {Promise<object>} Conferma eliminazione.
 */
export async function removeGroup(groupId) {
  const response = await fetch(`${API_BASE_URL}/RemoveGroup`, {
    method: "POST",
    //headers: getAuthHeaders(),
    body: JSON.stringify({ group_id: groupId }),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Errore durante l'eliminazione del gruppo");
  }

  return await response.json();
}

/**
 * Recupera tutte le informazioni profilo dell'utente.
 * @param {string} microsoft_id
 * @returns {Promise<object>} Dati profilo (o oggetto vuoto in caso di errore).
 */
export async function getUserInfo(microsoft_id) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/GetUserInfo?microsoft_id=${microsoft_id}`,
      {
        method: "GET",
        //headers: getAuthHeaders(),
        credentials: "include",
      }
    );
    if (!response.ok) throw new Error("Errore fetch user info");
    return await response.json();
  } catch (err) {
    console.error(err);
    return {};
  }
}

/**
 * Carica l'immagine profilo su Azure Blob Storage.
 * @param {FormData} formData - Contiene il file e l'ID utente.
 * @returns {Promise<object>} URL della nuova immagine.
 */
export async function uploadProfileImage(formData) {
  const token = sessionStorage.getItem("accessToken");
  const response = await fetch(`${API_BASE_URL}/UploadProfileImage`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) throw new Error("Errore upload");
  return await response.json();
}

/**
 * Elimina l'immagine profilo dell'utente.
 * @param {string} microsoft_id
 * @returns {Promise<object>} Messaggio conferma.
 */
export async function deleteProfileImage(microsoft_id) {
  const response = await fetch(`${API_BASE_URL}/DeleteProfileImage`, {
    method: "POST",
    //headers: getAuthHeaders(),
    body: JSON.stringify({ microsoft_id }),
    credentials: "include",
  });
  if (!response.ok) throw new Error("Errore cancellazione");
  return await response.json();
}
