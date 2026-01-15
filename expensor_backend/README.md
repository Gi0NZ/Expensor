
# Expensor - Backend
Il backend di Expensor è sviluppato in **Node.js** tramite un approccio serverless basato sulle **Azure Functions**. Qui si gestisce tutto ciò che concerne con la logica applicativa della web page.

# Stack Tecnologico

* **Node.js**
* **MySQL**
* **Azure Blob Storage** (immagini profilo)
* **Azure Functions**
    * Gestione interazioni DB
    * Invio Mail di avviso
* **Azure Entra ID**
    * Easy Auth

# Struttura Backend

```text
expensor_backend\
├──  funzioni                   #Tutte le funzioni backend - omesse 
├── utils                       #Funzioni di utilità
   ├──  budgetMailSender.js    #Mail superamento budget
   └── cookieHelper.js         #Trasforma cookie string in JSON
├──  db.js                      #Gestione connessione DB
├── setup-db.js                 #Setup struttura DB
└── README.md
