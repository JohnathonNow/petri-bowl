const fs = require('fs');

let content = fs.readFileSync('retro-football/game.js', 'utf8');

const oldDrawPunt = `    // Draw Punt button during PRE_SNAP for offense
    if (currentState === GameState.PRE_SNAP && currentTeam === 'offense') {
        ctx.fillStyle = '#E67E22';
        ctx.fillRect(canvas.width / 2 - 40, canvas.height - 40, 80, 30);
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText('PUNT', canvas.width / 2, canvas.height - 20);
    }`;

const newDrawPunt = `    // Draw Punt button during PRE_SNAP for offense
    if (currentState === GameState.PRE_SNAP && currentTeam === 'offense') {
        // Change Play Button
        ctx.fillStyle = '#3498DB';
        ctx.fillRect(canvas.width / 2 - 60, canvas.height - 80, 120, 30);
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText('Play: ' + offensivePlays[currentOffensivePlayIndex].name, canvas.width / 2, canvas.height - 60);

        // Punt Button
        ctx.fillStyle = '#E67E22';
        ctx.fillRect(canvas.width / 2 - 40, canvas.height - 40, 80, 30);
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText('PUNT', canvas.width / 2, canvas.height - 20);
    }`;

content = content.replace(oldDrawPunt, newDrawPunt);
fs.writeFileSync('retro-football/game.js', content);
