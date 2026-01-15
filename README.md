
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

-- post deploy per bene

# Documentazione


expensor/\
├── expensor_backend/        # API Node.js e Azure functions\
│   └── README.md/\
├── frontend      # React \
│   └── README.md/\
├── .gitignore\
└── README.md\
