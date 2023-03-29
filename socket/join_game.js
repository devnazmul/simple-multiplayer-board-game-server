const { games } = require("../db");

const joinGame = (socket,io) => {
    socket.on("join-game", (data) => {
        const { gameId, playerName } = data;
        let game = games[gameId];
        if (!game) {
            // If the game is not found, send an error message to the client
            socket.emit("game_not_found", { gameId });
            return;
        }

        if (game.started) {
            socket.emit("game_join_error", { error: "Game has already started" });
            return;
        }

        if (game.players.length >= game.numPlayers) {
            socket.emit("game_join_error", { error: "Game is full" });
            return;
        }

        // Check if player with same name already exists in the game
        const existingPlayer = game.players.find(
            (player) => player.name === playerName
        );
        if (existingPlayer) {
            socket.emit("game_join_error", {
                error: "A player with the same name already exists in the game.",
            });
            return;
        }

        // Add the new player to the game object
        const player = {
            id: socket.id,
            name: playerName,
            score: 0,
            turns: 0,
            nextTurn: false,
            questions: [],
        };
        game.players.push(player);
        socket.join(gameId);
        io.to(gameId).emit("player_joined", { players: game.players });
        socket.emit("join-game-success", { gameId, player });

        if (game.players.length === game.numPlayers) {
            // Start the game
            game.started = true;

            // Emit a message to all connected clients that the game has started
            io.to(gameId).emit("game_started", { gameId });

            // Emit a message to all connected clients to update the game state
            io.to(gameId).emit("game_state_changed", {
                players: game.players.map((player) => (player ? player.name : null)),
                numPlayers: game.numPlayers,
                status: game.started ? "active" : "waiting",
                gameId: game.id,
            });
        } else {
            // Emit a message to all connected clients to update the game state
            io.to(gameId).emit("game_state_changed", {
                players: game.players.map((player) => (player ? player.name : null)),
                numPlayers: game.numPlayers,
                status: game.started ? "active" : "waiting",
                gameId: game.id,
            });
        }
    });
}

module.exports = {
    joinGame
}