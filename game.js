// Game canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size with responsive design
function resizeCanvas() {
    canvas.width = 800;
    canvas.height = 600;
}

// Initialize canvas size
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game constants
const GRAVITY = 0.5;
const FRICTION = 0.8;
const PLATFORM_HEIGHT = 20;
const PLATFORM_WIDTH = 100;
const NOTE_SIZE = 30;
const noteLetters = 'CDEFGAB';

// Game state
const gameState = {
    level: 1,
    score: 0,
    isPaused: false,
    isGameOver: false,
    cameraOffset: 0,
    isRunning: false,
    platforms: [],
    notes: [],
    playerMoved: false,
    player: {
        x: 400,
        y: 500,
        width: 40,
        height: 40,
        velocityX: 0,
        velocityY: 0,
        speed: 5,
        jumpForce: -12,
        isJumping: false,
        hasMoved: false
    }
};

// Player properties
const player = {
    x: 50,
    y: 0,
    width: 30,
    height: 30,
    velocityX: 0,
    velocityY: 0,
    speed: 4,
    jumpForce: -10,
    isJumping: false
};

// Game elements
let platforms = [];
let notes = [];

// Audio system
let audioContext;
let jumpSound;
let collectSound;
let levelCompleteSound;
let backgroundMusic;

// Piano note frequencies for different octaves
const noteFrequencies = {
    'C': [261.63, 523.25, 1046.50],
    'D': [293.66, 587.33, 1174.66],
    'E': [329.63, 659.25, 1318.51],
    'F': [349.23, 698.46, 1396.91],
    'G': [392.00, 783.99, 1567.98],
    'A': [440.00, 880.00, 1760.00],
    'B': [493.88, 987.77, 1975.53]
};

// Initialize audio system
async function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        await audioContext.resume();
        
        // Load sound effects
        const [jumpData, collectData] = await Promise.all([
            fetch('assets/jump.mp3').then(r => r.arrayBuffer()),
            fetch('assets/collect.mp3').then(r => r.arrayBuffer())
        ]);
        
        [jumpSound, collectSound] = await Promise.all([
            audioContext.decodeAudioData(jumpData),
            audioContext.decodeAudioData(collectData)
        ]);
        
        // Create level complete sound
        levelCompleteSound = createLevelCompleteSound();
    } catch (error) {
        console.error('Error loading audio:', error);
    }
}

// Create level complete sound effect
function createLevelCompleteSound() {
    const duration = 1;
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
        const t = i / audioContext.sampleRate;
        data[i] = Math.sin(2 * Math.PI * 440 * t) * Math.exp(-3 * t);
    }
    
    return buffer;
}

// Create background music from collected notes
function createBackgroundMusic() {
    if (!audioContext) return;
    
    const noteDuration = 0.5;
    const collectedNotes = notes.filter(note => note.collected).map(note => note.letter);
    
    if (collectedNotes.length === 0) return;
    
    backgroundMusic = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    backgroundMusic.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    let time = audioContext.currentTime;
    collectedNotes.forEach((note, index) => {
        const octave = Math.min(Math.floor(gameState.level / 4), 2);
        const frequency = noteFrequencies[note][octave];
        
        backgroundMusic.frequency.setValueAtTime(frequency, time);
        gainNode.gain.setValueAtTime(0.1, time);
        gainNode.gain.linearRampToValueAtTime(0, time + noteDuration);
        
        time += noteDuration;
    });
    
    backgroundMusic.start();
    backgroundMusic.stop(time);
}

// Generate level
function generateLevel() {
    platforms = [];
    notes = [];
    gameState.cameraOffset = 0;
    
    const numPlatforms = 5 + gameState.level * 2;
    let lastX = 50;
    let lastY = canvas.height - 100;
    
    // Reset player position
    player.x = 50;
    player.y = lastY - player.height;
    player.velocityX = 0;
    player.velocityY = 0;
    player.isJumping = false;
    
    // Calculate max jump height
    const maxJumpHeight = Math.abs((player.jumpForce * player.jumpForce) / (2 * GRAVITY));
    
    for (let i = 0; i < numPlatforms; i++) {
        const platform = {
            x: lastX + Math.random() * 100 + 50,
            y: lastY - (Math.random() * (maxJumpHeight * 0.7) + 20),
            width: PLATFORM_WIDTH - (Math.random() * 20),
            height: PLATFORM_HEIGHT,
            isMoving: i > 0 && i % 3 === 0,
            moveRange: 100,
            initialX: 0
        };
        
        platform.initialX = platform.x;
        platforms.push(platform);
        
        if (Math.random() > 0.3) {
            notes.push({
                x: platform.x + platform.width / 2,
                y: platform.y - 40,
                collected: false,
                letter: noteLetters[Math.floor(Math.random() * noteLetters.length)]
            });
        }
        
        lastX = platform.x;
        lastY = platform.y;
    }
}

// Update camera position
function updateCamera() {
    const targetY = Math.max(0, player.y - canvas.height / 2);
    gameState.cameraOffset += (targetY - gameState.cameraOffset) * 0.1;
}

// Draw game elements
function draw() {
    ctx.save();
    ctx.translate(0, -gameState.cameraOffset);
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, gameState.cameraOffset, canvas.width, canvas.height);
    
    // Draw platforms
    platforms.forEach(platform => {
        const gradient = ctx.createLinearGradient(platform.x, platform.y, platform.x, platform.y + platform.height);
        gradient.addColorStop(0, '#4CAF50');
        gradient.addColorStop(1, '#357abd');
        ctx.fillStyle = gradient;
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    });
    
    // Draw notes
    notes.forEach(note => {
        if (!note.collected) {
            // Draw note sphere
            const gradient = ctx.createRadialGradient(
                note.x, note.y, 0,
                note.x, note.y, NOTE_SIZE/2
            );
            gradient.addColorStop(0, '#ffd700');
            gradient.addColorStop(1, '#ffa500');
            
            ctx.beginPath();
            ctx.arc(note.x, note.y, NOTE_SIZE/2, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
            
            // Draw note letter
            ctx.fillStyle = '#000';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(note.letter, note.x, note.y);
        }
    });
    
    // Draw player
    const playerGradient = ctx.createLinearGradient(player.x, player.y, player.x, player.y + player.height);
    playerGradient.addColorStop(0, '#4a90e2');
    playerGradient.addColorStop(1, '#357abd');
    ctx.fillStyle = playerGradient;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    
    ctx.restore();
}

// Update player position and handle collisions
function updatePlayer() {
    if (gameState.isPaused) return;
    
    if (gameState.playerMoved) {
        // Apply gravity and update position
        gameState.player.velocityY += GRAVITY;
        gameState.player.y += gameState.player.velocityY;
    }
    
    // Update moving platforms
    platforms.forEach(platform => {
        if (platform.isMoving) {
            platform.x = platform.initialX + Math.sin(Date.now() / 1000) * platform.moveRange;
        }
    });
    
    // Update horizontal position
    gameState.player.x += gameState.player.velocityX;
    
    // Apply friction
    gameState.player.velocityX *= FRICTION;
    
    // Platform collision
    platforms.forEach(platform => {
        if (gameState.player.y + gameState.player.height > platform.y &&
            gameState.player.y < platform.y + platform.height &&
            gameState.player.x + gameState.player.width > platform.x &&
            gameState.player.x < platform.x + platform.width) {
            
            if (gameState.player.velocityY > 0) {
                gameState.player.isJumping = false;
                gameState.player.velocityY = 0;
                gameState.player.y = platform.y - gameState.player.height;
            }
        }
    });
    
    // Note collection
    notes.forEach(note => {
        if (!note.collected &&
            gameState.player.x < note.x + NOTE_SIZE &&
            gameState.player.x + gameState.player.width > note.x &&
            gameState.player.y < note.y + NOTE_SIZE &&
            gameState.player.y + gameState.player.height > note.y) {
            
            note.collected = true;
            gameState.score++;
            document.getElementById('noteCount').textContent = gameState.score;
            
            // Add collection animation
            const noteElement = document.createElement('div');
            noteElement.className = 'collected-note';
            noteElement.style.left = `${note.x}px`;
            noteElement.style.top = `${note.y - gameState.cameraOffset}px`;
            document.querySelector('.game-container').appendChild(noteElement);
            
            setTimeout(() => noteElement.remove(), 500);
            playSound(collectSound);
            
            if (notes.every(n => n.collected)) {
                showLevelComplete();
            }
        }
    });
    
    // Boundary checking
    if (gameState.player.x < 0) gameState.player.x = 0;
    if (gameState.player.x + gameState.player.width > canvas.width) gameState.player.x = canvas.width - gameState.player.width;
    
    // Check for falling off screen
    if (gameState.player.y > canvas.height + gameState.cameraOffset) {
        generateLevel();
    }
}

// Play sound effect
function playSound(buffer) {
    if (!buffer || !audioContext) return;
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
}

// Show level complete screen
function showLevelComplete() {
    gameState.isPaused = true;
    playSound(levelCompleteSound);
    createBackgroundMusic();
    
    const modal = document.getElementById('levelComplete');
    modal.classList.remove('hidden');
    modal.querySelector('.modal-content').style.animation = 'levelComplete 0.5s ease-out forwards';
    
    // Create celebration particles
    const container = document.querySelector('.game-container');
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'celebration-particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 2 + 's';
        container.appendChild(particle);
        
        setTimeout(() => particle.remove(), 3000);
    }
}

// Game loop
function gameLoop() {
    if (!gameState.isRunning) return;

    updatePlayer();
    updateCamera();
    draw();
    
    // Continue game loop
    requestAnimationFrame(gameLoop);
}

// Event listeners
window.addEventListener('keydown', (e) => {
    if (!gameState.isRunning) return;
    
    switch(e.key) {
        case 'ArrowLeft':
            gameState.playerMoved = true;
            gameState.player.velocityX = -gameState.player.speed;
            break;
        case 'ArrowRight':
            gameState.playerMoved = true;
            gameState.player.velocityX = gameState.player.speed;
            break;
        case 'ArrowUp':
        case ' ':
            if (!gameState.player.isJumping) {
                gameState.playerMoved = true;
                gameState.player.velocityY = gameState.player.jumpForce;
                gameState.player.isJumping = true;
            }
            break;
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        gameState.player.velocityX = 0;
    }
});

// Mobile controls
document.getElementById('leftBtn').addEventListener('touchstart', () => {
    if (gameState.isRunning) {
        gameState.playerMoved = true;
        gameState.player.velocityX = -gameState.player.speed;
    }
});

document.getElementById('rightBtn').addEventListener('touchstart', () => {
    if (gameState.isRunning) {
        gameState.playerMoved = true;
        gameState.player.velocityX = gameState.player.speed;
    }
});

document.getElementById('jumpBtn').addEventListener('touchstart', () => {
    if (gameState.isRunning && !gameState.player.isJumping) {
        gameState.playerMoved = true;
        gameState.player.velocityY = gameState.player.jumpForce;
        gameState.player.isJumping = true;
    }
});

// Mobile control touch end events
document.getElementById('leftBtn').addEventListener('touchend', () => {
    if (!gameState.isPaused) gameState.player.velocityX = 0;
});

// Initialize player position
function initializePlayer() {
    gameState.player.x = canvas.width / 2 - gameState.player.width / 2;
    gameState.player.y = canvas.height - PLATFORM_HEIGHT - gameState.player.height;
    gameState.player.velocityX = 0;
    gameState.player.velocityY = 0;
    gameState.player.isJumping = false;
    gameState.playerMoved = false;
}

// Initialize game
function initGame() {
    gameState.isRunning = false;
    gameState.score = 0;
    gameState.notes = [];
    initializePlayer();
    updateScore();
}

// Update score display
function updateScore() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('noteCount').textContent = gameState.score;
    document.getElementById('level').textContent = gameState.level;
}

// Draw player
function drawPlayer() {
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(
        gameState.player.x,
        gameState.player.y,
        gameState.player.width,
        gameState.player.height
    );
}

// Clear canvas
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Start game
document.getElementById('startButton').addEventListener('click', () => {
    gameState.isRunning = true;
    document.getElementById('startButton').style.display = 'none';
    document.getElementById('restartButton').style.display = 'block';
    initGame();
    gameLoop();
});

// Restart game
document.getElementById('restartButton').addEventListener('click', () => {
    initGame();
    gameState.isRunning = true;
    gameLoop();
});

// Initialize game
initGame();