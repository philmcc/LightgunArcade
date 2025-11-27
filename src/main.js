import './style.css';
import { ArcadeSystem } from './arcade/core/ArcadeSystem.js';
import { Game as PointGunGame } from './games/point-gun/PointGunGame.js';
import { Game as NotDuckHuntGame } from './games/not-duck-hunt/NotDuckHuntGame.js';

const canvas = document.getElementById('game-canvas');
const uiLayer = document.getElementById('ui-layer');

// Initialize arcade system
const arcade = new ArcadeSystem(canvas, uiLayer);

// Register Games
arcade.registerGame(PointGunGame);
arcade.registerGame(NotDuckHuntGame);

// Show arcade menu
arcade.showArcadeMenu();

// Game loop
let lastTime = 0;
function gameLoop(currentTime) {
  const dt = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  arcade.update(dt);
  arcade.draw();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
