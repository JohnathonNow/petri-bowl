const fs = require('fs');

let content = fs.readFileSync('retro-football/game.js', 'utf8');

const newPlayData = `
const offensivePlays = [
    {
        name: "Four Verts",
        routes: {
            wr: [
                [{ dx: 200, dy: 0 }, { dx: 100, dy: 0 }],
                [{ dx: 200, dy: 0 }, { dx: 100, dy: 0 }],
                [{ dx: 200, dy: 0 }, { dx: 100, dy: 0 }]
            ],
            te: [[{ dx: 200, dy: 0 }, { dx: 100, dy: 0 }]],
            rb: [[{ dx: 50, dy: 30 }, { dx: 50, dy: 0 }]]
        }
    },
    {
        name: "Slants",
        routes: {
            wr: [
                [{ dx: 50, dy: 0 }, { dx: 100, dy: 100 }],
                [{ dx: 50, dy: 0 }, { dx: 100, dy: -100 }],
                [{ dx: 50, dy: 0 }, { dx: 100, dy: 100 }]
            ],
            te: [[{ dx: 50, dy: 0 }, { dx: 100, dy: -50 }]],
            rb: [[{ dx: 30, dy: 50 }, { dx: 50, dy: 0 }]]
        }
    },
    {
        name: "Outs",
        routes: {
            wr: [
                [{ dx: 80, dy: 0 }, { dx: 0, dy: -100 }],
                [{ dx: 80, dy: 0 }, { dx: 0, dy: 100 }],
                [{ dx: 60, dy: 0 }, { dx: 0, dy: -80 }]
            ],
            te: [[{ dx: 60, dy: 0 }, { dx: 0, dy: 80 }]],
            rb: [[{ dx: 20, dy: 40 }, { dx: 60, dy: 0 }]]
        }
    }
];
let currentOffensivePlayIndex = 0;
`;

content = content.replace("const GameState = {", newPlayData + "\nconst GameState = {");

fs.writeFileSync('retro-football/game.js', content);
