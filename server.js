const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// --- Configuration CORS ---
// On autorise les requêtes depuis n'importe quelle origine.
// C'est simple et efficace pour ce projet.
app.use(cors());

// --- Middleware ---
app.use(express.static('.')); // Sert les fichiers du dossier courant (html, css, js)
app.use(express.json()); // Permet au serveur de comprendre le JSON envoyé par le client

// ==================================================================
//               CONNEXION À LA BASE DE DONNÉES
// ==================================================================
// ✅✅✅ LA CORRECTION PRINCIPALE EST ICI ✅✅✅

// 1. On récupère l'adresse de connexion depuis les variables d'environnement de Render
const MONGODB_URI = process.env.MONGODB_URI;

// 2. On ajoute une sécurité : si la variable n'est pas trouvée, on arrête le serveur
//    pour éviter des erreurs obscures.
if (!MONGODB_URI) {
    console.error('[SERVEUR] ERREUR : La variable d\'environnement MONGODB_URI n\'est pas définie.');
    process.exit(1); // Arrête le processus du serveur
}

// 3. On se connecte à la base de données MongoDB Atlas en utilisant l'adresse sécurisée
mongoose.connect(MONGODB_URI)
  .then(() => console.log('[SERVEUR] Connexion à MongoDB Atlas réussie !'))
  .catch(err => console.error('[SERVEUR] Erreur de connexion à MongoDB', err));


// --- Schéma de la base de données ---
// (Aucun changement ici, c'était déjà parfait)
const scoreSchema = new mongoose.Schema({
    gameName: { type: String, required: true, index: true },
    playerName: { type: String, required: true },
    score: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Empêche un même joueur d'avoir deux scores pour le même jeu
scoreSchema.index({ playerName: 1, gameName: 1 }, { unique: true });

const Score = mongoose.model('Score', scoreSchema);

// ==================================================================
//               ROUTES API POUR LES SCORES
// ==================================================================
// (Aucun changement ici, la logique était déjà très bonne)

// Route pour soumettre un nouveau score
app.post('/api/scores', async (req, res) => {
    try {
        const { playerName, score, gameName } = req.body;

        if (!playerName || playerName.trim().length < 3 || typeof score !== 'number' || !gameName) {
            return res.status(400).json({ message: "Données invalides (pseudo 3 car. min, score, nom du jeu)." });
        }

        const sanitizedPlayerName = playerName.trim().substring(0, 15);
        const existingScore = await Score.findOne({ playerName: sanitizedPlayerName, gameName });

        if (existingScore) {
            // Si le joueur existe, on met à jour son score SEULEMENT s'il est meilleur
            if (score > existingScore.score) {
                existingScore.score = score;
                await existingScore.save();
                console.log(`[SERVEUR] Nouveau meilleur score pour ${sanitizedPlayerName} sur ${gameName}: ${score}`);
                return res.status(200).json({ message: "Meilleur score mis à jour !", player: existingScore });
            }
            return res.status(200).json({ message: "Le score n'a pas dépassé le record." });
        } else {
            // Si le joueur n'existe pas, on crée une nouvelle entrée
            const newScore = new Score({
                gameName,
                playerName: sanitizedPlayerName,
                score
            });
            await newScore.save();
            console.log(`[SERVEUR] Nouveau joueur ajouté au classement ${gameName}: ${sanitizedPlayerName} avec ${score}`);
            res.status(201).json({ message: "Score enregistré !", player: newScore });
        }
    } catch (error) {
        // Gère le cas où le pseudo est déjà pris (dû à l'index unique)
        if (error.code === 11000) {
             return res.status(409).json({ message: "Ce pseudo est déjà pris pour ce jeu." });
        }
        console.error("[SERVEUR] Erreur lors de la soumission du score:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});

// Route pour récupérer le classement d'un jeu
app.get('/api/scores/:gameName', async (req, res) => {
    try {
        const { gameName } = req.params;
        const topScores = await Score.find({ gameName: gameName, score: { $gt: 0 } })
                                     .sort({ score: -1 }) // Trie du plus grand au plus petit
                                     .limit(10); // Limite aux 10 meilleurs
        res.json(topScores);
    } catch (error) {
        console.error("[SERVEUR] Erreur lors de la récupération du classement:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});

// ==================================================================
//               GESTION MULTIJOUEUR (SOCKET.IO pour le Morpion)
// ==================================================================
// (Aucun changement ici, cette partie est indépendante et fonctionnelle)

const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const games = {};

io.on('connection', (socket) => {
    console.log(`[SERVEUR] Connexion Socket.IO: ${socket.id}`);

    socket.on('hostGame', () => {
        const gameCode = generateGameCode();
        games[gameCode] = { players: [socket] };
        socket.join(gameCode);
        socket.gameCode = gameCode;
        socket.emit('gameHosted', gameCode);
        console.log(`[SERVEUR] ${socket.id} a créé la partie ${gameCode}.`);
    });

    socket.on('joinGame', (gameCode) => {
        const game = games[gameCode];
        if (!game) return socket.emit('error', 'Code invalide.');
        if (game.players.length >= 2) return socket.emit('error', 'Partie pleine.');

        socket.join(gameCode);
        game.players.push(socket);
        socket.gameCode = gameCode;
        
        console.log(`[SERVEUR] ${socket.id} a rejoint ${gameCode}. Début de la partie.`);
        
        game.players[0].emit('gameStarted', 'X');
        game.players[1].emit('gameStarted', 'O');
    });

    socket.on('makeMove', (data) => {
        if (socket.gameCode) {
            socket.to(socket.gameCode).emit('moveMade', data);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[SERVEUR] Déconnexion Socket.IO: ${socket.id}`);
        const gameCode = socket.gameCode;
        if (gameCode && games[gameCode]) {
            socket.to(gameCode).emit('opponentDisconnected');
            delete games[gameCode];
            console.log(`[SERVEUR] Partie ${gameCode} supprimée.`);
        }
    });
});

function generateGameCode() {
    let code = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return games[code] ? generateGameCode() : code;
}

// --- Démarrage du serveur ---
// Render fournit son propre port via process.env.PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur en écoute sur le port ${PORT}`));