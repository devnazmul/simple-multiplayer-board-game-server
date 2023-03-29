const { games } = require("../db");
const { generateGameId, generateBoard } = require("../helpers");

const createGame = (socket) => {
    // Handler for creating a new game
    socket.on("create_game", ({ playerName, boardSize, numPlayers, numTurns }) => {
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
}
module.exports = {
    createGame,
}