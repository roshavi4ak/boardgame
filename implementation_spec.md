# Board Game Prototype Implementation Specification

## Card Deck Design

### Guild Structure
- **Military**: Focus on army actions and combat
- **Culture**: Focus on knowledge and civilization growth
- **Technology**: Focus on resource generation and efficiency
- **Royal**: Focus on victory points and special abilities
- **Building**: Focus on infrastructure and outposts

### Color Distribution
Each guild has 10 cards: 2 blue, 2 red, 2 green, 2 yellow, 2 purple

### Power Scaling System

#### Position 1 (Basic)
- Military: Army. Pay 1 Gold → Army
- Culture: Gain Knowledge. Pay 1 Knowledge → Draw 1
- Technology: Gain 1 Gold. Pay 1 Gold → Take 1
- Royal: Gain 1 VP. Exile 1 → Gain 1 VP
- Building: Build Outpost. Pay 1 Gold → Build Outpost

#### Position 2-3 (Enhanced)
- Military: Army. Army
- Culture: Gain Knowledge. Gain Knowledge
- Technology: Gain 1 Gold. Gain 1 Gold
- Royal: Gain 1 VP. Gain 1 VP
- Building: Build Outpost. Build Outpost

#### Position 4-5 (Advanced)
- Military: Army. Army. Discard 1 → Army
- Culture: Gain Knowledge. Gain Knowledge. Discard 1 → Gain Knowledge
- Technology: Gain 1 Gold. Gain 1 Gold. Discard 1 → Gain 2 Gold
- Royal: Gain 1 VP. Gain 1 VP. Exile 1 → Gain 2 VP
- Building: Build Outpost. Build Outpost. Discard 1 → Build 2 Outposts

## Map Layout Design

### Grid Structure
```
[01][02][03][04][05]
[06][07][08][09][10]
[11][12][13][14][15]
[16][17][18][19][20]
```

### Spot Types
- **Normal Spots**: 01-20 (basic army placement)
- **Outpost Spots**: 05, 10, 15, 20 (special building locations)
- **Starting Positions**: 01 (Player 1), 05 (Player 2)

### Adjacency Rules
- Horizontal and vertical adjacency only (no diagonals)
- Edge wrapping: No (grid boundaries are hard edges)

## Game State Structure

### Player Object
```typescript
interface Player {
  id: string;
  name: string;
  hand: Card[];
  deck: Card[];
  discard: Card[];
  exile: Card[];
  guildPiles: {
    military: Card[];
    culture: Card[];
    technology: Card[];
    royal: Card[];
    building: Card[];
  };
  resources: {
    gold: number;
    knowledge: number;
    victoryPoints: number;
  };
  armies: ArmyToken[];
  outposts: Outpost[];
}
```

### Map Spot Object
```typescript
interface MapSpot {
  id: string;
  position: number;
  type: 'normal' | 'outpost' | 'starting';
  occupyingPlayer: string | null;
  armyCount: number;
  hasOutpost: boolean;
}
```

## Implementation Roadmap

### Phase 1: Core Game Logic (Week 1)
1. **Card System Implementation**
   - Create card data structure
   - Implement power scaling logic
   - Generate 50 unique cards

2. **Map System Implementation**
   - Create 20-spot grid layout
   - Implement adjacency logic
   - Add outpost system

3. **Basic Game Engine**
   - Turn management
   - Action resolution
   - Resource tracking

### Phase 2: UI Development (Week 2)
1. **React Component Structure**
   - Card display components
   - Map visualization
   - Player dashboard

2. **Game State Management**
   - Redux store setup
   - Action creators
   - State reducers

### Phase 3: Testing & Refinement (Week 3)
1. **Unit Testing**
   - Card mechanics validation
   - Map logic testing
   - Turn management verification

2. **Integration Testing**
   - Full game flow testing
   - Multiplayer interaction testing
   - UI responsiveness testing

## Technical Implementation Details

### Card Generation Algorithm
```typescript
function generateDeck(): Card[] {
  const guilds = ['military', 'culture', 'technology', 'royal', 'building'];
  const colors = ['blue', 'red', 'green', 'yellow', 'purple'];
  const deck: Card[] = [];

  guilds.forEach(guild => {
    colors.forEach(color => {
      // Create 2 cards for each guild-color combination
      for (let i = 0; i < 2; i++) {
        deck.push({
          id: `${guild}-${color}-${i+1}`,
          guild: guild as GuildType,
          color: color as ColorType,
          position: 0, // Will be set during gameplay
          power: getPowerForPosition(guild, 1), // Default to position 1
          bonus: getBonusForGuild(guild)
        });
      }
    });
  });

  return shuffleDeck(deck);
}
```

### Map Adjacency Function
```typescript
function getAdjacentSpots(position: number): number[] {
  const gridSize = 5;
  const row = Math.floor((position - 1) / gridSize);
  const col = (position - 1) % gridSize;
  const adjacent: number[] = [];

  // Check up
  if (row > 0) adjacent.push(position - gridSize);
  // Check down
  if (row < 3) adjacent.push(position + gridSize);
  // Check left
  if (col > 0) adjacent.push(position - 1);
  // Check right
  if (col < gridSize - 1) adjacent.push(position + 1);

  return adjacent;
}
```

## Testing Plan

### Test Cases
1. **Card Mechanics**
   - Verify power scaling works correctly
   - Test color restrictions in guild piles
   - Validate bonus effects

2. **Map System**
   - Test army placement adjacency
   - Verify outpost building rules
   - Check starting position logic

3. **Game Flow**
   - Test turn sequence (Expand/Consolidate)
   - Verify resource management
   - Check game end conditions

### Performance Metrics
- **Load Time**: < 2 seconds for initial load
- **Turn Processing**: < 500ms per turn
- **Memory Usage**: < 100MB for 2-player game

## Deployment Strategy
1. **Development Environment**: Local testing with hot reload
2. **Staging Environment**: GitHub Pages for preview
3. **Production Environment**: Netlify or Vercel hosting

## Next Steps
1. Create card data JSON file
2. Implement map layout component
3. Build core game engine classes
4. Develop basic UI framework