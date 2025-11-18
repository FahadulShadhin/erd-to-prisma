interface Props {
  open: boolean
  schema: string
  onClose: () => void
}

export default function PrismaModal({ open, schema, onClose }: Props) {
  if (!open) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(schema)
      // optional: show feedback
    } catch (err) {
      console.error('Copy failed', err)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([schema], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'schema.prisma'
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
            <button className="btn" onClick={handleCopy}>Copy</button>
            <button className="btn" onClick={handleDownload}>Download</button>
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="prisma-modal-body">
          <pre className="prisma-schema-textarea" tabIndex={0}>{schema}</pre>
        </div>
      </div>
    </div>
  )
}
