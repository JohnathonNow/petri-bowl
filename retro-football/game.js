const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Fixed internal resolution for consistent 8-bit feel
const GAME_WIDTH = 320;
const GAME_HEIGHT = 480;

function resizeCanvas() {
    // Keep internal resolution constant, scale visually via CSS
    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Game States
const GameState = {
    MENU: 0,
    PRE_SNAP: 1,
    PLAYING: 2,
    PLAY_OVER: 3
};

let currentState = GameState.MENU;
let currentTeam = 'offense'; // 'offense' or 'defense'

// Input State
let input = {
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    tapped: false,
    lastTapTime: 0,
    doubleTapped: false
};

// Game Entities (stubs to be filled in next steps)
let players = [];
let ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, state: 'held', carrier: null };
let activePlayerIndex = 0;

// Coordinate mapping helper
function getCanvasPos(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (evt.clientX - rect.left) * scaleX,
        y: (evt.clientY - rect.top) * scaleY
    };
}

// Input handling
canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault(); // Prevent default touch actions
    const pos = getCanvasPos(e);
    input.active = true;
    input.startX = pos.x;
    input.startY = pos.y;
    input.currentX = pos.x;
    input.currentY = pos.y;

    // Check for double tap
    const now = Date.now();
    if (now - input.lastTapTime < 300) {
        input.doubleTapped = true;
    } else {
        input.doubleTapped = false;
    }
    input.lastTapTime = now;

    if (currentState === GameState.MENU) {
        // Start game alternating sides for simplicity, or just set to offense
        currentTeam = 'offense';
        setupPreSnap();
        currentState = GameState.PRE_SNAP;
    } else if (currentState === GameState.PLAY_OVER) {
        // Toggle possession
        currentTeam = currentTeam === 'offense' ? 'defense' : 'offense';
        setupPreSnap();
        currentState = GameState.PRE_SNAP;
    } else if (currentState === GameState.PRE_SNAP) {
        // Handled in specific mechanics step
        handlePreSnapInput(pos);
    } else if (currentState === GameState.PLAYING) {
        handlePlayingInputDown(pos);
    }
});

canvas.addEventListener('pointermove', (e) => {
    e.preventDefault();
    if (!input.active) return;
    const pos = getCanvasPos(e);
    input.currentX = pos.x;
    input.currentY = pos.y;
});

canvas.addEventListener('pointerup', (e) => {
    e.preventDefault();
    if (!input.active) return;
    const pos = getCanvasPos(e);

    // Determine if it was a tap or a drag
    const dx = pos.x - input.startX;
    const dy = pos.y - input.startY;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist < 10) {
        input.tapped = true;
    } else {
        if (currentState === GameState.PLAYING) {
            handlePlayingInputDragRelease(input.startX, input.startY, pos.x, pos.y);
        }
    }

    input.active = false;
});

// Stubs for game logic
function setupPreSnap() {
    players = [];
    if (currentTeam === 'offense') {
        // QB
        players.push({ id: 0, x: GAME_WIDTH/2, y: GAME_HEIGHT/2 + 20, role: 'qb', team: 'offense', targetX: null, targetY: null, diving: false });
        // RB
        players.push({ id: 1, x: GAME_WIDTH/2 + 30, y: GAME_HEIGHT/2 + 40, role: 'rb', team: 'offense', targetX: null, targetY: null, diving: false });
        // WR
        players.push({ id: 2, x: 40, y: GAME_HEIGHT/2 + 10, role: 'wr', team: 'offense', targetX: 40, targetY: 50, diving: false });

        // Defense CPU
        players.push({ id: 3, x: GAME_WIDTH/2, y: GAME_HEIGHT/2 - 40, role: 'dl', team: 'defense', targetX: GAME_WIDTH/2, targetY: GAME_HEIGHT/2, diving: false });

        activePlayerIndex = 0; // Control QB
        ball = { x: GAME_WIDTH/2, y: GAME_HEIGHT/2, z: 0, state: 'snapped', carrier: null };
    } else {
        // User plays defense
        // Safety
        players.push({ id: 0, x: GAME_WIDTH/2, y: GAME_HEIGHT/2 - 100, role: 'safety', team: 'defense', targetX: null, targetY: null, diving: false });
        activePlayerIndex = 0; // Control Safety

        // Offense CPU
        players.push({ id: 1, x: GAME_WIDTH/2, y: GAME_HEIGHT/2 + 20, role: 'qb', team: 'offense', targetX: GAME_WIDTH/2, targetY: GAME_HEIGHT/2 - 20, diving: false });
        ball = { x: GAME_WIDTH/2, y: GAME_HEIGHT/2, z: 0, state: 'snapped', carrier: null };
    }
}

function handlePreSnapInput(pos) {
    if (currentTeam === 'offense') {
        // Check if tapping QB
        const qb = players.find(p => p.role === 'qb');
        if (qb) {
            const dx = pos.x - qb.x;
            const dy = pos.y - qb.y;
            if (Math.sqrt(dx*dx + dy*dy) < 30) {
                // Snap ball
                ball.state = 'held';
                ball.carrier = qb;
                currentState = GameState.PLAYING;
            }
        }
    } else {
        // Defense can tap anywhere to start play
        currentState = GameState.PLAYING;
        // CPU snaps ball
        const qb = players.find(p => p.role === 'qb');
        if (qb) {
            ball.state = 'held';
            ball.carrier = qb;
        }
    }
}

function handlePlayingInputDown(pos) {
    if (currentTeam === 'defense') {
        const activePlayer = players[activePlayerIndex];

        // Dive tackle check
        if (input.doubleTapped) {
            activePlayer.diving = true;
            activePlayer.diveTimer = 20; // frames
            // Dive in the direction of current target or last movement
            return;
        }

        // Tap to move safety
        activePlayer.targetX = pos.x;
        activePlayer.targetY = pos.y;
    } else if (currentTeam === 'offense') {
        const activePlayer = players[activePlayerIndex];

        // Dive check
        if (input.doubleTapped) {
            activePlayer.diving = true;
            activePlayer.diveTimer = 20; // frames
            return;
        }

        // Tap to move active player
        activePlayer.targetX = pos.x;
        activePlayer.targetY = pos.y;

        // Handoff logic: if holding ball, tap on a nearby player
        if (ball.carrier === activePlayer) {
            for (let i = 0; i < players.length; i++) {
                const p = players[i];
                if (p.team === 'offense' && p !== activePlayer) {
                    const dx = pos.x - p.x;
                    const dy = pos.y - p.y;
                    if (Math.sqrt(dx*dx + dy*dy) < 25) { // tap radius around teammate
                        const distToActive = Math.sqrt((p.x - activePlayer.x)**2 + (p.y - activePlayer.y)**2);
                        if (distToActive < 40) { // must be nearby for handoff
                            ball.carrier = p;
                            activePlayerIndex = i;
                            p.targetX = null;
                            p.targetY = null;
                            break;
                        }
                    }
                }
            }
        }
    }
}

function handlePlayingInputDragRelease(startX, startY, endX, endY) {
    if (currentTeam === 'offense') {
        const activePlayer = players[activePlayerIndex];
        if (ball.carrier === activePlayer) {
            // Calculate drag vector
            const dx = endX - startX;
            const dy = endY - startY;
            const dist = Math.sqrt(dx*dx + dy*dy);

            // Only throw if dragged a minimum distance
            if (dist > 15) {
                // Inverse trajectory
                const throwVx = -dx * 0.1;
                const throwVy = -dy * 0.1;
                const throwVz = dist * 0.05; // Arc height proportional to drag distance

                ball.state = 'in_air';
                ball.carrier = null;
                ball.x = activePlayer.x;
                ball.y = activePlayer.y;
                ball.z = 10; // Start slightly off ground
                ball.vx = throwVx;
                ball.vy = throwVy;
                ball.vz = throwVz;
            }
        }
    }
}

// Game Loop
let lastTime = 0;
function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    update(deltaTime);
    draw();

    // Reset single-frame inputs
    input.tapped = false;
    input.doubleTapped = false;

    requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
    if (currentState === GameState.MENU) {
        // Update menu logic
    } else if (currentState === GameState.PLAYING) {
        updatePlayers();
        updateBall();
        checkTackles();
        checkOutOfBounds();
    }
}

function updatePlayers() {
    players.forEach((p, idx) => {
        let speed = p.diving ? 3 : 1.5;

        // Basic AI for non-active players
        if (idx !== activePlayerIndex) {
            if (p.role === 'wr') {
                // Keep running to target
                if (Math.abs(p.x - p.targetX) < 5 && Math.abs(p.y - p.targetY) < 5) {
                    p.targetY -= 50; // simple streak route
                }
            } else if (p.role === 'dl' && ball.carrier) {
                // Rush the ball carrier
                p.targetX = ball.carrier.x;
                p.targetY = ball.carrier.y;
                speed = 1.2;
            } else if (p.role === 'qb' && currentTeam === 'defense' && ball.carrier === p) {
                // CPU QB runs or throws
                p.targetY -= 1; // run forward slowly
            }
        }

        if (p.targetX !== null && p.targetY !== null) {
            const dx = p.targetX - p.x;
            const dy = p.targetY - p.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist > speed) {
                p.x += (dx / dist) * speed;
                p.y += (dy / dist) * speed;
            }
        }

        if (p.diving) {
            p.diveTimer--;
            if (p.diveTimer <= 0) {
                p.diving = false;
            }
        }
    });
}

function updateBall() {
    if (ball.state === 'held' && ball.carrier) {
        ball.x = ball.carrier.x;
        ball.y = ball.carrier.y;
        ball.z = 15; // held at waist/chest height
    } else if (ball.state === 'in_air') {
        ball.x += ball.vx;
        ball.y += ball.vy;
        ball.z += ball.vz;

        // Gravity
        ball.vz -= 0.5;

        // Check catch or incomplete
        if (ball.z <= 0) {
            ball.state = 'grounded';
            ball.z = 0;
            currentState = GameState.PLAY_OVER;
        } else {
            // Check for interceptions or catches
            for (let i = 0; i < players.length; i++) {
                const p = players[i];
                // Must be within reach and ball not too high (or diving)
                const reach = p.diving ? 25 : 15;
                const maxZ = p.diving ? 15 : 30; // max height they can catch

                if (ball.z < maxZ) {
                    const dx = p.x - ball.x;
                    const dy = p.y - ball.y;
                    if (Math.sqrt(dx*dx + dy*dy) < reach) {
                        ball.state = 'held';
                        ball.carrier = p;
                        if (p.team !== currentTeam) {
                            // Turnover
                            currentState = GameState.PLAY_OVER;
                        } else {
                            // Control the receiver
                            activePlayerIndex = i;
                            p.targetX = null;
                            p.targetY = null;
                        }
                        break;
                    }
                }
            }
        }
    }
}

function checkTackles() {
    if (ball.carrier) {
        players.forEach(p => {
            if (p.team !== ball.carrier.team) {
                const dx = p.x - ball.carrier.x;
                const dy = p.y - ball.carrier.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const tackleRadius = p.diving ? 20 : 12;

                if (dist < tackleRadius) {
                    // Tackle!
                    currentState = GameState.PLAY_OVER;
                }
            }
        });
    }
}

function checkOutOfBounds() {
    if (ball.carrier) {
        if (ball.carrier.x < 0 || ball.carrier.x > GAME_WIDTH || ball.carrier.y < 0 || ball.carrier.y > GAME_HEIGHT) {
            currentState = GameState.PLAY_OVER;
        }
    } else if (ball.state === 'in_air') {
        if (ball.x < 0 || ball.x > GAME_WIDTH || ball.y < 0 || ball.y > GAME_HEIGHT) {
            currentState = GameState.PLAY_OVER;
        }
    }
}

function draw() {
    // Draw Field
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw endzones
    ctx.fillStyle = '#1A5276';
    ctx.fillRect(0, 0, canvas.width, 60);
    ctx.fillStyle = '#922B21';
    ctx.fillRect(0, canvas.height - 60, canvas.width, 60);

    // Draw yard lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    for (let y = 60; y < canvas.height - 60; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    if (currentState === GameState.MENU) {
        ctx.fillStyle = 'white';
        ctx.font = '20px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('RETRO', canvas.width / 2, canvas.height / 2 - 60);
        ctx.fillText('FOOTBALL', canvas.width / 2, canvas.height / 2 - 30);
        ctx.font = '10px "Press Start 2P"';
        ctx.fillText('Tap to Start Exhibition', canvas.width / 2, canvas.height / 2 + 20);
    } else {
        // Draw Players
        players.forEach((p, idx) => {
            // Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.ellipse(p.x, p.y + 10, 12, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            // Player body
            ctx.fillStyle = p.team === 'offense' ? '#3498DB' : '#E74C3C';

            // Highlight active player
            if (idx === activePlayerIndex) {
                ctx.strokeStyle = '#F1C40F';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.diving ? 8 : 12, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.fillRect(p.x - 8, p.y - (p.diving ? 4 : 16), 16, p.diving ? 8 : 16);

            // Helmet
            ctx.fillStyle = '#F39C12';
            ctx.fillRect(p.x - 6, p.y - (p.diving ? 4 : 20), 12, 8);
        });

        // Draw Ball
        if (ball.state !== 'grounded' && (ball.state === 'in_air' || ball.carrier)) {
            const ballScale = 1 + (ball.z / 20); // Scale up based on height
            ctx.fillStyle = '#784212';
            ctx.beginPath();
            ctx.ellipse(ball.x, ball.y - ball.z, 4 * ballScale, 6 * ballScale, 0, 0, Math.PI * 2);
            ctx.fill();

            // Laces
            ctx.fillStyle = 'white';
            ctx.fillRect(ball.x - 1 * ballScale, ball.y - ball.z - 2 * ballScale, 2 * ballScale, 4 * ballScale);
        }

        // UI Text
        ctx.fillStyle = 'white';
        ctx.font = '10px "Press Start 2P"';
        ctx.textAlign = 'left';
        if (currentState === GameState.PLAY_OVER) {
            ctx.textAlign = 'center';
            ctx.font = '14px "Press Start 2P"';
            ctx.fillText('PLAY OVER', canvas.width / 2, canvas.height / 2);
            ctx.font = '10px "Press Start 2P"';
            ctx.fillText('Tap to continue', canvas.width / 2, canvas.height / 2 + 20);
        }
    }
}

// Start game loop
requestAnimationFrame(gameLoop);
