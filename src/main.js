import './style.css';
import { ArcadeManager } from './arcade/ArcadeManager.js';
import { Game as PointGunGame } from './games/point-gun/PointGunGame.js';

const canvas = document.getElementById('game-canvas');
const uiLayer = document.getElementById('ui-layer');

// Initialize arcade
const arcade = new ArcadeManager(canvas, uiLayer);

// Register Point Gun game
arcade.registerGame({
  id: 'point-gun',
  name: 'Point Gun',
  description: 'Fast-paced target shooting',
  isAvailable: true,
  gameClass: PointGunGame
});

// Register placeholder games
arcade.registerGame({
  id: 'zombie-outbreak',
  name: 'Zombie Outbreak',
  description: 'Survive the undead horde',
  isAvailable: false,
  gameClass: null
});

arcade.registerGame({
  id: 'wild-west-duel',
  name: 'Wild West Duel',
  description: 'Showdown at high noon',
  isAvailable: false,
  gameClass: null
});

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
