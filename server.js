const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const cors = require("cors");
const {
  generateGameId,
  generateBoard,
  getQuestionDetails,
} = require("./helpers");

app.use(cors());

// Initialize socket.io
const server = require("http").Server(app);
const io = require("socket.io")(server, {
  cors: {
    origin: ["https://simple-multiplayer-board-game-client.vercel.app"],
    methods: ["GET", "POST"],
  },
});

let nextGameId = 0; // Define nextGameId here

io.on("connection", (socket) => {

  // Handler for creating a new game
  socket.on(
    "create_game",
    ({ playerName, boardSize, numPlayers, numTurns }) => {

      // Set board size to 50 if boardSize is null or not a number
      const currentBoardSize =
        boardSize && Number(boardSize) ? Number(boardSize) : 50;

      // Validate numPlayers parameter
      if (numPlayers < 2) {
        socket.emit("game_creation_error", {
          error: "Number of players should be at least 2",
        });
        return;
      }

      // Validate boardSize parameter
      if (currentBoardSize < 50 || currentBoardSize > 200) {
        socket.emit("game_creation_error", {
          error: "Board size should be between 50 and 200",
        });
        return;
      }

      // Validate numTurns parameter
      if (numTurns < 5 || numTurns > 20) {
        socket.emit("game_creation_error", {
          error: "Number of turns should be between 5 and 20",
        });
        return;
      }

      // Generate a unique game ID
      const gameId = generateGameId();

      // Construct the game object
      const game = {
        id: gameId,
        board: generateBoard(currentBoardSize),
        players: [
          {
            id: socket.id,
            name: playerName,
            score: 0,
            turns: 0,
            nextTurn: true,
            questions: [],
          },
        ],
        numPlayers,
        numTurns,
        status: false,
        currentTurn: 1,
      };

      // Store the game object in the games object
      games[gameId] = game;

      // Join the socket to the room with the game ID
      socket.join(gameId);

      // Emit a game_created event to the client with the game ID
      socket.emit("game_created", { game });

      // Return success message and game details to the client
      const gameDetails = {
        playerName: playerName,
        boardSize: currentBoardSize,
        numPlayers: numPlayers,
        numTurns: numTurns,
        status: false,
        gameId: gameId,
      };
      socket.emit("game_creation_success", {
        success: true,
        message: "Game created successfully",
        gameDetails: gameDetails,
      });
    }
  );

  //New code
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

  // Handler for updating a player's score
  io.on("connection", (socket) => {
    socket.on(
      "updateScore",
      ({ gameId, playerIndex, selectedSquare, score }) => {
        // Find the game with the given ID
        const game = games[gameId];
        if (!game) {
          // If the game is not found, emit an error event to the client
          socket.emit("error", { message: "Game not found" });
        } else if (playerIndex < 0 || playerIndex >= game.players.length) {
          // If the player index is out of bounds, emit an error event to the client
          socket.emit("error", { message: "Invalid player index" });
        } else {
          // Update the player's score and increment their turns taken
          game.players[playerIndex].score += score;
          // Update the player's score
          game.players[playerIndex].turns++;
          game.players[playerIndex].nextTurn = false;

          // Notify all connected clients about the score change and the next player's turn
          const nextPlayerIndex = (playerIndex + 1) % game.players.length;
          game.players[nextPlayerIndex].nextTurn = true;
          // Update the game state and emit a 'completed' event to the client
          game.board[selectedSquare].alreadyPlayed = true;
          // Emit a 'scoreChange' event to all clients connected to the game room
          io.in(gameId).emit("scoreChange", {
            players: game.players,
            numPlayers: game.numPlayers,
            playersJoined: game.players.length,
            numTurns: game.numTurns,
            board: game.board,
            nextPlayer: nextPlayerIndex,
          });

          const gameState = {
            players: game.players,
            numPlayers: game.numPlayers,
            playersJoined: game.players.length,
            numTurns: game.numTurns,
            board: game.board,
          };
          socket.emit("completed", gameState);
        }
      }
    );
  });

  // Handle player disconnect
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

  socket.on("start_game", (gameId) => {
    const game = games[gameId];
    if (!game) {
      io.to(socket.id).emit("game_start_error", { error: "Game not found" });
    } else if (game.players.length < game.numPlayers) {
      io.to(socket.id).emit("game_start_error", { error: "Game is not full" });
    } else if (game.started) {
      io.to(socket.id).emit("game_start_error", {
        error: "Game has already started",
      });
    } else {
      game.started = true;
      io.to(gameId).emit("game_started", { players: game.players });
    }
  });

  socket.on("update_score", (gameId, playerIndex, score) => {
    const game = games[gameId];
    if (!game) {
      io.emit("score_update_error", { error: "Game not found" });
    } else if (
      playerIndex < 0 ||
      playerIndex >= game.players.length ||
      isNaN(score)
    ) {
      io.emit("score_update_error", { error: "Invalid input" });
    } else {
      game.players[playerIndex].score = score;
      io.to(gameId).emit("score_updated", { playerIndex, score });

    }
  });
});

// We will store all the game data in memory
const games = {};

app.use(bodyParser.json());

app.get("/",(req,res)=>{
  res.send('server is running....');
})

// Handler for creating a new game
app.post("/new-game", (req, res) => {
  const { playerName, boardSize, numPlayers, numTurns } = req.body;
  // Set board size to 50 if boardSize is null or not a number
  // const playersSize = numPlayers && Number(numPlayers) ? Number(numPlayers) : 2;
  const currentBoardSize =
    boardSize && Number(boardSize) ? Number(boardSize) : 50;

  // Validate numPlayers parameter
  if (numPlayers < 2) {
    res.status(400).json({ error: "Number of players should be at least 2" });
    return;
  }

  // Validate boardSize parameter
  if (currentBoardSize < 50 || currentBoardSize > 200) {
    res.status(400).json({ error: "Board size should be between 50 and 200" });
    return;
  }

  // Validate numTurns parameter
  if (numTurns < 5 || numTurns > 20) {
    res
      .status(400)
      .json({ error: "Number of turns should be between 5 and 20" });
    return;
  }

  // Generate a unique game ID
  const gameId = generateGameId();

  // Construct the game object
  const game = {
    id: gameId,
    board: generateBoard(currentBoardSize),
    players: [
      {
        id: 0,
        name: playerName,
        score: 0,
        turns: 0,
        nextTurn: true,
        questions: [],
      },
    ],
    numPlayers,
    numTurns,
    status: false,
    currentTurn: 1,
  };

  // Store the game object in the games object
  games[gameId] = game;

  // Return success message and game details to the client
  const gameDetails = {
    playerName: playerName,
    boardSize: currentBoardSize,
    numPlayers: numPlayers,
    numTurns: numTurns,
    status: false,
    gameId: gameId,
  };
  res.status(200).json({
    success: true,
    message: "Game created successfully",
    gameDetails: gameDetails,
  });
});

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

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log("Server listening...");
});
