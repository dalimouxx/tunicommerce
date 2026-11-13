import {readFileSync,writeFileSync} from 'node:fs';
import ts from 'typescript';
// Produce the same Next configuration without shipping TypeScript as a runtime compiler.
const source=readFileSync('next.config.ts','utf8');
const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
if(result.diagnostics?.some(item=>item.category===ts.DiagnosticCategory.Error))throw Error('Container config compilation failed');
writeFileSync('next.config.mjs',result.outputText);
