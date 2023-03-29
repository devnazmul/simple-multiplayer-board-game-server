const { disconnect } = require("mongoose");
const { createGame } = require("./socket/create_game");
const { joinGame } = require("./socket/join_game");


module.exports = (io) => {
    io.on("connection", (socket) => {
        // CREATE A NEW GAME 
        createGame(socket)

        // JOIN GAME
        joinGame(socket,io)
        
        // IF SERVER DISCONNECTED 
        disconnect(socket,io)
    });
}