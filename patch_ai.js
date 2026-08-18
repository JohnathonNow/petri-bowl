const fs = require('fs');

let content = fs.readFileSync('retro-football/game.js', 'utf8');

const oldWrTeAi = `            if (p.role === 'wr' || p.role === 'te') {
                // Simple streak route
                if (p.targetX === null) {
                    p.targetX = p.x + offDir * 200;
                    p.targetY = p.y;
                }
                if (Math.abs(p.x - p.targetX) < 5 && Math.abs(p.y - p.targetY) < 5) {
                    p.targetX += offDir * 50;
                }
            } else if (p.role === 'ol') {`;

const newWrTeAi = `            if (p.role === 'wr' || p.role === 'te' || (p.role === 'rb' && p.team === 'offense')) {
                if (p.routePoints && p.currentRouteIndex < p.routePoints.length) {
                    let targetPoint = p.routePoints[p.currentRouteIndex];
                    p.targetX = targetPoint.x;
                    p.targetY = targetPoint.y;
                    if (Math.abs(p.x - p.targetX) < 5 && Math.abs(p.y - p.targetY) < 5) {
                        p.currentRouteIndex++;
                    }
                } else if (p.routePoints && p.currentRouteIndex >= p.routePoints.length) {
                    // Reached end of route, run straight
                    p.targetX += offDir * 50;
                } else {
                    // Fallback simple streak
                    if (p.targetX === null) {
                        p.targetX = p.x + offDir * 200;
                        p.targetY = p.y;
                    }
                    if (Math.abs(p.x - p.targetX) < 5 && Math.abs(p.y - p.targetY) < 5) {
                        p.targetX += offDir * 50;
                    }
                }
            } else if (p.role === 'ol') {`;

content = content.replace(oldWrTeAi, newWrTeAi);
fs.writeFileSync('retro-football/game.js', content);
