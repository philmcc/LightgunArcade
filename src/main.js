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

// Wait for init to complete before showing menu
async function start() {
  // Show loading state
  uiLayer.innerHTML = '<div class="screen"><h1>LOADING...</h1></div>';
  
  // Wait for arcade to fully initialize (including auth)
  await arcade.init();
  
  // Now show arcade menu with correct auth state
  arcade.showArcadeMenu();
}

start();

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
