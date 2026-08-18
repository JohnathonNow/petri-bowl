const fs = require('fs');

let content = fs.readFileSync('retro-football/game.js', 'utf8');

const setupPreSnapRegex = /(function setupPreSnap\(\) {[\s\S]*?\/\/ WRs[\s\S]*?players\.push\({ id: 10[^\n]*\}\);)/;

const newSetup = `
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
    players.push({ id: 8, x: lineOfScrimmage + offDir * 10, y: GAME_HEIGHT/2 - 120, role: 'wr', team: 'offense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 });
    players.push({ id: 9, x: lineOfScrimmage + offDir * 10, y: GAME_HEIGHT/2 + 120, role: 'wr', team: 'offense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 });
    players.push({ id: 10, x: lineOfScrimmage + offDir * 20, y: GAME_HEIGHT/2 - 80, role: 'wr', team: 'offense', targetX: null, targetY: null, diving: false, blocking: 50 + Math.random() * 50, strength: 50 + Math.random() * 50, blockedBy: null, blockingTarget: null, blockTimer: 0, stunTimer: 0 });

    // Assign Routes
    let currentPlay = offensivePlays[currentOffensivePlayIndex];
    let wrCount = 0;
    let teCount = 0;
    let rbCount = 0;

    players.forEach(p => {
        if (p.team === 'offense') {
            let routeOffsets = null;
            if (p.role === 'wr' && currentPlay.routes.wr && currentPlay.routes.wr[wrCount]) {
                routeOffsets = currentPlay.routes.wr[wrCount];
                wrCount++;
            } else if (p.role === 'te' && currentPlay.routes.te && currentPlay.routes.te[teCount]) {
                routeOffsets = currentPlay.routes.te[teCount];
                teCount++;
            } else if (p.role === 'rb' && currentPlay.routes.rb && currentPlay.routes.rb[rbCount]) {
                routeOffsets = currentPlay.routes.rb[rbCount];
                rbCount++;
            }

            if (routeOffsets) {
                p.routePoints = [];
                let cx = p.x;
                let cy = p.y;
                for (let pt of routeOffsets) {
                    cx += -offDir * pt.dx; // Moving right means offDir is -1. If movingRight is true, defDir is 1. x should increase. So x += 1 * pt.dx. Wait, offDir is movingRight ? -1 : 1. So -offDir is 1 when movingRight.
                    cy += pt.dy;
                    p.routePoints.push({ x: cx, y: cy });
                }
                p.currentRouteIndex = 0;
            }
        }
    });
`;

content = content.replace(setupPreSnapRegex, newSetup);
fs.writeFileSync('retro-football/game.js', content);
