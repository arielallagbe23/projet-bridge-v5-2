require("dotenv").config();
const { ethers } = require("ethers");
const sqlite3 = require("sqlite3").verbose();

// 📂 Connexion à la base de données SQLite
const db = new sqlite3.Database("./indexer/events.db", (err) => {
    if (err) {
        console.error("❌ Erreur de connexion à SQLite :", err.message);
    } else {
        console.log("✅ Connexion réussie à la base de données SQLite.");
    }
});

// 🔹 Création de la table si elle n'existe pas
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
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
    );
});

// 🚀 **Charger les variables d'environnement**
const HOLESKY_RPC_URL = process.env.HOLESKY_RPC_URL;
const SEPOLIA_RPC_URL = process.env.TARGET_CHAIN_RPC_URL;
const HOLESKY_BRIDGE_ADDRESS = process.env.HOLESKY_BRIDGE_ADDRESS;
const SEPOLIA_BRIDGE_ADDRESS = process.env.SEPOLIA_BRIDGE_ADDRESS;

if (!HOLESKY_RPC_URL || !SEPOLIA_RPC_URL) {
    console.error("❌ Erreur: les variables RPC ne sont pas définies. Vérifiez votre fichier .env !");
    process.exit(1);
}

if (!HOLESKY_BRIDGE_ADDRESS || !SEPOLIA_BRIDGE_ADDRESS) {
    console.error("❌ Erreur: adresses du bridge non définies !");
    process.exit(1);
}

console.log("🌍 RPC Chargées :");
console.log(" - HOLESKY_RPC_URL :", HOLESKY_RPC_URL);
console.log(" - SEPOLIA_RPC_URL :", SEPOLIA_RPC_URL);
console.log("📜 Adresses des bridges :");
console.log(" - HOLESKY_BRIDGE_ADDRESS :", HOLESKY_BRIDGE_ADDRESS);
console.log(" - SEPOLIA_BRIDGE_ADDRESS :", SEPOLIA_BRIDGE_ADDRESS);

// 🔹 **ABI du contrat Bridge**
const BRIDGE_ABI = [
    "event Deposit(address indexed token, address indexed from, address indexed to, uint256 amount, uint256 nonce)",
    "event Distribution(address indexed token, address indexed to, uint256 amount, uint256 nonce)"
];

// 🔹 **Configuration des fournisseurs (RPC) et des contrats**
const holeskyProvider = new ethers.JsonRpcProvider(HOLESKY_RPC_URL);
const sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);

const holeskyBridge = new ethers.Contract(HOLESKY_BRIDGE_ADDRESS, BRIDGE_ABI, holeskyProvider);
const sepoliaBridge = new ethers.Contract(SEPOLIA_BRIDGE_ADDRESS, BRIDGE_ABI, sepoliaProvider);

// 📌 **Fonction pour sauvegarder un événement dans SQLite en évitant les doublons**
const saveEvent = (chain, event, transactionHash, sender, recipient, amount) => {
    db.run(
        `INSERT OR IGNORE INTO bridge_events (chain, event, transactionHash, sender, recipient, amount) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [chain, event, transactionHash, sender, recipient, amount],
        function (err) {
            if (err) {
                console.error(`❌ Erreur SQLite: ${err.message}`);
            } else if (this.changes === 0) {
                console.log(`⚠️ L'événement ${event} avec Tx ${transactionHash} existe déjà en BDD.`);
            } else {
                console.log(`✅ Événement ${event} sauvegardé avec succès dans SQLite.`);
            }
        }
    );
};

// 📌 **Récupérer les événements du smart contract par batchs de 500 blocs**
const fetchEvents = async (provider, contract, chainName) => {
    console.log(`🔍 Récupération des événements pour ${chainName}...`);

    try {
        const latestBlock = await provider.getBlockNumber();
        const batchSize = 500;
        let fromBlock = latestBlock - 5000; // 🔥 Ajustement de la plage
        if (fromBlock < 0) fromBlock = 0;

        while (fromBlock <= latestBlock) {
            let toBlock = Math.min(fromBlock + batchSize - 1, latestBlock);

            console.log(`🧐 Recherche des événements de ${fromBlock} à ${toBlock}`);

            // 🔹 **Récupérer les événements "Deposit"**
            const depositEvents = await contract.queryFilter("Deposit", fromBlock, toBlock);
            console.log(`✅ ${depositEvents.length} événements Deposit trouvés sur ${chainName}`);

            depositEvents.forEach(event => {
                console.log(`🔹 Deposit détecté | Tx: ${event.transactionHash}`);
                const { token, from, to, amount, nonce } = event.args;
                saveEvent(chainName, "Deposit", event.transactionHash, from, to, amount.toString());
            });

            // 🔹 **Récupérer les événements "Distribution"**
            const distributionEvents = await contract.queryFilter("Distribution", fromBlock, toBlock);
            console.log(`✅ ${distributionEvents.length} événements Distribution trouvés sur ${chainName}`);

            distributionEvents.forEach(event => {
                console.log(`🔹 Distribution détectée | Tx: ${event.transactionHash}`);
                const { token, to, amount, nonce } = event.args;
                saveEvent(chainName, "Distribution", event.transactionHash, "Bridge", to, amount.toString());
            });

            fromBlock = toBlock + 1; // ⏭️ Passer au prochain batch
        }

        console.log(`✅ Événements récupérés avec succès pour ${chainName}`);

    } catch (err) {
        console.error(`❌ Erreur lors de la récupération des événements pour ${chainName}:`, err);
    }
};

// ✅ **Protection contre les exécutions concurrentes de l'indexation**
let isIndexing = false;

const startIndexing = async () => {
    if (isIndexing) {
        console.log("⏳ Indexation déjà en cours...");
        return;
    }

    isIndexing = true;
    try {
        await fetchEvents(holeskyProvider, holeskyBridge, "Holesky");
        await fetchEvents(sepoliaProvider, sepoliaBridge, "Sepolia");
    } catch (error) {
        console.error("❌ Erreur pendant l'indexation:", error);
    } finally {
        isIndexing = false;
    }
};

// 🚀 **Lancer l'indexation toutes les 15 secondes**
setInterval(startIndexing, 15000);
