
# Expensor
Expensor è una piattaforma web **cloud native** ideata per la gestione di **spese**, singole e di gruppo,  **budget**, ed in generale per tenere traccia delle proprie uscite, mensili e non. 

Alla base del progetto si pone l'idea di creare un ambiente concentrato ed unificato che permetta di:

* aggiungere ed eliminare spese
* avere sott'occhio il budget mensile
* ricevere avvisi in caso di sforamento di budget
* creare gruppi di spesa per tener traccia dei debiti dei partecipanti
* creare più spese per un singolo gruppo


# Caratteristiche

## Funzionalità principali
* **Dashboard grafica** delle spese degli ultimi 30 giorni suddivise per categorie
* **Riepilogo breve** delle ultime 5 spese effettuate
* **Riepilogo completo** di tutte le spese inserire nell'account
* **Budget mensile** con barra di progresso 
* **Aggiunta della spesa** cpm Importo, Data, Categoria, e Descrizione
* **Gruppi di spesa** con creazione del gruppo e visualizzazione dei gruppi di cui si è membro
* **Spese del gruppo** gestibili dall'amministratore, con elenco grafico
* **Partecipanti del gruppo** gestibile dall'amministratore
* **Autenticazione sicura** con Microsoft Entra ID e Cookie HTTPOnly
* **Notifiche** via mail

## Architettura cloud

Expensor si basa su una architettura Serverless a Microservizi (FaaS) Cloud-Native. Seuge una struttura su pattern Single Page Application, in cui il frontend viene disaccoppiato dalla logica backend nonché dalla persistenza dei dati, elementi coi quali si interagisce strettamente tramite chiamate API RPC-oriented. 

L'utilizzo di componenti Azure (Database, Blob, SPA, Entra ID) permette di tralasciare la complessità dell'infrastruttura e concentrarsi strettamente sullo sviluppo puro della logica applicativa. 

![Architettura](https://github.com/Gi0NZ/Expensor/blob/main/Architettura/Architettura%20Expensor.jpeg "Architettura Expensor")

## Frontend
* React
* Layout strutturato con Navbar laterale
* Autenticazione tramite Azure Entra ID
* Gestione grafica dei ruoli
* Host su Azure Static Web Apps

## Backend
* Node.js
* API RPC-oriented per la gestione del backend
* Controllo dei permessi in base al ruolo
* Integrazione Azure basata su **Azure Functions**

## Servizi Azure Utilizzati
* **Microsoft Entra ID**
  * Autenticazione gestita tramite MSAL
  * Supportata da *HttpOnly Cookie* per la gestione della sessione

* **Azure Database SQL**
  * Persistenza di tutti i dati relazionali/strutturati
 
* **Azure Blob Storage**
  * Archiviazione delle immagini di profilo caricate dell'utente

* **Azure Functions**
  * Host del Backend
  * Gestione della porzione di logica applicativa serverless
  * Invio delle mail di avviso
 
* **Azure Monitor**
  * Monitoraggio generale delle prestazioni
 
* **Azure Insights**
  * Monitoraggio dettagliato delle Azure Functions
 
* **Azure Static Web App**
  * Host del frontend         

# Documentazione
* README dettagliati strutturati per Frontend e Backend
* JSDocs uniformi, accessibili aggiungendo al link del sito rispettivamente:
  * Frontend: \[* URL SITO *\]/docs/Frontend/index.html (![Link Frontend](https://witty-tree-011ef9703.4.azurestaticapps.net/docs/Frontend/index.html "Link Frontend"))
  * Backend: \[* URL SITO *\]/docs/Backend/index.html (![Link Backend](https://witty-tree-011ef9703.4.azurestaticapps.net/docs/Backend/index.html "Link Backend"))




# Struttura del  progetto
```text
Expensor/\
├── expensor_backend/      # API Serverless (Azure Functions & Node.js)\
│   └── README.md          # Documentazione Backend\
│
├── expensor_frontend/     # Client Application (React & MSAL)\
│   └── README.md          # Documentazione Frontend\
│
├── .gitignore             # File ignorati\
└── README.md              # Documentazione generale\
