const { spawn } = require('child_process');

const login = spawn('npx', ['expo', 'login', '-u', 'shersingh741730@gmail.com', '-p', '@Expo1234&&$$'], { stdio: 'inherit', shell: process.platform === 'win32' ? true : false });
// On windows shell:true is needed for npx but it can cause escaping issues.
// Let's use `npx.cmd` directly without shell: true
const login2 = spawn('npx.cmd', ['expo', 'login', '-u', 'shersingh741730@gmail.com', '-p', '@Expo1234&&$$'], { stdio: 'inherit', shell: false });
login2.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});
