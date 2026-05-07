import indexJsTpl from '../templates/express/index.js?raw'
import indexTsTpl from '../templates/express/index.ts?raw'
import routeJsTpl from '../templates/express/routes/{{modelPlural}}.js?raw'
import routeTsTpl from '../templates/express/routes/{{modelPlural}}.ts?raw'
import controllerJsTpl from '../templates/express/controllers/{{modelLower}}Controller.js?raw'
import controllerTsTpl from '../templates/express/controllers/{{modelLower}}Controller.ts?raw'
import serviceJsTpl from '../templates/express/services/{{modelLower}}Service.js?raw'
import serviceTsTpl from '../templates/express/services/{{modelLower}}Service.ts?raw'
import middlewareJsTpl from '../templates/express/middlewares/errorHandler.js?raw'
import middlewareTsTpl from '../templates/express/middlewares/errorHandler.ts?raw'
import pkgJsTpl from '../templates/express/package.json?raw'
import readmeTpl from '../templates/express/README.md?raw'
import tsconfigTpl from '../templates/express/tsconfig.json?raw'

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

async function getLatestVersion(pkgName: string): Promise<string | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkgName)}/latest`)
    if (!res.ok) return null
    const data = await res.json()
    return data.version || null
  } catch (err) {
    return null
  }
}

export async function generateExpressTemplates(schema: string, options?: { appName?: string, typescript?: boolean }): Promise<Record<string, string>> {
  const appName = options?.appName || 'prisma-express-app'
  const modelNames = extractModelNames(schema)
  const primaryModels = modelNames.length ? modelNames : ['User']

  const files: Record<string, string> = {}
  const varsBase: Record<string, string> = { appName }

  const useTs = !!options?.typescript

  // Build package.json dynamically from the base template and patch for TS when requested
  try {
    const renderedBase = render(pkgJsTpl, varsBase)
    const pkgObj = JSON.parse(renderedBase)

    // determine dependency names to resolve latest versions
    const baseDeps = Object.keys(pkgObj.dependencies || {})
    const devDepsList = useTs ? ['typescript', 'ts-node-dev', '@types/express'] : ['nodemon']

    // resolve latest versions from npm registry (fallback to template values)
    const depPairs = await Promise.all(
      baseDeps.map(async (d) => {
        const latest = await getLatestVersion(d)
        return [d, latest ?? pkgObj.dependencies[d]] as const
      })
    )

    const devPairs = await Promise.all(
      devDepsList.map(async (d) => {
        const latest = await getLatestVersion(d)
        const fallback = d === 'nodemon' ? '^2.0.22' : d === 'typescript' ? '^5.2.2' : d === 'ts-node-dev' ? '^2.0.0' : '^0.0.0'
        return [d, latest ?? fallback] as const
      })
    )

    pkgObj.dependencies = Object.fromEntries(depPairs.map(([k, v]) => [k, `^${String(v).replace(/^\^/, '')}`]))
    pkgObj.devDependencies = Object.fromEntries(devPairs.map(([k, v]) => [k, `^${String(v).replace(/^\^/, '')}`]))

    if (useTs) {
      pkgObj.scripts = {
        start: 'node dist/index.js',
        dev: 'ts-node-dev --respawn --transpile-only src/index.ts',
        build: 'tsc'
      }
    } else {
      pkgObj.scripts = {
        start: 'node src/index.js',
        dev: 'nodemon src/index.js'
      }
    }

    files['package.json'] = JSON.stringify(pkgObj, null, 2)
  } catch (err) {
    files['package.json'] = render(pkgJsTpl, varsBase)
  }
  files['README.md'] = render(readmeTpl, varsBase)
  files['.gitignore'] = 'node_modules\n.env\n'
  files['prisma/schema.prisma'] = schema
  if (useTs) {
    files['tsconfig.json'] = tsconfigTpl
    files['src/index.ts'] = render(indexTsTpl, varsBase)
    files['src/middlewares/errorHandler.ts'] = render(middlewareTsTpl, varsBase)
  } else {
    files['src/index.js'] = render(indexJsTpl, varsBase)
    files['src/middlewares/errorHandler.js'] = render(middlewareJsTpl, varsBase)
  }

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
    if (useTs) {
      files[`src/routes/${modelPlural}.ts`] = render(routeTsTpl, vars)
      files[`src/controllers/${modelLower}Controller.ts`] = render(controllerTsTpl, vars)
      files[`src/services/${modelLower}Service.ts`] = render(serviceTsTpl, vars)
    } else {
      files[`src/routes/${modelPlural}.js`] = render(routeJsTpl, vars)
      files[`src/controllers/${modelLower}Controller.js`] = render(controllerJsTpl, vars)
      files[`src/services/${modelLower}Service.js`] = render(serviceJsTpl, vars)
    }

    registrations.push(`router.use('/${modelPlural}', require('./${modelPlural}'))`)
  }

  if (useTs) {
    files['src/routes/index.ts'] = render(
      `import express from 'express'\nconst router = express.Router()\n\n// Register resource routes here\n${registrations.join('\n')}\n\nexport default router\n`,
      varsBase
    )
  } else {
    files['src/routes/index.js'] = `const express = require('express')\nconst router = express.Router()\n\n// Register resource routes here\n${registrations.join('\n')}\n\nmodule.exports = router\n`
  }

  return files
}

export default generateExpressTemplates
