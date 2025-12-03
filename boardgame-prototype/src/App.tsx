import { useState, useEffect } from 'react';
import { GameEngine } from './core/GameEngine';
import './App.css';

function App() {
  const [gameState, setGameState] = useState<any>(null);
  const [playerNames, setPlayerNames] = useState<string[]>(['Player 1', 'Player 2']);
  const [gameStarted, setGameStarted] = useState(false);
  const [engine] = useState(new GameEngine());
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [conditionalPowerPrompt, setConditionalPowerPrompt] = useState<{
    power: string;
    onYes: () => void;
    onNo: () => void;
  } | null>(null);

  const [choicePowerPrompt, setChoicePowerPrompt] = useState<{
    power: string;
    choices: string[];
    onChoice: (choice: string) => void;
  } | null>(null);

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

    // Initialize market with 5 cards from common deck
    const stateWithMarket = engine.initializeMarket();

    setGameState(stateWithMarket);
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
      type: 'expand' as const,
      playerId: currentPlayer.id,
      cardId
    };

    const newState = engine.processAction(action);
    setGameState(newState);

    // Debug: Log state before clearing prompts
    console.log('DEBUG: Before clearing prompts - pendingConditionalPowers:', newState.pendingConditionalPowers);
    console.log('DEBUG: Before clearing prompts - pendingChoicePowers:', newState.pendingChoicePowers);

    // Clear any existing prompts when playing a new card (treat as "no" to any existing prompts)
    setConditionalPowerPrompt(null);
    setChoicePowerPrompt(null);

    // Debug: Log state after clearing prompts
    console.log('DEBUG: After clearing prompts - pendingConditionalPowers:', newState.pendingConditionalPowers);
    console.log('DEBUG: After clearing prompts - pendingChoicePowers:', newState.pendingChoicePowers);

    // Check if there are choice powers to handle first (priority over conditional)
    if (newState.pendingChoicePowers && newState.pendingChoicePowers.length > 0) {
      const firstChoicePower = newState.pendingChoicePowers[0];
      console.log('DEBUG: Showing choice power prompt:', firstChoicePower.fullText);
      setChoicePowerPrompt({
        power: firstChoicePower.fullText,
        choices: firstChoicePower.choices,
        onChoice: (choice: string) => handleChoicePowerResponse(choice, firstChoicePower, newState)
      });
    }
    // Check if there are conditional powers to handle
    else if (newState.pendingConditionalPowers && newState.pendingConditionalPowers.length > 0) {
      const firstConditionalPower = newState.pendingConditionalPowers[0];
      console.log('DEBUG: Showing conditional power prompt:', firstConditionalPower.fullText);
      setConditionalPowerPrompt({
        power: firstConditionalPower.fullText,
        onYes: () => handleConditionalPowerResponse(true, firstConditionalPower, newState),
        onNo: () => handleConditionalPowerResponse(false, firstConditionalPower, newState)
      });
    } else {
      console.log('DEBUG: No prompts to show');
    }
  };

  const handleChoicePowerResponse = (choice: string, power: any, currentState: any) => {
    // Execute the chosen power
    const currentPlayer = currentState.players[currentState.currentPlayerIndex];
    engine.executeChoicePower(currentPlayer, choice);

    // Remove the choice power from the queue
    const updatedState = {...currentState};
    updatedState.pendingChoicePowers = updatedState.pendingChoicePowers.filter(
      (p: any) => p.fullText !== power.fullText
    );

    setGameState(updatedState);
    setChoicePowerPrompt(null);

    // Check if there are more choice powers to handle
    if (updatedState.pendingChoicePowers && updatedState.pendingChoicePowers.length > 0) {
      const nextChoicePower = updatedState.pendingChoicePowers[0];
      setChoicePowerPrompt({
        power: nextChoicePower.fullText,
        choices: nextChoicePower.choices,
        onChoice: (nextChoice: string) => handleChoicePowerResponse(nextChoice, nextChoicePower, updatedState)
      });
    }
    // Check if there are conditional powers to handle after choices
    else if (updatedState.pendingConditionalPowers && updatedState.pendingConditionalPowers.length > 0) {
      const nextConditionalPower = updatedState.pendingConditionalPowers[0];
      setConditionalPowerPrompt({
        power: nextConditionalPower.fullText,
        onYes: () => handleConditionalPowerResponse(true, nextConditionalPower, updatedState),
        onNo: () => handleConditionalPowerResponse(false, nextConditionalPower, updatedState)
      });
    }
  };

  const handleConditionalPowerResponse = (accept: boolean, power: any, currentState: any) => {
    if (!accept) {
      // Remove the conditional power from the queue
      const updatedState = {...currentState};
      updatedState.pendingConditionalPowers = updatedState.pendingConditionalPowers.filter(
        (p: any) => p.fullText !== power.fullText
      );
      setGameState(updatedState);
      setConditionalPowerPrompt(null);
      return;
    }

    const currentPlayer = currentState.players[currentState.currentPlayerIndex];
    const normalizedLeft = engine.normalizeText(power.left);

    // Check if this conditional power requires discard
    if (normalizedLeft.includes('discard') && normalizedLeft.includes('card')) {
      // Execute the conditional power to set discard requirement
      engine.executeConditionalPower(currentPlayer, power.left, power.right);

      // Don't remove the conditional power from the queue yet
      // Keep it in the queue so we can process the right part after discard is complete
      setGameState(currentState);
      setConditionalPowerPrompt(null);

      // Don't execute the right part yet - wait for discard to complete
      // The discard requirement is now set in player.resources.discardCards
      return;
    }

    // Check if this conditional power has nested choices (right part contains "or")
    if (power.nestedChoices && power.nestedChoices.length > 0) {
      console.log('DEBUG: Conditional power has nested choices:', power.nestedChoices);

      // Show choice prompt for the nested choices
      setConditionalPowerPrompt(null);
      setChoicePowerPrompt({
        power: `What do you want? (from: ${power.fullText})`,
        choices: power.nestedChoices,
        onChoice: (choice: string) => {
          console.log('DEBUG: Nested choice selected:', choice);

          // Execute the conditional power with the specific choice
          engine.executeConditionalPower(currentPlayer, power.left, choice);

          // Remove the conditional power from the queue
          const updatedState = {...currentState};
          updatedState.pendingConditionalPowers = updatedState.pendingConditionalPowers.filter(
            (p: any) => p.fullText !== power.fullText
          );

          setGameState(updatedState);
          setChoicePowerPrompt(null); // Close the choice prompt after selection

          // Check if there are more conditional powers to handle
          if (updatedState.pendingConditionalPowers && updatedState.pendingConditionalPowers.length > 0) {
            const nextConditionalPower = updatedState.pendingConditionalPowers[0];
            console.log('DEBUG: Showing next conditional power prompt:', nextConditionalPower.fullText);
            setConditionalPowerPrompt({
              power: nextConditionalPower.fullText,
              onYes: () => handleConditionalPowerResponse(true, nextConditionalPower, updatedState),
              onNo: () => handleConditionalPowerResponse(false, nextConditionalPower, updatedState)
            });
          }
        }
      });
      return;
    }

    // Execute the conditional power (no nested choices, no discard requirement)
    engine.executeConditionalPower(currentPlayer, power.left, power.right);

    // Remove the conditional power from the queue
    const updatedState = {...currentState};
    updatedState.pendingConditionalPowers = updatedState.pendingConditionalPowers.filter(
      (p: any) => p.fullText !== power.fullText
    );

    setGameState(updatedState);
    setConditionalPowerPrompt(null);

    // Check if there are more conditional powers to handle
    if (updatedState.pendingConditionalPowers && updatedState.pendingConditionalPowers.length > 0) {
      const nextConditionalPower = updatedState.pendingConditionalPowers[0];
      setConditionalPowerPrompt({
        power: nextConditionalPower.fullText,
        onYes: () => handleConditionalPowerResponse(true, nextConditionalPower, updatedState),
        onNo: () => handleConditionalPowerResponse(false, nextConditionalPower, updatedState)
      });
    }
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
      type: 'consolidate' as const,
      playerId: gameState.players[gameState.currentPlayerIndex]?.id
    };

    const newState = engine.processAction(action);
    setGameState(newState);
  };

  const handleEndTurnAction = () => {
    if (!gameState) return;

    const action = {
      type: 'endTurn' as const,
      playerId: gameState.players[gameState.currentPlayerIndex]?.id
    };

    const newState = engine.processAction(action);
    setGameState(newState);
  };

  const handleDrawAction = () => {
    if (!gameState) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.resources.drawCards && currentPlayer.resources.drawCards > 0) {
      const newState = engine.drawCard(currentPlayer.id);
      setGameState(newState);
    }
  };

  const handleTakeAction = (cardId: string) => {
    if (!gameState) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.resources.takeCards && currentPlayer.resources.takeCards > 0) {
      const newState = engine.takeCardFromMarket(currentPlayer.id, cardId);
      setGameState(newState);
    }
  };

  const handleDiscardAction = (cardId: string) => {
    if (!gameState) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.resources.discardCards && currentPlayer.resources.discardCards > 0) {
      console.log('DEBUG: Starting discard action');
      console.log('DEBUG: Current discard requirement:', currentPlayer.resources.discardCards);
      console.log('DEBUG: Pending conditional powers:', gameState.pendingConditionalPowers);

      const newState = engine.discardCard(currentPlayer.id, cardId);
      console.log('DEBUG: After discard - new state:', newState);

      setGameState(newState);

      // Check if discard requirement is now fulfilled and execute any pending conditional benefits
      const updatedPlayer = newState.players[newState.currentPlayerIndex];
      console.log('DEBUG: Updated player discardCards:', updatedPlayer.resources.discardCards);

      if (updatedPlayer.resources.discardCards === 0) {
        console.log('DEBUG: Discard requirement fulfilled, checking for conditional benefits');

        // Use the existing GameEngine's conditional power execution system
        if (gameState.pendingConditionalPowers && gameState.pendingConditionalPowers.length > 0) {
          const conditionalPower = gameState.pendingConditionalPowers[0];
          console.log('DEBUG: Found conditional power:', conditionalPower.fullText);

          // Check if this is a discard->benefit conditional power (case-insensitive)
          const normalizedPowerText = conditionalPower.fullText.toLowerCase();
          if (normalizedPowerText.includes('discard') && (conditionalPower.fullText.includes('->') || conditionalPower.fullText.includes('→'))) {
            console.log('DEBUG: This is a discard->benefit conditional power');

            // Check if the right part contains "or" choices that need player selection (case-insensitive)
            if (conditionalPower.right.toLowerCase().includes(' or ')) {
              console.log('DEBUG: Right part contains choices, showing choice prompt');

              // Show choice prompt for the player to select which benefit they want
              setChoicePowerPrompt({
                power: `Choose your benefit: ${conditionalPower.right}`,
                choices: conditionalPower.right.split(' or ').map((choice: string) => choice.trim()),
                onChoice: (choice: string) => {
                  console.log('DEBUG: Player chose benefit:', choice);

                  // Execute only the chosen benefit using the new GameEngine method
                  engine.executeConditionalPowerBenefitOnly(updatedPlayer, choice);

                  // Remove the conditional power from the queue
                  const finalState = {...newState};
                  finalState.pendingConditionalPowers = (finalState.pendingConditionalPowers || []).filter(
                    (p: any) => p.fullText !== conditionalPower.fullText
                  );
                  console.log('DEBUG: Final state after removing conditional power:', finalState);
                  setGameState(finalState);
                  setChoicePowerPrompt(null);
                }
              });
            } else {
              // Execute only the right part (benefit) using the new GameEngine method
              engine.executeConditionalPowerBenefitOnly(updatedPlayer, conditionalPower.right);

              // Remove the conditional power from the queue
              const finalState = {...newState};
              finalState.pendingConditionalPowers = (finalState.pendingConditionalPowers || []).filter(
                (p: any) => p.fullText !== conditionalPower.fullText
              );
              console.log('DEBUG: Final state after removing conditional power:', finalState);
              setGameState(finalState);
            }
          } else {
            console.log('DEBUG: Conditional power does not match discard->benefit pattern');
          }
        } else {
          console.log('DEBUG: No pending conditional powers found');
        }
      } else {
        console.log('DEBUG: Discard requirement not yet fulfilled, remaining:', updatedPlayer.resources.discardCards);
      }
    }
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

        {/* Market Section for Take functionality */}
        {(gameState?.market && gameState.market.length > 0) && (
          <div className="market-section">
            <h2>Market</h2>
            <div className="market-cards">
              {gameState.market.map((card: any) => (
                <div key={card.id} className="market-card">
                  <div className="card-guild">{card.guild}</div>
                  <div className="card-color" style={{ backgroundColor: card.color }}>
                    {card.color}
                  </div>
                  <div className="card-powers">
                    <div>1: {card.power1}</div>
                    <div>2-3: {card.power23}</div>
                    <div>4-5: {card.power45}</div>
                    <div>Bonus: {card.bonus}</div>
                  </div>
                  {currentPlayer?.resources?.takeCards && currentPlayer.resources.takeCards > 0 && (
                    <button
                      onClick={() => handleTakeAction(card.id)}
                      className="take-button"
                    >
                      +
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="player-section">
          <h2>Your Hand</h2>
          <div className="hand-cards">
            {currentPlayer?.hand?.map((card: any) => (
              <div
                key={card.id}
                className="card"
                onClick={() => {
                  if (currentPlayer.resources.discardCards && currentPlayer.resources.discardCards > 0) {
                    handleDiscardAction(card.id);
                  } else {
                    handleExpandAction(card.id);
                  }
                }}
              >
                <div className="card-guild">{card.guild}</div>
                <div className="card-color" style={{ backgroundColor: card.color }}>
                  {card.color}
                </div>
                <div className="card-powers">
                  <div>1: {card.power1}</div>
                  <div>2-3: {card.power23}</div>
                  <div>4-5: {card.power45}</div>
                  <div>Bonus: {card.bonus}</div>
                </div>
                {currentPlayer?.resources?.discardCards && currentPlayer.resources.discardCards > 0 && (
                  <div className="discard-overlay">Discard</div>
                )}
              </div>
            ))}
          </div>

          {choicePowerPrompt && (
            <div className="choice-power-prompt">
              <p>What is your choice: "{choicePowerPrompt.power}"?</p>
              <div className="choice-power-buttons">
                {choicePowerPrompt.choices.map((choice, index) => (
                  <button
                    key={index}
                    onClick={() => choicePowerPrompt.onChoice(choice)}
                    className="action-button"
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </div>
          )}

          {conditionalPowerPrompt && (
            <div className="conditional-power-prompt">
              <p>Do you want to use the conditional power: "{conditionalPowerPrompt.power}"?</p>
              <div className="conditional-power-buttons">
                <button onClick={conditionalPowerPrompt.onYes} className="action-button">Yes</button>
                <button onClick={conditionalPowerPrompt.onNo} className="action-button">No</button>
              </div>
            </div>
          )}

          <div className="player-resources">
            <h3>Resources</h3>
            <p>Gold: {currentPlayer?.resources?.gold}</p>
            <p>Knowledge: {currentPlayer?.resources?.knowledge}</p>
            <p>Victory Points: {currentPlayer?.resources?.victoryPoints}</p>
            <p>Armies: {currentPlayer?.armies}</p>
            <p className="draw-resource">
              {(() => {
                const drawValue = currentPlayer?.resources?.drawCards ?? 0;
                console.log('DEBUG: Draw resource value:', drawValue, 'type:', typeof drawValue);
                return (
                  <>
                    Draw card: {drawValue}
                    {currentPlayer?.resources?.drawCards && currentPlayer.resources.drawCards > 0 && (
                      <button onClick={handleDrawAction} className="draw-button">Draw</button>
                    )}
                  </>
                );
              })()}
            </p>
            <p>Take card: {currentPlayer?.resources?.takeCards ?? 0}</p>
            <p>Discard card: {currentPlayer?.resources?.discardCards ?? 0}</p>
            <p>Exile card: {currentPlayer?.resources?.exileCards ?? 0}</p>
            <p>Bury card: {currentPlayer?.resources?.buryCards ?? 0}</p>
            <p>Fight: {currentPlayer?.resources?.fight ?? 0}</p>
            <p>Outpost: {currentPlayer?.resources?.outpost ?? 0}</p>
            <p>Revive: {currentPlayer?.resources?.revive ?? 0}</p>
          </div>

          <div className="guild-piles">
            <h3>Guild Piles</h3>
            {currentPlayer && Object.entries(currentPlayer.guildPiles || {}).map(([guild, cards]: [string, any]) => (
              <div key={guild} className="guild-pile">
                <h4>{guild}</h4>
                <div className="guild-cards">
                  {(cards as any[]).map((card: any, index: number) => (
                    <div
                      key={card.id}
                      className={`guild-card ${guild} ${card.color}`}
                      style={{
                        transform: `translateY(${index * -25}%)`,
                        zIndex: cards.length - index,
                        position: 'absolute',
                        fontSize: '6px',
                        cursor: 'pointer'
                      }}
                      onClick={() => setSelectedCard(card)}
                    >
                      <div className="guild-card-content" style={{ fontSize: '6px' }}>
                        <div className="guild-card-guild" style={{ fontSize: '6px' }}>{card.guild}</div>
                        <div className="guild-card-color" style={{ backgroundColor: card.color, fontSize: '5px' }}>
                          {card.color}
                        </div>
                        <div className="guild-card-powers" style={{ fontSize: '5px', lineHeight: '1.0', margin: '0', padding: '0' }}>
                          <div style={{ fontSize: '5px', margin: '0', padding: '0', lineHeight: '1.0' }}>1: {card.power1}</div>
                          <div style={{ fontSize: '5px', margin: '0', padding: '0', lineHeight: '1.0' }}>2-3: {card.power23}</div>
                          <div style={{ fontSize: '5px', margin: '0', padding: '0', lineHeight: '1.0' }}>4-5: {card.power45}</div>
                          <div style={{ fontSize: '5px', margin: '0', padding: '0', lineHeight: '1.0' }}>Bonus: {card.bonus}</div>
                        </div>
                      </div>
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
        <button
          onClick={handleEndTurnAction}
          className="action-button"
          disabled={gameState?.phase !== 'playing' && gameState?.phase !== 'setup'}
        >
          End Turn
        </button>
      </div>
    </div>

  ); {
    selectedCard && (
      <div className="card-popup-overlay" onClick={() => setSelectedCard(null)}>
        <div className="card-popup" onClick={(e) => e.stopPropagation()}>
          <button className="card-popup-close" onClick={() => setSelectedCard(null)}>X</button>
          <div className="card-popup-content">
            <div className="card-guild">{selectedCard.guild}</div>
            <div className="card-color" style={{ backgroundColor: selectedCard.color }}>
              {selectedCard.color}
            </div>
            <div className="card-powers">
              <div>1: {selectedCard.power1}</div>
              <div>2-3: {selectedCard.power23}</div>
              <div>4-5: {selectedCard.power45}</div>
              <div>Bonus: {selectedCard.bonus}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}


export default App;