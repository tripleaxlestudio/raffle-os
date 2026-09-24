// Run from repository root. Compare whole TSX ASTs except className/theme hooks.
// This complements runtime tests; it does not certify behavior or visual acceptance.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import ts from 'typescript'
const baseline = 'c6e598ac25653e6d9b4874425d2f39bd9f040ecd'
const files = ['src/pages/operator/DrawSetupPage.tsx','src/pages/operator/DrawSessionQueuePage.tsx','src/pages/operator/DrawRunPage.tsx','src/ui/operator/draw/DrawPresentationSettings.tsx','src/ui/operator/draw/ProductionDrawPresentation.tsx','src/ui/operator/draw/PresentationRecoveryDialog.tsx']
const printer = ts.createPrinter({removeComments:true,newLine:ts.NewLineKind.LineFeed})
function normalized(path, text) {
  const source = ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  const result = ts.transform(source,[context=>{
    function visit(node) {
      if (ts.isImportDeclaration(node) && node.moduleSpecifier.text.endsWith('/ui-theme.ts')) return undefined
      if (ts.isVariableStatement(node) && node.declarationList.declarations.length === 1 && node.declarationList.declarations[0].name.getText(source) === 'uiClass') return undefined
      if (ts.isJsxAttribute(node) && node.name.text === 'className') return undefined
      return ts.visitEachChild(node,visit,context)
    }
    return node=>ts.visitNode(node,visit)
  }])
  const output = printer.printFile(result.transformed[0])
  result.dispose()
  return createHash('sha256').update(output).digest('hex')
}
const results = files.map(path=>{
  const before = normalized(path,execFileSync('git',['show',`${baseline}:${path}`],{encoding:'utf8'}))
  const after = normalized(path,fs.readFileSync(path,'utf8'))
  return {path,before,after,unchanged:before === after}
})
const frozen = ['src/domain','src/application','src/infrastructure','src/app','src/ui/audience','src/pages/display','src/prototype','src/shared','src/styles/operator.css','src/styles/audience.css','src/styles/kocokan/tokens.css','src/styles/kocokan/primitives.css','src/styles/kocokan/shell.css','src/styles/kocokan/preparation.css','src/styles/kocokan/dashboard.css','package.json','package-lock.json']
const frozenChanges = execFileSync('git',['diff','--name-only',baseline,'--',...frozen],{encoding:'utf8'}).trim()
const existingTestChanges = execFileSync('git',['diff','--name-only','--diff-filter=M',baseline,'--','src/**/*.test.*'],{encoding:'utf8'}).trim()
const output = {baseline,method:'Whole TSX AST equality excluding className attributes and useUiClass import/local declarations only. All other code, JSX props, keys, text, handlers, effects and dependencies compared.',results,frozenChanges,existingTestChanges}
fs.writeFileSync('docs/technical/evidence/kocokan-ui-slice3/source-scope.json',JSON.stringify(output,null,2)+'\n')
console.log(JSON.stringify(output,null,2))
if(results.some(row=>!row.unchanged)||frozenChanges||existingTestChanges) process.exitCode=1
