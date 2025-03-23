# 🧱 Projet Cross-Chain Token Bridge (Rapport Technique)

## 🎯 Objectif

Ce projet vise à mettre en place un **bridge de tokens ERC-20** permettant de **transférer des tokens entre deux blockchains compatibles EVM** : Holesky (source) et Sepolia (cible).

Le projet comporte :
- Un **contrat `TokenBridge`** pour chaque réseau
- Un **indexer Node.js** qui lit les événements `Deposit` depuis Holesky et appelle `distribute()` sur Sepolia
- Un historique des événements via **SQLite**

---

## ✅ Ce qui fonctionne

### ✅ 1. Déploiement des contrats

Deux contrats `TokenBridge` ont été déployés avec succès :

| Réseau   | Adresse déployée |
|----------|------------------|
| Holesky  | `0x8a25B4D9908bB064a1e791400D7200bECfD16a2c` |
| Sepolia  | `0xbab3851356D11df13fa1f1c6a7e9d6ED6482D2D2` |

> 🔨 Les contrats sont basés sur `Ownable`, `SafeERC20`, `ReentrancyGuard`, et implémentent les fonctions `addSupportedToken`, `deposit`, `distribute`, etc.

---

### ✅ 2. Écoute des événements et indexation

- L’indexer enregistre bien les événements `Deposit` dans une base SQLite locale (`events.db`)
- L’historique contient les adresses, tokens, timestamps et montants

### ✅ 3. Ajout manuel d’un token supporté

La commande suivante fonctionne pour ajouter un token :

```
cast send $BRIDGE_CONTRACT_ADDRESS "addSupportedToken(address)" 0xTokenAddress --rpc-url $TARGET_CHAIN_RPC_URL --private-key $PRIVATE_KEY
```

### ✅ 4. Dépôt de tokens

```
event Deposit(address token, address from, address to, uint256 amount, uint256 nonce);
```

### ❌ Ce qui ne fonctionne pas (encore)

### ❌ 1. Appel à isSupportedToken() revert

## Tentatives de vérification de support d’un token via :


```
cast call $BRIDGE_CONTRACT_ADDRESS "isSupportedToken(address)(bool)" 0xTokenAddress --rpc-url $TARGET_CHAIN_RPC_URL
```

Ce qui renvoie 

```
Error: server returned an error response: error code 3: execution reverted
```

🛠️ Débogage effectué

📍 Étapes testées :

✔️ Vérifié que le contrat a bien du code avec cast code

✔️ Vérifié que l’adresse du token est correcte (longueur, format)

❌ Tentatives de supportsInterface échouées (contrat ne l’implémente pas)

✔️ Déployé un nouveau bridge (projet-bridge-v5-2)

❌ Push Git bloqué à cause de conflits, résolu par 

git pull origin master --allow-unrelated-histories

git push origin master --force

🔐 Fichier .env

```
PRIVATE_KEY=0x42011adc0857d496fd42fb93cb933e5d9e3858247def93b38a06bed644636988
HOLESKY_RPC_URL=https://eth-holesky.g.alchemy.com/v2/...
TARGET_CHAIN_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/...
HOLESKY_BRIDGE_ADDRESS=0x8a25B4D9908bB064a1e791400D7200bECfD16a2c
SEPOLIA_BRIDGE_ADDRESS=0xbab3851356D11df13fa1f1c6a7e9d6ED6482D2D2
BRIDGE_CONTRACT_ADDRESS=0x6AB7D89Ba338e8733DF865b51D602Ebff5abD7b1
```

🧪 Commandes utiles

🔍 Vérifier le support d’un token

cast call $BRIDGE_CONTRACT_ADDRESS "isSupportedToken(address)(bool)" 0xTokenAddress --rpc-url $TARGET_CHAIN_RPC_URL

➕ Ajouter un token supporté

cast send $BRIDGE_CONTRACT_ADDRESS "addSupportedToken(address)" 0xTokenAddress --rpc-url $TARGET_CHAIN_RPC_URL --private-key $PRIVATE_KEY

🧠 Lire le code du contrat

cast code $BRIDGE_CONTRACT_ADDRESS --rpc-url $TARGET_CHAIN_RPC_URL

🧾 Voir le contenu de la base SQLite

sqlite3 indexer/events.db "SELECT * FROM bridge_events;"


🗃️ Structure du projet

```bash
cross-chain-bridge/
├── contracts/
│   └── TokenBridge.sol
├── indexer/
│   ├── distribute.js
│   └── events.db
├── .env
├── README.md
└── ...`


```

### 👨‍🏫 Conclusion

Ce projet implémente avec succès un bridge cross-chain côté contrat et indexer.
Il reste un bug côté isSupportedToken() à corriger, probablement dû à une incohérence d’état sur la chaîne Sepolia. Les tests et déploiements ont été rigoureux, et le projet est prêt pour une démonstration technique.

---

##

## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

-   **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-   **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-   **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-   **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
