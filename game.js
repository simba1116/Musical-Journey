// 获取画布和上下文
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 设置画布尺寸
function setCanvasSize() {
    const gameArea = document.getElementById('game-area');
    canvas.style.width = '800px';
    canvas.style.height = '600px';
    canvas.width = 800;
    canvas.height = 600;
}

// 游戏常量
const GRAVITY = 0.4;          
const PLAYER_SPEED = 6;       
const JUMP_FORCE = -10;       
const TOTAL_LEVELS = 3;       
const PLATFORM_SPACING = 70;   // 平台之间的垂直间距
const SCREEN_THRESHOLD = 300;  // 玩家达到这个高度时触发平台移动

// 加载音效
const jumpSound = new Audio('assets/jump.mp3');
const collectSound = new Audio('assets/collect.mp3');

// 游戏状态
const game = {
    isRunning: false,
    score: 0,
    currentLevel: 1,
    platforms: [],
    notes: [],
    totalNotes: 0,
    collectedNotes: 0,
    camera: {
        y: 0,
        targetY: 0
    },
    platformFallOffset: 0,     // 平台下落偏移量
    player: {
        x: 380,
        y: 530,
        width: 40,
        height: 40,
        velocityX: 0,
        velocityY: 0,
        isJumping: false
    }
};

// 生成随机平台宽度
function getRandomPlatformWidth(isImportant) {
    if (isImportant) {
        return Math.random() * 60 + 140; // 重要平台 140-200
    }
    return Math.random() * 40 + 100; // 普通平台 100-140
}

// 初始化游戏
function initGame() {
    // 设置画布尺寸
    setCanvasSize();
    
    // 重置相机
    game.camera.y = 0;
    game.camera.targetY = 0;
    
    // 重置玩家状态
    game.player.x = 380;
    game.player.y = 530;
    game.player.velocityX = 0;
    game.player.velocityY = 0;
    game.player.isJumping = false;
    
    // 重置音符计数
    game.collectedNotes = 0;
    game.totalNotes = 0;
    
    // 创建地面平台
    game.platforms = [{
        x: 0,
        y: 580,
        width: 800,
        height: 20,
        isMoving: false
    }];
    
    // 创建其他平台
    let lastX = 200;
    let lastY = 500;
    
    // 根据关卡增加平台数量和调整间距
    const platformCount = 6 + game.currentLevel * 2;
    let platforms = [];
    let lastWasMoving = false;
    
    for (let i = 0; i < platformCount; i++) {
        // 每三个平台中的第一个设为重要平台（更长）
        const isImportant = i % 3 === 0;
        const width = getRandomPlatformWidth(isImportant);
        
        // 调整平台水平位置，确保可以跳跃到达
        if (i > 0) {
            const minJumpDistance = 100;
            const maxJumpDistance = 180;
            const jumpDistance = Math.random() * (maxJumpDistance - minJumpDistance) + minJumpDistance;
            const newX = (lastX + jumpDistance) % (canvas.width - width);
            lastX = Math.max(100, Math.min(canvas.width - width - 100, newX));
        }

        const platform = {
            x: lastX,
            y: lastY - (i * 70),
            width: width,
            height: 20,
            isMoving: false,
            moveSpeed: 1.5,
            moveRange: 80,
            initialX: lastX
        };
        
        platforms.push(platform);
        
        // 移动平台生成逻辑
        if (i > 0 && i < platformCount - 1 && !lastWasMoving) {
            const gapWidth = 160; // 固定的间隙宽度
            const movingPlatformX = lastX + width + gapWidth;
            
            // 只在平台间有足够空间时添加移动平台
            if (movingPlatformX + 140 < canvas.width - 100 && Math.random() < 0.3) {
                const movingPlatform = {
                    x: movingPlatformX,
                    y: platform.y - 30,
                    width: 80,
                    height: 20,
                    isMoving: true,
                    moveSpeed: 1.5,
                    moveRange: 60,
                    initialX: movingPlatformX
                };
                
                platforms.push(movingPlatform);
                lastWasMoving = true;
            }
        } else {
            lastWasMoving = false;
        }
    }
    
    // 添加到游戏平台数组（包括地面平台）
    game.platforms = [
        {
            x: 0,
            y: 580,
            width: 800,
            height: 20,
            isMoving: false
        },
        ...platforms
    ];
    
    // 创建音符（只在固定平台上生成）
    game.notes = [];
    game.platforms.forEach((platform, index) => {
        if (index > 0 && !platform.isMoving && index % 2 === 0) {
            game.notes.push({
                x: platform.x + platform.width / 2,
                y: platform.y - 40,
                collected: false,
                rotation: 0
            });
            game.totalNotes++;
        }
    });
    
    // 更新UI显示
    updateUI();
    
    // 开始游戏循环
    if (!game.isRunning) {
        game.isRunning = true;
        gameLoop();
    }
}

// 更新UI显示
function updateUI() {
    document.getElementById('score').textContent = game.score;
    document.getElementById('noteCount').textContent = `${game.collectedNotes}/${game.totalNotes}`;
    document.getElementById('level').textContent = `${game.currentLevel}/${TOTAL_LEVELS}`;
}

// 更新游戏状态
function updateGame() {
    if (!game.isRunning) return;
    
    // 更新玩家位置
    game.player.velocityY += GRAVITY;
    game.player.x += game.player.velocityX;
    game.player.y += game.player.velocityY;

    // 检查玩家是否达到触发高度
    if (game.player.y < SCREEN_THRESHOLD) {
        // 计算需要移动的距离
        const moveDistance = SCREEN_THRESHOLD - game.player.y;
        
        // 移动玩家回到阈值位置
        game.player.y = SCREEN_THRESHOLD;
        
        // 移动所有平台和音符向下
        game.platforms.forEach(platform => {
            platform.y += moveDistance;
            
            // 如果平台移出屏幕底部，将其移动到顶部
            if (platform.y > canvas.height + 50) {
                // 找到最高的平台
                const highestY = Math.min(...game.platforms.map(p => p.y));
                platform.y = highestY - PLATFORM_SPACING;
                
                // 重新随机生成平台的水平位置
                const width = getRandomPlatformWidth(true);
                platform.width = width;
                platform.x = Math.random() * (canvas.width - width);
                
                // 如果是移动平台，重置其初始位置
                if (platform.isMoving) {
                    platform.initialX = platform.x;
                }
            }
        });
        
        // 移动音符
        game.notes.forEach(note => {
            note.y += moveDistance;
            
            // 如果音符移出屏幕底部，将其移动到对应平台的上方
            if (note.y > canvas.height + 50) {
                // 找到对应的平台
                const platform = game.platforms.find(p => 
                    Math.abs(note.x - (p.x + p.width/2)) < 10 &&
                    !p.isMoving
                );
                
                if (platform) {
                    note.y = platform.y - 40;
                    note.collected = false;
                }
            }
        });
    }
    
    // 更新移动平台位置
    game.platforms.forEach(platform => {
        if (platform.isMoving) {
            platform.x = platform.initialX + Math.sin(Date.now() / 1000) * platform.moveRange;
        }
    });
    
    // 检测平台碰撞
    let onPlatform = false;
    game.platforms.forEach(platform => {
        const platformY = platform.y + game.platformFallOffset; // 应用下落偏移
        
        if (game.player.y + game.player.height > platformY &&
            game.player.y < platformY + platform.height &&
            game.player.x + game.player.width > platform.x &&
            game.player.x < platform.x + platform.width) {
            
            if (game.player.velocityY > 0) {
                game.player.isJumping = false;
                game.player.velocityY = 0;
                game.player.y = platformY - game.player.height;
                onPlatform = true;
                
                if (platform.isMoving) {
                    const platformDeltaX = Math.cos(Date.now() / 1000) * platform.moveSpeed;
                    game.player.x += platformDeltaX;
                }
            }
        }
    });
    
    if (!onPlatform) {
        game.player.isJumping = true;
    }
    
    // 检测音符收集
    game.notes.forEach(note => {
        if (!note.collected &&
            game.player.x < note.x + 25 &&        // 增大碰撞检测范围
            game.player.x + game.player.width > note.x - 25 &&
            game.player.y < note.y + 25 &&
            game.player.y + game.player.height > note.y - 25) {
            
            note.collected = true;
            game.collectedNotes++;
            game.score += 10;
            collectSound.currentTime = 0; // 重置音效播放位置
            collectSound.play();          // 播放收集音效
            updateUI();
            
            // 检查是否收集完所有音符
            if (game.notes.every(n => n.collected)) {
                if (game.currentLevel < TOTAL_LEVELS) {
                    // 进入下一关
                    game.currentLevel++;
                    alert('恭喜通过第' + (game.currentLevel-1) + '关！');
                    initGame();
                } else {
                    // 通关游戏
                    alert('恭喜通关所有关卡！');
                    game.currentLevel = 1;
                    initGame();
                }
            }
        }
    });
    
    // 边界检查
    if (game.player.x < 0) {
        game.player.x = 0;
        game.player.velocityX = 0;
    }
    if (game.player.x + game.player.width > canvas.width) {
        game.player.x = canvas.width - game.player.width;
        game.player.velocityX = 0;
    }
    
    // 掉落检测
    if (game.player.y > canvas.height + game.camera.y) {
        initGame();
    }
}

// 绘制立体音符
function drawNote(x, y) {
    // 外圈光晕
    const gradient = ctx.createRadialGradient(x, y, 5, x, y, 20);
    gradient.addColorStop(0, '#FFD700');
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
    
    // 主体
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();
    
    // 高光
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(x - 5, y - 5, 5, 0, Math.PI * 2);
    ctx.fill();
}

// 绘制函数
function draw() {
    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 保存当前上下文
    ctx.save();
    
    // 应用相机偏移
    ctx.translate(0, -game.camera.y);
    
    // 绘制背景
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, game.camera.y, canvas.width, canvas.height);
    
    // 绘制平台
    game.platforms.forEach(platform => {
        // 计算平台实际位置（包含下落偏移）
        const platformY = platform.y + game.platformFallOffset;
        
        // 平台渐变
        const gradient = ctx.createLinearGradient(
            platform.x, platformY,
            platform.x, platformY + platform.height
        );
        gradient.addColorStop(0, '#4CAF50');
        gradient.addColorStop(1, '#388E3C');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(platform.x, platformY, platform.width, platform.height);
        
        // 平台顶部高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(platform.x, platformY, platform.width, 2);
    });
    
    // 绘制音符（也需要应用下落偏移）
    game.notes.forEach(note => {
        if (!note.collected) {
            drawNote(note.x, note.y + game.platformFallOffset);
        }
    });
    
    // 绘制玩家
    const playerGradient = ctx.createLinearGradient(
        game.player.x, game.player.y,
        game.player.x, game.player.y + game.player.height
    );
    playerGradient.addColorStop(0, '#4a90e2');
    playerGradient.addColorStop(1, '#357abd');
    
    ctx.fillStyle = playerGradient;
    ctx.fillRect(
        game.player.x,
        game.player.y,
        game.player.width,
        game.player.height
    );
    
    // 恢复上下文
    ctx.restore();
}

// 游戏循环
function gameLoop() {
    if (game.isRunning) {
        updateGame();
        draw();
        requestAnimationFrame(gameLoop);
    }
}

// 键盘控制
window.addEventListener('keydown', (e) => {
    if (!game.isRunning) return;
    
    switch(e.key) {
        case 'ArrowLeft':
            game.player.velocityX = -PLAYER_SPEED;
            break;
        case 'ArrowRight':
            game.player.velocityX = PLAYER_SPEED;
            break;
        case 'ArrowUp':
        case ' ':
            if (!game.player.isJumping) {
                game.player.velocityY = JUMP_FORCE;
                game.player.isJumping = true;
                jumpSound.currentTime = 0; // 重置音效播放位置
                jumpSound.play();          // 播放跳跃音效
            }
            break;
    }
});

// 键盘松开事件
window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        game.player.velocityX = 0;
    }
});

// 开始游戏按钮点击事件
document.getElementById('startButton').addEventListener('click', () => {
    document.getElementById('startButton').style.display = 'none';
    document.getElementById('restartButton').style.display = 'block';
    initGame();
    gameLoop();
});

// 重新开始按钮点击事件
document.getElementById('restartButton').addEventListener('click', () => {
    initGame();
});

// 页面加载完成后初始化游戏
window.addEventListener('load', () => {
    draw(); // 先绘制初始画面
});