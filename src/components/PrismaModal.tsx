import { useState } from 'react'
import copyIcon from '../assets/copy.svg'
import downloadIcon from '../assets/download.svg'
import closeIcon from '../assets/cross-rounded.svg'
// import codeIcon from '../assets/code1.svg'
import TemplateModal from './TemplateModal'

interface Props {
  open: boolean
  schema: string
  rawSql?: string
  onClose: () => void
}

export default function PrismaModal({ open, schema, rawSql, onClose }: Props) {
  const [templateOpen, setTemplateOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'prisma' | 'sql'>('prisma')

  if (!open) return null

  const activeContent = activeTab === 'sql' ? (rawSql ?? '') : schema

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeContent)
      // optional: show feedback
    } catch (err) {
      console.error('Copy failed', err)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([activeContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = activeTab === 'sql' ? 'schema.sql' : 'schema.prisma'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="prisma-modal-overlay" role="dialog" aria-modal="true">
      <div className="prisma-modal">
        <div className="prisma-modal-header">
          <div className="prisma-modal-title">schema.prisma</div>
          <div className="prisma-modal-actions">
            <button
              className="btn icon-btn"
              onClick={handleCopy}
              aria-label="Copy schema to clipboard"
              title="Copy"
            >
              <img src={copyIcon} alt="Copy" />
            </button>

            <button
              className="btn icon-btn"
              onClick={handleDownload}
              aria-label="Download schema.prisma"
              title="Download"
            >
              <img src={downloadIcon} alt="Download" />
            </button>

            {/* <button
              className="btn icon-btn"
              onClick={() => setTemplateOpen(true)}
              aria-label="Open template modal"
              title="Template"
            >
              <img src={codeIcon} alt="Generate Template" />
            </button> */}

            <button
              className="btn icon-btn"
              onClick={onClose}
              aria-label="Close modal"
              title="Close"
            >
              <img src={closeIcon} alt="Close" />
            </button>
          </div>
        </div>
        <div className="prisma-modal-body">
          <div className="prisma-modal-tabs">
            <button
              type="button"
              className={`btn${activeTab === 'prisma' ? ' primary' : ''}`}
              onClick={() => setActiveTab('prisma')}
            >
              Prisma
            </button>
            <button
              type="button"
              className={`btn${activeTab === 'sql' ? ' primary' : ''}`}
              onClick={() => setActiveTab('sql')}
            >
              SQL
            </button>
          </div>
          <pre className="prisma-schema-textarea" tabIndex={0}>{activeContent}</pre>
        </div>
      </div>
      <TemplateModal open={templateOpen} schema={schema} onClose={() => setTemplateOpen(false)} />
    </div>
  )
}
