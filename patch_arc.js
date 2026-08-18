const fs = require('fs');

let content = fs.readFileSync('retro-football/game.js', 'utf8');

const oldDrag = `                const throwVx = -clientDx * 0.1;
                const throwVy = -clientDy * 0.1;
                const throwVz = dist * 0.05; // Arc height proportional to drag distance`;

const newDrag = `                const throwVx = -clientDx * 0.06;
                const throwVy = -clientDy * 0.06;
                const throwVz = dist * 0.15; // Arc height proportional to drag distance`;

const oldSim = `        if (dist > 15) {
            const throwVx = -clientDx * 0.1;
            const throwVy = -clientDy * 0.1;
            const throwVz = dist * 0.05;`;

const newSim = `        if (dist > 15) {
            const throwVx = -clientDx * 0.06;
            const throwVy = -clientDy * 0.06;
            const throwVz = dist * 0.15;`;

const oldSimLoop = `            // Simulate trajectory until it hits the ground
            for (let i = 0; i < 60; i++) {`;

const newSimLoop = `            // Simulate trajectory until it hits the ground
            for (let i = 0; i < 200; i++) {`;

content = content.replace(oldDrag, newDrag);
content = content.replace(oldSim, newSim);
content = content.replace(oldSimLoop, newSimLoop);

fs.writeFileSync('retro-football/game.js', content);
