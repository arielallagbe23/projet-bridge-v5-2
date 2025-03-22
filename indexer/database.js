const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./indexer/events.db");

// Création de la table si elle n'existe pas
db.serialize(() => {
    db.run(
        `CREATE TABLE IF NOT EXISTS bridge_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chain TEXT,
            event TEXT,
            transactionHash TEXT UNIQUE, 
            sender TEXT,
            recipient TEXT,
            amount TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            processed INTEGER DEFAULT 0  -- Ajout de la colonne 'processed' (0 = non traité, 1 = traité)
        )`
    );
});

module.exports = db;
