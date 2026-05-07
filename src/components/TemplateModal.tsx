import { useState } from 'react'
import closeIcon from '../assets/cross-rounded.svg'
import loaderIcon from '../assets/loader.svg'
import generateExpressTemplates from '../utils/generateTemplates'

interface Props {
  open: boolean
  schema: string
  onClose: () => void
}

export default function TemplateModal({ open, schema, onClose }: Props) {
  if (!open) return null
  const [generating, setGenerating] = useState<'js' | 'ts' | null>(null)

  const handleExpress = async (typescript: boolean) => {
    try {
      setGenerating(typescript ? 'ts' : 'js')
      // Generate template files map from schema using selected language
      const files = await generateExpressTemplates(schema, { appName: 'prisma-express-app', typescript })

      // Load JSZip (try local, fallback to CDN if needed)
      let JSZip: any
      try {
        JSZip = (await import('jszip')).default
      } catch (localErr) {
        console.log("ERROR", localErr);
        return
      }

      const zip = new JSZip()
      for (const [path, content] of Object.entries(files)) {
        zip.file(path, content)
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'prisma-express-template.zip'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to generate template', err)
    }
    finally {
      setGenerating(null)
    }
  }

  return (
    <div className="prisma-modal-overlay" role="dialog" aria-modal="true">
      <div className="prisma-modal">
        <div className="prisma-modal-header">
          <div className="prisma-modal-title">Create Project Template</div>
          <div className="prisma-modal-actions">
            <button className="btn icon-btn" onClick={onClose} aria-label="Close" title="Close">
              <img src={closeIcon} alt="Close" />
            </button>
          </div>
        </div>
        <div className="prisma-modal-body">
          <p>Select a template to generate the project boilerplate from your schema.</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn fixed-width-btn"
              onClick={() => handleExpress(false)}
              title="Express + JS"
              disabled={!!generating}
              aria-busy={generating === 'js'}
            >
              {generating === 'js' ? (
                <>
                  <img src={loaderIcon} alt="loading" className="loading-spinner" />
                  Generating...
                </>
              ) : (
                'Express + JS'
              )}
            </button>
            <button
              className="btn fixed-width-btn"
              onClick={() => handleExpress(true)}
              title="Express + TS"
              disabled={!!generating}
              aria-busy={generating === 'ts'}
            >
              {generating === 'ts' ? (
                <>
                  <img src={loaderIcon} alt="loading" className="loading-spinner" />
                  Generating...
                </>
              ) : (
                'Express + TS'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
