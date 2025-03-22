require("dotenv").config();
const { ethers } = require("ethers");
const sqlite3 = require("sqlite3").verbose();

// Charger les variables d'environnement
const SEPOLIA_RPC_URL = process.env.TARGET_CHAIN_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const SEPOLIA_BRIDGE_ADDRESS = process.env.SEPOLIA_BRIDGE_ADDRESS;

if (!SEPOLIA_RPC_URL || !PRIVATE_KEY || !SEPOLIA_BRIDGE_ADDRESS) {
  console.error("❌ Erreur: Vérifiez votre fichier .env !");
  process.exit(1);
}

// ABI du contrat Bridge (uniquement `distribute`)
const BRIDGE_ABI = [
  "function distribute(address token, address recipient, uint256 amount, uint256 depositNonce) external",
];

// Connexion au provider Sepolia + signer
const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const sepoliaBridge = new ethers.Contract(
  SEPOLIA_BRIDGE_ADDRESS,
  BRIDGE_ABI,
  wallet
);

// Connexion à SQLite
const db = new sqlite3.Database("./indexer/events.db");

// Fonction pour récupérer les événements Deposit non traités
const getPendingDeposits = () => {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM bridge_events WHERE event = 'Deposit' AND (processed IS NULL OR processed = 0)",
      [],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
};

// Fonction pour marquer un événement comme traité
const markAsProcessed = (transactionHash) => {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE bridge_events SET processed = 1 WHERE transactionHash = ?",
      [transactionHash],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

// Fonction pour traiter les transferts
const processDeposits = async () => {
  try {
    console.log("🔍 Recherche des Deposits non traités...");
    const deposits = await getPendingDeposits();

    if (deposits.length === 0) {
      console.log("✅ Aucun Deposit en attente.");
      return;
    }

    for (const deposit of deposits) {
      console.log("🔎 Vérification du dépôt en cours :", deposit);

      // Vérifier que les données sont bien présentes et valides
      if (!deposit.token || !deposit.recipient || !deposit.amount || !deposit.id) {
        console.error(`❌ Erreur: Données manquantes pour Tx: ${deposit.transactionHash}`);
        continue;
      }

      // Vérifier si `deposit.amount` est une valeur numérique valide
      if (isNaN(deposit.amount)) {
        console.error(`❌ Erreur: Amount invalide pour Tx: ${deposit.transactionHash}`);
        continue;
      }

      console.log(
        `🛠 Envoi de distribute pour Tx: ${deposit.transactionHash} | Token: ${deposit.token} | Recipient: ${deposit.recipient} | Amount: ${deposit.amount}`
      );

      try {
        // Conversion de `amount` en BigNumber
        const amountBN = ethers.parseUnits(deposit.amount.toString(), 18);
        console.log("💡 Amount converti en BigNumber:", amountBN.toString());

        // Appel de la fonction distribute sur Sepolia
        const tx = await sepoliaBridge.distribute(
          deposit.token,
          deposit.recipient,
          amountBN,
          deposit.id
        );

        console.log(`🔗 Transaction envoyée: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ Distribution confirmée: ${tx.hash}`);

        await markAsProcessed(deposit.transactionHash);
      } catch (err) {
        console.error(
          `❌ Erreur lors de la distribution pour ${deposit.transactionHash}:`,
          err
        );
      }
    }
  } catch (err) {
    console.error("❌ Erreur dans le traitement des Deposits:", err);
  }
};

// Exécution toutes les 20 sec
setInterval(processDeposits, 20000);
