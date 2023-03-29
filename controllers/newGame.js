const newGame = async (req, res) => {
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
  }

  module.exports = {
    newGame
  }