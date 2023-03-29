const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const cors = require("cors");

// Initialize socket.io
const server = require("http").Server(app);
const io = require("socket.io")(server);
require('./socket.js')(io);

const {
  getQuestionDetails,
} = require("./helpers");
const { games } = require("./db.js");
const { newGame } = require("./controllers/newGame.js");

app.use(cors());

app.use(bodyParser.json());

app.get("/",(req,res)=>{
  res.send('server is running....');
})

// Handler for creating a new game
app.post("/new-game", newGame);

// Handler for joining an existing game
app.post("/join-game/:gameId", (req, res) => {
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
});

// Handler for getting game state
app.get("/game/:gameId", (req, res) => {
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
});

// Handler for updating a player's score
app.post("/game/:gameId/score/:playerIndex/:selectedSquare", (req, res) => {
  const { gameId, playerIndex, selectedSquare } = req.params;
  const game = games[gameId];
  const { score } = req.body;
  const { playerAnswer } = req.body;
  const { timeToAnswer } = req.body;
  const questionText = getQuestionDetails(selectedSquare, game.board);

  const isAnswerCorrect =
    parseInt(playerAnswer) === parseInt(game.board[selectedSquare].answer);

  // Find the game with the given ID

  if (!game) { // If the game is not found, return a 404 error

    res.status(404).json({ error: "Game not found" });

  } else if (playerIndex < 0 || playerIndex >= game.players.length) { // If the player index is out of bounds, return a 400 error

    res.status(400).json({ error: "Invalid player index" });

  } else if (game.players[playerIndex].turns >= game.numTurns) { // If the player has already taken the maximum number of turns, return a 400 error

    res.status(400).json({ error: "Maximum number of turns taken by the player" });

  } else { // Update the player's score and increment their turns taken

    let playerTurns = game.players[playerIndex].turns;

    game.players[playerIndex].questions.push({
      question: questionText,
      answer: playerAnswer,
      isCorrect: isAnswerCorrect,
      timeTaken: timeToAnswer,
    });

    game.players[playerIndex].score += score;

    // Update the player's score
    game.players[playerIndex].turns++;

    // Set the current player's nextTurn to false
    game.players[playerIndex].nextTurn = false;

    // Notify all connected clients about the score change and the next player's turn
    let nextPlayerIndex;

    if (playerIndex >= game.players.length - 1) {
      nextPlayerIndex = 0;
    } else {
      nextPlayerIndex = parseInt(playerIndex) + 1;
    }

    game.players[nextPlayerIndex].nextTurn = true;
    game.board[selectedSquare].alreadyPlayed = true;

    let allTurnsTaken = true;
    for (let i = 0; i < game.players.length; i++) {
      if (game.players[i].turns < game.numTurns) {
        allTurnsTaken = false;
        break;
      }
    }

    let responseData;

    if (allTurnsTaken) { // If the game is finished
      setTimeout(() => {
        const currentPlayerTurns = game.players[playerIndex].turns;

        if (currentPlayerTurns !== playerTurns) {
          playerTurns = currentPlayerTurns; // update playerTurns before emitting event
          io.in(gameId).emit("scoreChange", {
            players: game.players,
            numPlayers: game.numPlayers,
            playersJoined: game.players.length,
            numTurns: game.numTurns,
            board: game.board,
          });
        }
      }, 1000);

      let playersRanking = game.players.filter(
        (player) => !player.isEliminated
      );
      playersRanking.sort((a, b) => b.score - a.score);
      let winner = playersRanking[0].name;
      responseData = {
        winner: winner,
        playersRanking: playersRanking,
      };
      setTimeout(() => {
        io.in(gameId).emit("gamecompleted", {
          winner: winner,
          playersRanking: playersRanking,
        });
      }, 1000);
    } else { // Changing the player score
      setTimeout(() => {
        const currentPlayerTurns = game.players[playerIndex].turns;

        if (currentPlayerTurns !== playerTurns) {
          playerTurns = currentPlayerTurns; // update playerTurns before emitting event
          io.in(gameId).emit("scoreChange", {
            players: game.players,
            numPlayers: game.numPlayers,
            playersJoined: game.players.length,
            numTurns: game.numTurns,
            board: game.board,
          });

        }
      }, 1000);

      responseData = {
        players: game.players,
        numPlayers: game.numPlayers,
        playersJoined: game.players.length,
        numTurns: game.numTurns,
        board: game.board,
      };
    }

    res.json(responseData);

    // Check if the game is over (i.e., all players have reached their maximum number of turns)
    let gameOver = false;
    for (let i = 0; i < game.players.length; i++) {
      if (game.players[i].turns >= game.maxTurns) {
        gameOver = true;
      } else {
        gameOver = false;
        break;
      }
    }

    if (gameOver) {
      // Calculate and store each player's total score
      game.players.forEach((player) => {
        let totalScore = 0;
        player.answers.forEach((answer) => {
          totalScore += answer.score;
        });
        player.totalScore = totalScore;
      });

      // Notify all connected clients about the end of the game and return the players' scores
      io.in(gameId).emit("gameOver", { players: game.players });
      res.json({ players: game.players });

      // Remove the game from the server
      delete games[gameId];
    }
  }
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("Server listening...");
});
