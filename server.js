const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const cors = require("cors");
const {
  generateGameId,
  generateBoard,
  getQuestionDetails,
} = require("./helpers");
const { createNewGame, joinInAGame, gameStateChange, scoreChange, root } = require("./controllers");

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

// ROOT ROUTE 
app.get("/",root)

// Handler for creating a new game
app.post("/new-game", createNewGame);

// Handler for joining an existing game
app.post("/join-game/:gameId", joinInAGame);

// Handler for getting game state
app.get("/game/:gameId", gameStateChange);

// Handler for updating a player's score
app.post("/game/:gameId/score/:playerIndex/:selectedSquare",scoreChange);

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log("Server listening...");
});
