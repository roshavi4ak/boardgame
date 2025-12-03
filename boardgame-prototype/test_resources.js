/**
 * Test script for Draw, Take, and Discard functionality
 * This script tests the core functionality without UI
 */

import { GameEngine } from './src/core/GameEngine.js';

function testResources() {
  console.log('Testing Draw, Take, and Discard functionality...');

  const engine = new GameEngine();
  const playerNames = ['Player 1', 'Player 2'];

  // Initialize game
  const gameState = engine.initializeGame(playerNames);
  console.log('Game initialized successfully');

  // Get current player
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  console.log(`Current player: ${currentPlayer.name}`);

  // Test Draw functionality
  console.log('\n=== Testing Draw Functionality ===');
  console.log(`Initial Draw resource: ${currentPlayer.resources.drawCards || 0}`);

  // Manually set drawCards to test
  currentPlayer.resources.drawCards = 3;
  console.log(`Set Draw resource to: ${currentPlayer.resources.drawCards}`);

  // Test drawing cards
  let newState = engine.drawCard(currentPlayer.id);
  console.log(`After first draw - Draw resource: ${newState.players[gameState.currentPlayerIndex].resources.drawCards}`);
  console.log(`Hand size: ${newState.players[gameState.currentPlayerIndex].hand.length}`);

  newState = engine.drawCard(currentPlayer.id);
  console.log(`After second draw - Draw resource: ${newState.players[gameState.currentPlayerIndex].resources.drawCards}`);
  console.log(`Hand size: ${newState.players[gameState.currentPlayerIndex].hand.length}`);

  // Test Take functionality
  console.log('\n=== Testing Take Functionality ===');
  console.log(`Initial Take resource: ${currentPlayer.resources.takeCards || 0}`);

  // Initialize market
  engine.initializeMarket();
  console.log(`Market size: ${engine.state.market?.length || 0}`);

  // Manually set takeCards to test
  currentPlayer.resources.takeCards = 2;
  console.log(`Set Take resource to: ${currentPlayer.resources.takeCards}`);

  // Test taking from market
  if (engine.state.market && engine.state.market.length > 0) {
    const marketCardId = engine.state.market[0].id;
    newState = engine.takeCardFromMarket(currentPlayer.id, marketCardId);
    console.log(`After taking from market - Take resource: ${newState.players[gameState.currentPlayerIndex].resources.takeCards}`);
    console.log(`Hand size: ${newState.players[gameState.currentPlayerIndex].hand.length}`);
    console.log(`Market size: ${newState.market?.length || 0}`);
  }

  // Test Discard functionality
  console.log('\n=== Testing Discard Functionality ===');
  console.log(`Initial Discard resource: ${currentPlayer.resources.discardCards || 0}`);
  console.log(`Hand size before discard: ${currentPlayer.hand.length}`);

  // Manually set discardCards to test
  currentPlayer.resources.discardCards = 1;
  console.log(`Set Discard resource to: ${currentPlayer.resources.discardCards}`);

  // Test discarding a card
  if (currentPlayer.hand.length > 0) {
    const handCardId = currentPlayer.hand[0].id;
    newState = engine.discardCard(currentPlayer.id, handCardId);
    console.log(`After discard - Discard resource: ${newState.players[gameState.currentPlayerIndex].resources.discardCards}`);
    console.log(`Hand size: ${newState.players[gameState.currentPlayerIndex].hand.length}`);
    console.log(`Discard pile size: ${newState.players[gameState.currentPlayerIndex].discard.length}`);
  }

  console.log('\n=== All tests completed ===');
}

testResources();