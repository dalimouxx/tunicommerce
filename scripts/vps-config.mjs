import {readFileSync,statSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {vpsEnvironmentErrors} from './vps-environment.mjs';
try{
 const args=process.argv.slice(2);
 if(args.length!==1||!args[0].startsWith('--file='))throw Error('Usage : node scripts/vps-config.mjs --file=/chemin/prive/.env');
 const path=args[0].slice(7),info=statSync(path);
 if(!info.isFile()||process.platform!=='win32'&&(info.mode&0o077)!==0)throw Error('Le fichier de configuration doit être privé (0600).');
 const errors=vpsEnvironmentErrors(parseEnv(readFileSync(path,'utf8')));
 if(errors.length){for(const error of errors)process.stderr.write(error+'\n');process.exitCode=1;}
 else process.stdout.write('Configuration VPS valide ; aucun secret affiché.\n');
}catch(error){process.stderr.write(error instanceof Error&&error.message.startsWith('Usage')?error.message+'\n':'Configuration VPS illisible ou non privée.\n');process.exitCode=2;}
