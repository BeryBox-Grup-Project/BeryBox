const path = require('path');
const { execFileSync } = require('child_process');
require('dotenv').config({ quiet: true });

module.exports = async () => {
  const cli = path.join(__dirname, 'node_modules/sequelize-cli/lib/sequelize');
  execFileSync(process.execPath, [cli, 'db:migrate', '--env', 'test'], {
    cwd: __dirname,
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    stdio: 'ignore',
  });
};
