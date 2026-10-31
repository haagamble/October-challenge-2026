const {execFileSync} = require('node:child_process');
const path = require('node:path');
for (const file of ['verify-october.cjs','verify-rest.cjs','verify-pace.cjs','verify-cheerleader.cjs','verify-updates.cjs',
  'verify-months.cjs','verify-month-joining.cjs','verify-auto-cheer.cjs','verify-navigation.cjs','verify-backend.cjs','verify-live-client.cjs','verify-confetti.cjs']) {
  execFileSync(process.execPath,[path.join(__dirname,file)],{stdio:'inherit',cwd:__dirname});
}
console.log('All 12 verification scripts passed. Firebase SDK/emulator verification is a separate check.');
