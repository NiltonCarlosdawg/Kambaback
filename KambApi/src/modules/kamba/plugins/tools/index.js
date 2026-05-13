const fs = require('fs');
const path = require('path');
const toolRegistry = require('../../services/ai/toolRegistry');

const init = () => {
  const toolsDir = __dirname;
  const files = fs.readdirSync(toolsDir)
    .filter(f => f.endsWith('.js') && f !== 'index.js');

  for (const file of files) {
    const toolConfig = require(path.join(toolsDir, file));
    toolRegistry.register(toolConfig);
    console.log(`[TOOLS] Plugin carregado: ${toolConfig.name} (from ${file})`);
  }

  console.log(`[TOOLS] ${files.length} ferramentas registadas`);
};

module.exports = { init };
