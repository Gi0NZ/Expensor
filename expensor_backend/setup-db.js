require("dotenv").config();
const { connectDB } = require("./db"); 

async function setupDatabase() {
    try {
        const pool = await connectDB();
        console.log("Connessione a Azure SQL Database riuscita!");

        // Creazione della tabella users se non esiste
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
            CREATE TABLE users (
            microsoft_id NVARCHAR(255) PRIMARY KEY,
            id INT IDENTITY(1,1) UNIQUE NOT NULL,
            email NVARCHAR(255) UNIQUE NOT NULL,
            name NVARCHAR(255),
            created_at DATETIME DEFAULT GETDATE(),
            profile_image_url NVCHAR(MAX) NULL
        );
        `);
        console.log("✅ Tabella 'users' creata o già esistente.");

        // Creazione della tabella categories se non esiste
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='categories' AND xtype='U')
            CREATE TABLE categories (
                id INT IDENTITY(1,1) PRIMARY KEY,
                name NVARCHAR(255) NOT NULL,
                description NVARCHAR(500) NULL,
                created_at DATETIME DEFAULT GETDATE()
            );  
        `);
        console.log("✅ Tabella 'categories' creata o già esistente.");


        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM categories)
            BEGIN
                INSERT INTO categories (name, description)
                VALUES
                    (N'Alimentari', N'Spese per cibo e bevande'),
                    (N'Trasporti', N'Carburante, trasporto pubblico, taxi'),
                    (N'Casa', N'Affitto, mutuo, bollette, manutenzione'),
                    (N'Intrattenimento', N'Cinema, eventi, hobby, viaggi'),
                    (N'Salute', N'Medicinali, visite mediche, assicurazione'),
                    (N'Altro', N'Spese varie non categorizzate');
            END
        `);

    console.log("✅ Tabella categories creata e popolata con valori di default");


        // Creazione della tabella EXPENSES se non esiste
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='expenses' AND xtype='U')
            CREATE TABLE expenses (
                id INT IDENTITY(1,1) PRIMARY KEY,
                user_id NVARCHAR(255) NOT NULL,
                description NVARCHAR(255) NULL, -- Reso opzionale
                amount DECIMAL(10,2) NOT NULL,
                category_id INT NOT NULL, -- Usa il category_id invece di un NVARCHAR
                date DATE NOT NULL DEFAULT GETDATE(), -- Aggiunto campo data
                created_at DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (user_id) REFERENCES users(microsoft_id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE NO ACTION
            );
        `);
        console.log("✅ Tabella 'expenses' aggiornata con il riferimento alle categorie.");

        // Creazione della tabella groups se non esiste
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='groups' AND xtype='U')
            CREATE TABLE groups (
                id INT IDENTITY(1,1) PRIMARY KEY,
                admin NVARCHAR(255) NOT NULL,
                name NVARCHAR(255) NOT NULL,
                created_by NVARCHAR(255) NOT NULL,
                created_at DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (created_by) REFERENCES users(microsoft_id) ON DELETE CASCADE
                FOREIGN KEY (admin) REFERENCES users(microsoft_id) ON DELETE CASCADE
            );
        `);
        console.log("✅ Tabella 'groups' creata o già esistente.");

        // Creazione della tabella group_members se non esiste
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='group_members' AND xtype='U')
            CREATE TABLE group_members (
                group_id INT NOT NULL,
                user_id NVARCHAR(255) NOT NULL,
                contributed_amount DECIMAL(10,2) DEFAULT 0,
                owed_amount DECIMAL(10,2) DEFAULT 0,
                settled_amount DECIMAL(10,2) DEFAULT 0,
                PRIMARY KEY (group_id, user_id),
                FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(microsoft_id)
            );
        `);
        console.log("✅ Tabella 'group_members' creata o già esistente.");

        // Creazione della tabella group_expenses se non esiste
        //Mantiene le spese di un singolo gruppo
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='group_expenses' AND xtype='U')
            CREATE TABLE group_expenses (
                id INT IDENTITY(1,1) PRIMARY KEY,
                group_id INT NOT NULL,
                description NVARCHAR(255),
                amount DECIMAL(10,2) NOT NULL,
                paid_by NVARCHAR(255) NOT NULL,
                created_at DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
                FOREIGN KEY (paid_by) REFERENCES users(microsoft_id)
            );
        `);
        console.log("✅ Tabella 'group_expenses' creata o già esistente.");

        // Creazione della tabella group_expense_shares se non esiste
        //Questa tabella mantiene le porzioni dei singoli utenti di una singola spesa di un gruppo
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='group_expense_shares' AND xtype='U')
            CREATE TABLE group_expense_shares (
                expense_id INT NOT NULL,
                user_id NVARCHAR(255) NOT NULL,
                share_amount DECIMAL(10,2) NOT NULL,
                paid BIT DEFAULT 0,
                PRIMARY KEY (expense_id, user_id),
                FOREIGN KEY (expense_id) REFERENCES group_expenses(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(microsoft_id)
            );
        `);
        
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_budgets' AND xtype='U')
            CREATE TABLE user_budgets (
                user_id NVARCHAR(255) PRIMARY KEY,
                monthly_limit DECIMAL(10, 2) NOT NULL,
                last_email_sent_month DATE DEFAULT NULL 
            );
        `)

    } catch (err) {
        console.error("❌ Errore nella creazione del database:", err);
    }
}


setupDatabase();
