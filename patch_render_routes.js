const fs = require('fs');

let content = fs.readFileSync('retro-football/game.js', 'utf8');

const oldDrawBall = `    // Draw Ball
    if (ball.state !== 'grounded' && (ball.state === 'in_air' || ball.carrier)) {`;

const newDrawBall = `    // Draw Player Routes
    if ((currentState === GameState.PRE_SNAP || currentState === GameState.PLAYING) && currentTeam === 'offense') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;

        players.forEach(p => {
            if (p.team === 'offense' && p.routePoints && p.currentRouteIndex < p.routePoints.length) {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                for (let i = p.currentRouteIndex; i < p.routePoints.length; i++) {
                    ctx.lineTo(p.routePoints[i].x, p.routePoints[i].y);
                }
                ctx.stroke();
            }
        });

        ctx.setLineDash([]);
    }

    // Draw Ball
    if (ball.state !== 'grounded' && (ball.state === 'in_air' || ball.carrier)) {`;

content = content.replace(oldDrawBall, newDrawBall);
fs.writeFileSync('retro-football/game.js', content);
