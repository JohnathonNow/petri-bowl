const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Fixed internal resolution for consistent 8-bit feel
const GAME_WIDTH = 480;
const GAME_HEIGHT = 320;

const FIELD_WIDTH = 1200;
const FIELD_HEIGHT = 320;
let camera = { x: 0, y: 0 };


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

let down = 1;
let yardsToGo = 100; // in pixels (10 yards * 10)
let lineOfScrimmage = 200;
let firstDownLine = 300;
let movingRight = true;


// Input State
let input = {
    active: false,
    startX: 0,
    startY: 0,
    startClientX: 0,
    startClientY: 0,
    currentX: 0,
    currentY: 0,
    currentClientX: 0,
    currentClientY: 0,
    tapped: false,
    lastTapTime: 0,
    doubleTapped: false
};

// Game Entities (stubs to be filled in next steps)
let players = [];
let ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, state: 'held', carrier: null, thrower: null, throwTimer: 0 };
let activePlayerIndex = 0;

// Coordinate mapping helper
function getCanvasPos(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (evt.clientX - rect.left) * scaleX + camera.x,
        y: (evt.clientY - rect.top) * scaleY + camera.y
    };
}

// Input handling
canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault(); // Prevent default touch actions
    const pos = getCanvasPos(e);
    input.active = true;
    input.startX = pos.x;
    input.startY = pos.y;
    input.startClientX = e.clientX;
    input.startClientY = e.clientY;
    input.currentX = pos.x;
    input.currentY = pos.y;
    input.currentClientX = e.clientX;
    input.currentClientY = e.clientY;

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
        // Calculate yards gained
        let yardsGained = 0;
        if (movingRight) {
            yardsGained = ball.x - lineOfScrimmage;
        } else {
            yardsGained = lineOfScrimmage - ball.x;
        }

        yardsToGo -= yardsGained;

        let touchdown = false;
        if (ball.x <= 60 || ball.x >= FIELD_WIDTH - 60) {
            touchdown = true;
        }

        if (touchdown) {
            currentTeam = currentTeam === 'offense' ? 'defense' : 'offense';
            movingRight = !movingRight;
            down = 1;
            yardsToGo = 100;
            lineOfScrimmage = movingRight ? 200 : FIELD_WIDTH - 200;
            firstDownLine = movingRight ? lineOfScrimmage + yardsToGo : lineOfScrimmage - yardsToGo;
        } else if (yardsToGo <= 0) {
            // First down
            down = 1;
            yardsToGo = 100;
            lineOfScrimmage = ball.x;
            // Clamp LoS
            if (lineOfScrimmage < 60) lineOfScrimmage = 60;
            if (lineOfScrimmage > FIELD_WIDTH - 60) lineOfScrimmage = FIELD_WIDTH - 60;
            firstDownLine = movingRight ? lineOfScrimmage + yardsToGo : lineOfScrimmage - yardsToGo;
        } else {
            down++;
            if (down > 4) {
                // Turnover on downs
                currentTeam = currentTeam === 'offense' ? 'defense' : 'offense';
                movingRight = !movingRight;
                down = 1;
                yardsToGo = 100;
                lineOfScrimmage = ball.x;
                if (lineOfScrimmage < 60) lineOfScrimmage = 60;
                if (lineOfScrimmage > FIELD_WIDTH - 60) lineOfScrimmage = FIELD_WIDTH - 60;
                firstDownLine = movingRight ? lineOfScrimmage + yardsToGo : lineOfScrimmage - yardsToGo;
            } else {
                lineOfScrimmage = ball.x;
                if (lineOfScrimmage < 60) lineOfScrimmage = 60;
                if (lineOfScrimmage > FIELD_WIDTH - 60) lineOfScrimmage = FIELD_WIDTH - 60;
                firstDownLine = movingRight ? lineOfScrimmage + yardsToGo : lineOfScrimmage - yardsToGo;
            }
        }

        setupPreSnap();
        currentState = GameState.PRE_SNAP;
    } else if (currentState === GameState.PRE_SNAP) {
        // Handled in specific mechanics step
        handlePreSnapInput(pos);
    } else if (currentState === GameState.PLAYING) {
        if (input.doubleTapped) {
            const activePlayer = players[activePlayerIndex];
            activePlayer.diving = true;
            activePlayer.diveTimer = 20; // frames
        }
    }
});

canvas.addEventListener('pointermove', (e) => {
    e.preventDefault();
    if (!input.active) return;
    const pos = getCanvasPos(e);
    input.currentX = pos.x;
    input.currentY = pos.y;
    input.currentClientX = e.clientX;
    input.currentClientY = e.clientY;
});

canvas.addEventListener('pointerup', (e) => {
    e.preventDefault();
    if (!input.active) return;
    const pos = getCanvasPos(e);

    // Determine if it was a tap or a drag based on screen coordinates
    const clientDx = e.clientX - input.startClientX;
    const clientDy = e.clientY - input.startClientY;
    const dist = Math.sqrt(clientDx*clientDx + clientDy*clientDy);

    if (dist < 15) {
        input.tapped = true;
        if (currentState === GameState.PLAYING) {
            handlePlayingInputTap(pos);
        }
    } else {
        if (currentState === GameState.PLAYING) {
            handlePlayingInputDragRelease(clientDx, clientDy);
        }
    }

    input.active = false;
});

// Stubs for game logic
function setupPreSnap() {
    players = [];
    let offDir = movingRight ? -1 : 1;
    let defDir = movingRight ? 1 : -1;

    // Offense (11 players)
    // 5 OL
    players.push({ id: 0, x: lineOfScrimmage + offDir * 10, y: GAME_HEIGHT/2, role: 'ol', team: 'offense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 }); // C
    players.push({ id: 1, x: lineOfScrimmage + offDir * 10, y: GAME_HEIGHT/2 - 20, role: 'ol', team: 'offense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 }); // LG
    players.push({ id: 2, x: lineOfScrimmage + offDir * 10, y: GAME_HEIGHT/2 + 20, role: 'ol', team: 'offense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 }); // RG
    players.push({ id: 3, x: lineOfScrimmage + offDir * 10, y: GAME_HEIGHT/2 - 40, role: 'ol', team: 'offense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 }); // LT
    players.push({ id: 4, x: lineOfScrimmage + offDir * 10, y: GAME_HEIGHT/2 + 40, role: 'ol', team: 'offense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 }); // RT
    // QB
    players.push({ id: 5, x: lineOfScrimmage + offDir * 30, y: GAME_HEIGHT/2, role: 'qb', team: 'offense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 });
    // RB
    players.push({ id: 6, x: lineOfScrimmage + offDir * 60, y: GAME_HEIGHT/2, role: 'rb', team: 'offense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 });
    // TE
    players.push({ id: 7, x: lineOfScrimmage + offDir * 10, y: GAME_HEIGHT/2 + 60, role: 'te', team: 'offense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 });
    // WRs
    players.push({ id: 8, x: lineOfScrimmage + offDir * 10, y: GAME_HEIGHT/2 - 120, role: 'wr', team: 'offense', targetX: lineOfScrimmage + defDir * 150, targetY: GAME_HEIGHT/2 - 120, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 });
    players.push({ id: 9, x: lineOfScrimmage + offDir * 10, y: GAME_HEIGHT/2 + 120, role: 'wr', team: 'offense', targetX: lineOfScrimmage + defDir * 150, targetY: GAME_HEIGHT/2 + 120, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 });
    players.push({ id: 10, x: lineOfScrimmage + offDir * 20, y: GAME_HEIGHT/2 - 80, role: 'wr', team: 'offense', targetX: lineOfScrimmage + defDir * 150, targetY: GAME_HEIGHT/2 - 80, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 });

    // Defense (11 players)
    // 4 DL
    players.push({ id: 11, x: lineOfScrimmage + defDir * 10, y: GAME_HEIGHT/2 - 15, role: 'dl', team: 'defense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 });
    players.push({ id: 12, x: lineOfScrimmage + defDir * 10, y: GAME_HEIGHT/2 + 15, role: 'dl', team: 'defense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 });
    players.push({ id: 13, x: lineOfScrimmage + defDir * 10, y: GAME_HEIGHT/2 - 45, role: 'dl', team: 'defense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 });
    players.push({ id: 14, x: lineOfScrimmage + defDir * 10, y: GAME_HEIGHT/2 + 45, role: 'dl', team: 'defense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 });
    // 3 LB
    players.push({ id: 15, x: lineOfScrimmage + defDir * 40, y: GAME_HEIGHT/2, role: 'lb', team: 'defense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 });
    players.push({ id: 16, x: lineOfScrimmage + defDir * 40, y: GAME_HEIGHT/2 - 30, role: 'lb', team: 'defense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 });
    players.push({ id: 17, x: lineOfScrimmage + defDir * 40, y: GAME_HEIGHT/2 + 30, role: 'lb', team: 'defense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 });
    // 2 CB
    players.push({ id: 18, x: lineOfScrimmage + defDir * 20, y: GAME_HEIGHT/2 - 120, role: 'cb', team: 'defense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 });
    players.push({ id: 19, x: lineOfScrimmage + defDir * 20, y: GAME_HEIGHT/2 + 120, role: 'cb', team: 'defense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 });
    // 2 S
    players.push({ id: 20, x: lineOfScrimmage + defDir * 100, y: GAME_HEIGHT/2 - 40, role: 'safety', team: 'defense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 });
    players.push({ id: 21, x: lineOfScrimmage + defDir * 100, y: GAME_HEIGHT/2 + 40, role: 'safety', team: 'defense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 });

    if (currentTeam === 'offense') {
        activePlayerIndex = 5; // Control QB
    } else {
        activePlayerIndex = 15; // Control MLB
    }

    ball = { x: lineOfScrimmage, y: GAME_HEIGHT/2, z: 0, state: 'snapped', carrier: null, thrower: null, throwTimer: 0 };
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

function handlePlayingInputTap(pos) {
    if (currentTeam === 'defense') {
        const activePlayer = players[activePlayerIndex];

        // Tap to move safety
        activePlayer.targetX = pos.x;
        activePlayer.targetY = pos.y;
    } else if (currentTeam === 'offense') {
        const activePlayer = players[activePlayerIndex];

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

function handlePlayingInputDragRelease(clientDx, clientDy) {
    if (currentTeam === 'offense') {
        const activePlayer = players[activePlayerIndex];
        if (ball.carrier === activePlayer) {
            // Calculate drag vector based on screen coordinates
            const dist = Math.sqrt(clientDx*clientDx + clientDy*clientDy);

            // Only throw if dragged a minimum distance
            if (dist > 15) {
                // Inverse trajectory
                const throwVx = -clientDx * 0.1;
                const throwVy = -clientDy * 0.1;
                const throwVz = dist * 0.05; // Arc height proportional to drag distance

                ball.state = 'in_air';
                ball.carrier = null;
                ball.thrower = activePlayer;
                ball.throwTimer = 30; // Immunity frames for thrower
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

    // Camera logic
    let targetX = camera.x;
    if (currentState === GameState.PLAYING || currentState === GameState.PRE_SNAP || currentState === GameState.PLAY_OVER) {
        if (ball.state === 'in_air' || ball.state === 'grounded' || (ball.state === 'snapped' && !ball.carrier)) {
            targetX = ball.x - GAME_WIDTH / 2;
        } else if (ball.carrier) {
            targetX = ball.carrier.x - GAME_WIDTH / 2;
        } else if (players.length > activePlayerIndex && players[activePlayerIndex]) {
            targetX = players[activePlayerIndex].x - GAME_WIDTH / 2;
        }
    }

    // Clamp camera
    if (targetX < 0) targetX = 0;
    if (targetX > FIELD_WIDTH - GAME_WIDTH) targetX = FIELD_WIDTH - GAME_WIDTH;

    // Smooth camera or set directly
    camera.x += (targetX - camera.x) * 0.1;
    camera.y = 0;
}

function updatePlayers() {
    let offDir = movingRight ? 1 : -1;
    let defDir = movingRight ? -1 : 1;

    players.forEach((p, idx) => {
        // Block breaking and stun logic
        if (p.stunTimer > 0) {
            p.stunTimer--;
            return; // Cannot move while stunned
        }

        if (p.blockedBy) {
            p.blockTimer++;
            // Check for block break every half second (approx 30 frames at 60fps)
            if (p.blockTimer >= 30) {
                p.blockTimer = 0;

                // Calculate break chance based on strength vs blocking
                let breakChance = 10 + (p.strength - p.blockedBy.blocking);
                // Clamp between 5% and 95%
                breakChance = Math.max(5, Math.min(95, breakChance));

                if (Math.random() * 100 < breakChance) {
                    // Block broken
                    p.blockedBy.stunTimer = 60; // Stun blocker for 1 second
                    p.blockedBy.blockingTarget = null;
                    p.blockedBy = null;
                }
            }
            return; // Cannot move while blocked
        }

        let speed = p.diving ? 3 : 1.5;

        // Basic AI for non-active players
        if (idx !== activePlayerIndex) {
            if (p.role === 'wr' || p.role === 'te') {
                // Simple streak route
                if (p.targetX === null) {
                    p.targetX = p.x + offDir * 200;
                    p.targetY = p.y;
                }
                if (Math.abs(p.x - p.targetX) < 5 && Math.abs(p.y - p.targetY) < 5) {
                    p.targetX += offDir * 50;
                }
            } else if (p.role === 'ol') {
                // Active blocking logic
                let targetDefender = null;
                let minTargetDist = Infinity;

                // Find nearest unblocked defender
                for (let def of players) {
                    if (def.team !== p.team && !def.blockedBy) {
                        const dx = def.x - p.x;
                        const dy = def.y - p.y;
                        const dist = Math.sqrt(dx*dx + dy*dy);

                        // Consider defenders within reasonable range (e.g., 100 pixels) and ahead of the blocker
                        if (dist < 100 && dist < minTargetDist) {
                            // Check if defender is generally in front of the OL
                            if ((movingRight && def.x >= p.x - 20) || (!movingRight && def.x <= p.x + 20)) {
                                minTargetDist = dist;
                                targetDefender = def;
                            }
                        }
                    }
                }

                if (targetDefender) {
                    p.targetX = targetDefender.x;
                    p.targetY = targetDefender.y;

                    if (minTargetDist < 15) {
                        // Engage block
                        targetDefender.blockedBy = p;
                        p.blockingTarget = targetDefender;
                        speed = 0;
                    } else {
                        speed = 0.8;
                    }
                } else {
                    // Default behavior if no target
                    if (p.targetX === null || Math.abs(p.targetX - p.x) < 5) {
                        p.targetX = p.x + offDir * 5;
                        p.targetY = p.y;
                    }
                    speed = 0.5;
                }

                // If currently blocking someone
                if (p.blockingTarget) {
                    // Check if block is still valid
                    if (p.blockingTarget.blockedBy !== p) {
                        p.blockingTarget = null; // Block broken or reassigned
                    } else {
                        speed = 0; // Maintain block position
                        p.targetX = p.x;
                        p.targetY = p.y;
                    }
                }
            } else if (p.role === 'dl') {
                if (ball.carrier) {
                    p.targetX = ball.carrier.x;
                    p.targetY = ball.carrier.y;
                } else {
                    p.targetX = p.x + defDir * 10;
                    p.targetY = p.y;
                }
                speed = 1.2;
            } else if ((p.role === 'lb' || p.role === 'safety') && ball.state !== 'snapped') {
                if (ball.carrier) {
                    p.targetX = ball.carrier.x;
                    p.targetY = ball.carrier.y;
                }
            } else if (p.role === 'cb') {
                // Rough man coverage on nearest WR
                let nearestWR = players.find(wr => wr.role === 'wr' && Math.abs(wr.y - p.y) < 50);
                if (nearestWR) {
                    p.targetX = nearestWR.x + defDir * 10;
                    p.targetY = nearestWR.y;
                } else if (ball.carrier) {
                    p.targetX = ball.carrier.x;
                    p.targetY = ball.carrier.y;
                }
            } else if (p.role === 'rb') {
                if (ball.carrier !== p && currentTeam === 'defense') {
                     // CPU RB runs a route
                     if (p.targetX === null) {
                         p.targetX = p.x + offDir * 50;
                         p.targetY = p.y + 30;
                     }
                }
            } else if (p.role === 'qb' && currentTeam === 'defense' && ball.carrier === p) {
                // CPU QB drops back slightly then runs
                if (Math.abs(p.x - lineOfScrimmage) < 20) {
                    p.targetX = p.x - offDir * 1;
                } else {
                    p.targetX = p.x + offDir * 200;
                    p.targetY = p.y;
                }
                speed = 1.0;
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

        if (ball.throwTimer > 0) {
            ball.throwTimer--;
        }

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
                if (p === ball.thrower && ball.throwTimer > 0) continue;
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
        if (ball.carrier.x < 0 || ball.carrier.x > FIELD_WIDTH || ball.carrier.y < 0 || ball.carrier.y > FIELD_HEIGHT) {
            currentState = GameState.PLAY_OVER;
        }
    } else if (ball.state === 'in_air') {
        if (ball.x < 0 || ball.x > FIELD_WIDTH || ball.y < 0 || ball.y > FIELD_HEIGHT) {
            currentState = GameState.PLAY_OVER;
        }
    }
}

function draw() {
    // Draw Background
    ctx.fillStyle = '#222'; // Outside bounds
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Draw Field
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

    // Draw endzones
    ctx.fillStyle = '#1A5276';
    ctx.fillRect(0, 0, 60, FIELD_HEIGHT);
    ctx.fillStyle = '#922B21';
    ctx.fillRect(FIELD_WIDTH - 60, 0, 60, FIELD_HEIGHT);

    // Draw yard lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    for (let x = 60; x < FIELD_WIDTH - 60; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, FIELD_HEIGHT);
        ctx.stroke();
    }

    // Draw line of scrimmage
    ctx.strokeStyle = '#3498DB'; // Blue
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lineOfScrimmage, 0);
    ctx.lineTo(lineOfScrimmage, FIELD_HEIGHT);
    ctx.stroke();

    // Draw first down line
    ctx.strokeStyle = '#F1C40F'; // Yellow
    ctx.beginPath();
    ctx.moveTo(firstDownLine, 0);
    ctx.lineTo(firstDownLine, FIELD_HEIGHT);
    ctx.stroke();

    if (currentState === GameState.MENU) {
        ctx.restore();
        ctx.fillStyle = 'white';
        ctx.font = '20px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('RETRO', canvas.width / 2, canvas.height / 2 - 60);
        ctx.fillText('FOOTBALL', canvas.width / 2, canvas.height / 2 - 30);
        ctx.font = '10px "Press Start 2P"';
        ctx.fillText('Tap to Start Exhibition', canvas.width / 2, canvas.height / 2 + 20);
        return; // Early return for menu
    }

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

    // Trajectory Indicator
    if (currentState === GameState.PLAYING && input.active && currentTeam === 'offense' && players[activePlayerIndex] === ball.carrier) {
        const clientDx = input.currentClientX - input.startClientX;
        const clientDy = input.currentClientY - input.startClientY;
        const dist = Math.sqrt(clientDx*clientDx + clientDy*clientDy);

        if (dist > 15) {
            const throwVx = -clientDx * 0.1;
            const throwVy = -clientDy * 0.1;
            const throwVz = dist * 0.05;

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 2;
            ctx.beginPath();

            let simX = ball.x;
            let simY = ball.y;
            let simZ = 10;
            let simVz = throwVz;

            ctx.moveTo(simX, simY - simZ);

            // Simulate trajectory until it hits the ground
            for (let i = 0; i < 60; i++) {
                simX += throwVx;
                simY += throwVy;
                simZ += simVz;
                simVz -= 0.5;

                if (simZ <= 0) {
                    simZ = 0;
                    ctx.lineTo(simX, simY - simZ);
                    // Draw a landing target marker
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.strokeStyle = 'rgba(241, 196, 15, 0.8)';
                    ctx.beginPath();
                    ctx.ellipse(simX, simY, 15, 8, 0, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.fillStyle = 'rgba(241, 196, 15, 0.3)';
                    ctx.fill();
                    break;
                }
                ctx.lineTo(simX, simY - simZ);
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    ctx.restore();

    // UI Text
    ctx.fillStyle = 'white';
    ctx.font = '10px "Press Start 2P"';
    ctx.textAlign = 'left';
    ctx.fillText(`Down: ${down} & ${Math.ceil(yardsToGo / 10)}`, 10, 20);
    if (currentState === GameState.PLAY_OVER) {
        ctx.textAlign = 'center';
        ctx.font = '14px "Press Start 2P"';
        ctx.fillText('PLAY OVER', canvas.width / 2, canvas.height / 2);
        ctx.font = '10px "Press Start 2P"';
        ctx.fillText('Tap to continue', canvas.width / 2, canvas.height / 2 + 20);
    }
}

// Start game loop
requestAnimationFrame(gameLoop);
