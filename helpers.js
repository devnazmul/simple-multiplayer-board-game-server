// Helper function to generate a random game ID
function generateGameId() {
  return Math.random().toString(36).substr(2, 9);
}

function generateBoard(boardSize) {
  const board = [];
  for (let i = 0; i < boardSize; i++) {
    let operand1, operand2, operator, answer;

    // Generate random operands and operator
    operator = ["+", "-", "*", "/"][Math.floor(Math.random() * 4)];
    switch (operator) {
      case "+":
        operand1 = Math.floor(Math.random() * 100) + 1;
        operand2 = Math.floor(Math.random() * operand1) + 1;
        answer = operand1 + operand2;
        break;
      case "-":
        operand1 = Math.floor(Math.random() * 50) + 1;
        operand2 = Math.floor(Math.random() * operand1) + 1;
        answer = operand1 - operand2;
        break;
      case "*":
        operand1 = Math.floor(Math.random() * 12) + 1;
        operand2 = Math.floor(Math.random() * operand1) + 1;
        answer = operand1 * operand2;

        break;
      case "/":
        operand2 = Math.floor(Math.random() * 10) + 1;
        operand1 = operand2 * (Math.floor(Math.random() * 10) + 1);
        answer = operand1 / operand2;
        break;
      default:
        operand1 = 0;
        operand2 = 0;
        answer = 0;
    }

    board.push({
      operator,
      operand1,
      operand2,
      answer,
      counter: i,
      alreadyPlayed: false,
    });
  }
  return board;
}

function getQuestionDetails(boardIndex, board) {
  const question = board[boardIndex];
  const operand1 = question.operand1;
  const operand2 = question.operand2;
  let operator = question.operator;
  if (operator === "/") {
    operator = "÷"; // division sign
  } else if (operator === "*") {
    operator = "×"; // multiplication sign
  }
  return `${operand1} ${operator} ${operand2}`;
}

module.exports = { generateGameId, generateBoard, getQuestionDetails };
