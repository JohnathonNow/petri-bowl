const fs = require('fs');

let content = fs.readFileSync('retro-football/game.js', 'utf8');

const oldInput = `        const uiX = pos.x - camera.x;
        const uiY = pos.y - camera.y;

        if (uiX > GAME_WIDTH / 2 - 40 && uiX < GAME_WIDTH / 2 + 40 && uiY > GAME_HEIGHT - 40 && uiY < GAME_HEIGHT - 10) {`;

const newInput = `        const uiX = pos.x - camera.x;
        const uiY = pos.y - camera.y;

        // Check Change Play button
        if (uiX > GAME_WIDTH / 2 - 60 && uiX < GAME_WIDTH / 2 + 60 && uiY > GAME_HEIGHT - 80 && uiY < GAME_HEIGHT - 50) {
            currentOffensivePlayIndex = (currentOffensivePlayIndex + 1) % offensivePlays.length;
            setupPreSnap();
            return;
        }

        if (uiX > GAME_WIDTH / 2 - 40 && uiX < GAME_WIDTH / 2 + 40 && uiY > GAME_HEIGHT - 40 && uiY < GAME_HEIGHT - 10) {`;

content = content.replace(oldInput, newInput);
fs.writeFileSync('retro-football/game.js', content);
