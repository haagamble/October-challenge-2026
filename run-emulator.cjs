const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const env={...process.env,FIREBASE_EMULATORS_PATH:path.join(os.tmpdir(),'group-fit-emulators'),XDG_CONFIG_HOME:path.join(os.tmpdir(),'group-fit-firebase-config')};
const portable=path.join(os.tmpdir(),'group-fit-java21');
if(!env.JAVA_HOME && fs.existsSync(portable)) {
  const directory=fs.readdirSync(portable,{withFileTypes:true}).find(entry=>entry.isDirectory());
  if(directory)env.JAVA_HOME=path.join(portable,directory.name);
}
if(env.JAVA_HOME)env.PATH=path.join(env.JAVA_HOME,'bin')+path.delimiter+env.PATH;
const cli=path.join(path.dirname(require.resolve('firebase-tools/package.json')),'lib/bin/firebase.js');
const child=spawn(process.execPath,[cli,'emulators:exec','--only','auth,database','--project','demo-group-fit','node verify-emulator.cjs'],{env,stdio:'inherit',cwd:__dirname});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
