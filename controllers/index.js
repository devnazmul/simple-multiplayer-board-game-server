const { root } = require('./test');
const { createNewGame } = require('./newGame');
const { joinInAGame } = require('./joinGame');
const { gameStateChange } = require('./gameState');
const { scoreChange } = require('./score');

module.exports = {
    createNewGame,
    joinInAGame,
    gameStateChange,
    scoreChange,
    root
}