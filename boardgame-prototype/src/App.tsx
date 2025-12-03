import { useState, useEffect } from 'react';
import { GameEngine } from './core/GameEngine';
import './App.css';

function App() {
  const [gameState, setGameState] = useState<any>(null);
  const [playerNames, setPlayerNames] = useState<string[]>(['Player 1', 'Player 2']);
  const [gameStarted, setGameStarted] = useState(false);
  const [engine] = useState(new GameEngine());

  useEffect(() => {
    // Load saved game on startup
    const savedGame = engine.loadGame();
    if (savedGame) {
      setGameState(savedGame);
      setGameStarted(true);
    }
  }, [engine]);

  const startGame = () => {
    const newGameState = engine.initializeGame(playerNames);
    console.log('New game state:', newGameState);
    console.log('Player 1 hand:', newGameState.players[0]?.hand);
    setGameState(newGameState);
    setGameStarted(true);
  };

  const handleExpandAction = (cardId: string) => {
    if (!gameState) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) return;

    // Check if card can be played (color restriction)
    const canPlay = engine.canPlayCard(currentPlayer.id, cardId);
    if (!canPlay) {
      console.log('Cannot play this card - color restriction');
      return;
    }

    const action = {
      type: 'expand',
      playerId: currentPlayer.id,
      cardId
    };

    const newState = engine.processAction(action);
    setGameState(newState);
  };

  const handleArmyPlacement = (spotId: number) => {
    if (!gameState) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.armies > 0) {
      const newState = engine.placeArmy(currentPlayer.id, spotId);
      setGameState(newState);
    }
  };

  const handleConsolidateAction = () => {
    if (!gameState) return;

    const action = {
      type: 'consolidate',
      playerId: gameState.players[gameState.currentPlayerIndex]?.id
    };

    const newState = engine.processAction(action);
    setGameState(newState);
  };

  if (!gameStarted) {
    return (
      <div className="setup-screen">
        <h1>Board Game Prototype</h1>
        <div className="player-setup">
          {playerNames.map((name, index) => (
            <div key={index} className="player-input">
              <label>Player {index + 1}:</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  const newNames = [...playerNames];
                  newNames[index] = e.target.value;
                  setPlayerNames(newNames);
                }}
              />
            </div>
          ))}
        </div>
        <button onClick={startGame} className="start-button">
          Start Game
        </button>
      </div>
    );
  }

  const currentPlayer = gameState?.players[gameState?.currentPlayerIndex];

  return (
    <div className="game-container">
      <div className="game-header">
        <h1>Board Game Prototype</h1>
        <div className="game-info">
          <p>Current Player: {currentPlayer?.name}</p>
          <p>Phase: {gameState?.phase}</p>
          <p>Turn: {gameState?.currentPlayerIndex + 1}</p>
        </div>
      </div>

      <div className="game-board">
        <div className="map-section">
          <h2>Game Map</h2>
          <div className="map-grid">
            {gameState?.map?.map((spot: any) => {
              const canPlace = currentPlayer?.armies > 0 && engine.canPlaceArmy(currentPlayer.id, spot.id);
              return (
                <div
                  key={spot.id}
                  className={`map-spot ${spot.type} ${spot.occupyingPlayer ? 'occupied' : ''} ${canPlace ? 'placement-available' : ''}`}
                  onClick={() => {
                    if (canPlace) {
                      handleArmyPlacement(spot.id);
                    }
                  }}
                >
                  <div className="spot-id">{spot.id}</div>
                  {spot.armies > 0 && (
                    <div className="army-count">{spot.armies}</div>
                  )}
                  {spot.occupyingPlayer && (
                    <div className="player-marker">
                      {spot.occupyingPlayer}
                    </div>
                  )}
                  {canPlace && (
                    <div className="placement-hint">+</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="player-section">
          <h2>Your Hand</h2>
          <div className="hand-cards">
            {currentPlayer?.hand?.map((card: any) => (
              <div
                key={card.id}
                className="card"
                onClick={() => handleExpandAction(card.id)}
              >
                <div className="card-guild">{card.guild}</div>
                <div className="card-color" style={{ backgroundColor: card.color }}>
                  {card.color}
                </div>
                <div className="card-power">{card.power}</div>
                <div className="card-bonus">{card.bonus}</div>
              </div>
            ))}
          </div>

          <div className="player-resources">
            <h3>Resources</h3>
            <p>Gold: {currentPlayer?.resources?.gold}</p>
            <p>Knowledge: {currentPlayer?.resources?.knowledge}</p>
            <p>Victory Points: {currentPlayer?.resources?.victoryPoints}</p>
            <p>Armies: {currentPlayer?.armies}</p>
          </div>

          <div className="guild-piles">
            <h3>Guild Piles</h3>
            {currentPlayer && Object.entries(currentPlayer.guildPiles || {}).map(([guild, cards]: [string, any[]]) => (
              <div key={guild} className="guild-pile">
                <h4>{guild}</h4>
                <div className="guild-cards">
                  {cards.map(card => (
                    <div key={card.id} className="guild-card">
                      {card.color}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="game-actions">
        <button
          onClick={handleConsolidateAction}
          className="action-button"
          disabled={gameState?.phase !== 'playing'}
        >
          Consolidate
        </button>
      </div>
    </div>
  );
}

export default App;