const joinInAGame = async (req, res) => {
    const { gameId } = req.params;
    const { playerName } = req.body;

    // Find the game with the given ID
    const game = games[gameId];
    const existingPlayer = game.players.find(
        (player) => player.name === playerName
    );
    if (!game) {
        // If the game is not found, return a 404 error
        res.status(404).json({ error: "Game not found" });
    } else if (game.players.length >= game.numPlayers) {
        // If the game already has the maximum number of players, return a 400 error
        res.status(400).json({ error: "Game is full" });
    } else if (existingPlayer) {
        res.status(400).json({ error: "Player with this Name Already Joined" });
    } else {
        // Add the new player to the game object
        game.players.push({
            id: game.players.length + 1,
            name: playerName,
            score: 0,
            turns: 0,
            nextTurn: false,
            questions: [],
        });

        setTimeout(() => {
            io.emit("playerJoined", {
                players: game.players,
                joinedPlayerName: playerName,
            });
        }, 1000);
        // Check if the game has reached the maximum number of players
        if (game.players.length === game.numPlayers) {
            // Start the game
            game.status = "active";

            // Emit a message to all connected clients that the game has started
            io.emit("game-started", { game });

            // Emit a message to all connected clients to update the game state
            io.emit("game-state-changed", {
                players: game.players.map((player) => (player ? player.name : null)),
                numPlayers: game.numPlayers,
                boardSize: game.board.length,
                numTurns: game.numTurns,
                status: game.status,
                gameId: game.id,
            });
        } else {
            game.status = "waiting";
            // Emit a message to all connected clients to update the game state
            io.emit("game-state-changed", {
                players: game.players,
                numPlayers: game.numPlayers,
                boardSize: game.board.length,
                numTurns: game.numTurns,
                status: game.status,
                gameId: game.id,
            });
        }

        // Return the game URL to the client
        res.json({
            playerName: playerName,
            numPlayers: game.numPlayers,
            playersJoined: game.players.length,
            players: game.players.map((player) => player.name),
            status: game.status,
            gameId: game.id,
            boardSize: game.board.length,
            numTurns: game.numTurns,
        });
    }
}

module.exports = {
    joinInAGame
}