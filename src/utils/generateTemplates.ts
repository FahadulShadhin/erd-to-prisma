import indexTpl from '../templates/express/index.js?raw'
import routeTpl from '../templates/express/routes/{{modelPlural}}.js?raw'
import controllerTpl from '../templates/express/controllers/{{modelLower}}Controller.js?raw'
import serviceTpl from '../templates/express/services/{{modelLower}}Service.js?raw'
import middlewareTpl from '../templates/express/middlewares/errorHandler.js?raw'
import pkgTpl from '../templates/express/package.json?raw'
import readmeTpl from '../templates/express/README.md?raw'

function render(template: string, vars: Record<string, string>) {
  return template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => vars[key] ?? '')
}

function extractModelNames(schema: string): string[] {
  const re = /model\s+(\w+)\s*\{/gm
  const names: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(schema)) !== null) {
    names.push(m[1])
  }
  return names
}

export function generateExpressTemplates(schema: string, options?: { appName?: string }) {
  const appName = options?.appName || 'prisma-express-app'
  const modelNames = extractModelNames(schema)
  const primaryModels = modelNames.length ? modelNames : ['User']

  const files: Record<string, string> = {}
  const varsBase: Record<string, string> = { appName }

  files['package.json'] = render(pkgTpl, varsBase)
  files['README.md'] = render(readmeTpl, varsBase)
  files['.gitignore'] = 'node_modules\n.env\n'
  files['prisma/schema.prisma'] = schema
  files['src/index.js'] = render(indexTpl, varsBase)
  files['src/middlewares/errorHandler.js'] = render(middlewareTpl, varsBase)

  // Build routes index registrations
  const registrations: string[] = []

  for (const modelName of primaryModels) {
    const modelLower = modelName.toLowerCase()
    const modelPlural = `${modelLower}s`
    const vars: Record<string, string> = {
      ...varsBase,
      modelName,
      modelLower,
      modelPlural,
      modelNameLower: modelLower,
    }

    // render per-model templates
    files[`src/routes/${modelPlural}.js`] = render(routeTpl, vars)
    files[`src/controllers/${modelLower}Controller.js`] = render(controllerTpl, vars)
    files[`src/services/${modelLower}Service.js`] = render(serviceTpl, vars)

    registrations.push(`router.use('/${modelPlural}', require('./${modelPlural}'))`)
  }

  files['src/routes/index.js'] = `const express = require('express')\nconst router = express.Router()\n\n// Register resource routes here\n${registrations.join('\n')}\n\nmodule.exports = router\n`

  return files
}

export default generateExpressTemplates
