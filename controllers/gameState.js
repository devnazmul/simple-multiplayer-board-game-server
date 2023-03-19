const gameStateChange = async (req, res) => {
    const { gameId } = req.params;
  
    // Find the game with the given ID
    const game = games[gameId];
    if (!game) {
      // If the game is not found, return a 404 error
      res.status(404).json({ error: "Game not found" });
    } else {
      // Determine the status of the game based on the number of players joined
      let status = "waiting";
      if (game.players.length === game.numPlayers) {
        status = "in progress";
        io.emit("game-started", { game });
      }
      let allTurnsTaken = true;
      for (let i = 0; i < game.players.length; i++) {
        if (game.players[i].turns < game.numTurns) {
          allTurnsTaken = false;
          break;
        }
      }
  
      if (allTurnsTaken) {
        let playersRanking = game.players.filter(
          (player) => !player.isEliminated
        );
        playersRanking.sort((a, b) => b.score - a.score);
        let winner = playersRanking[0].name;
  
        res.json({ winner: winner, playersRanking: playersRanking });
      }
  
      // Return the game state and status to the client
      else
        res.json({
          boardSize: game.board.length,
          board: game.board,
          players: game.players,
          status,
          numPlayers: game.numPlayers,
          playersJoined: game.players.length,
          numTurns: game.numTurns,
        });
    }
  }

  module.exports={
    gameStateChange
  }