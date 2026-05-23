const { spawn } = require('child_process');
const server = spawn('node', ['dist/server.cjs'], { env: { ...process.env, NODE_ENV: 'production' } });
server.stdout.on('data', data => console.log(`stdout: ${data}`));
server.stderr.on('data', data => console.error(`stderr: ${data}`));
server.on('close', code => console.log(`child process exited with code ${code}`));
setTimeout(() => { server.kill(); process.exit(0); }, 3000);
