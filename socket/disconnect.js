const { games } = require("../db");

const disconnect = (socket,io) => {
    socket.on("disconnect", () => {

        // Loop through all the games
        for (const game of Object.values(games)) {
            const playerIndex = game.players.findIndex(
                (player) => player.id === socket.id
            );

            // Check if the disconnected player was in the game
            if (playerIndex >= 0) {
                // Remove the player from the game
                game.players.splice(playerIndex, 1);

                // Notify all connected clients that the player has left the game
                io.to(game.id).emit("player_left", { players: game.players });

                // Check if the game should be stopped
                if (game.players.length === 0) {
                    // Remove the game from the games object
                    delete games[game.id];


                    // Notify all connected clients that the game has ended
                    io.emit("game_ended", { gameId: game.id });
                } else if (game.started) {
                    // Update the game state and active player index
                    game.activePlayerIndex %= game.players.length;

                    io.to(game.id).emit("game_state_changed", {
                        players: game.players.map((player) =>
                            player ? player.name : null
                        ),
                        numPlayers: game.numPlayers,
                        status: game.started ? "active" : "waiting",
                        gameId: game.id,
                        activePlayerIndex: game.activePlayerIndex,
                    });
                } else {
                    // Notify all connected clients that the player has left the game
                    io.to(game.id).emit("game_state_changed", {
                        players: game.players.map((player) =>
                            player ? player.name : null
                        ),
                        numPlayers: game.numPlayers,
                        status: game.started ? "active" : "waiting",
                        gameId: game.id,
                    });
                }
                break;
            }
        }
    });
}

module.exports = {
    s
}