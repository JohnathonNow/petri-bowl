const fs = require('fs');

let content = fs.readFileSync('retro-football/game.js', 'utf8');

const oldRbAi = `            } else if (p.role === 'rb') {
                if (ball.carrier !== p && currentTeam === 'defense') {
                     // CPU RB runs a route
                     if (p.targetX === null) {
                         p.targetX = p.x + offDir * 50;
                         p.targetY = p.y + 30;
                     }
                }
            } else if (p.role === 'qb' && currentTeam === 'defense' && ball.carrier === p) {`;

const newRbAi = `            } else if (p.role === 'rb') {
                if (ball.carrier !== p && currentTeam === 'defense') {
                     // CPU RB runs a route
                     if (p.targetX === null) {
                         p.targetX = p.x + offDir * 50;
                         p.targetY = p.y + 30;
                     }
                }
            } else if (p.role === 'qb' && currentTeam === 'defense' && ball.carrier === p) {`;

content = content.replace(oldRbAi, newRbAi);
fs.writeFileSync('retro-football/game.js', content);
