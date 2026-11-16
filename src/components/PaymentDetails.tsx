import { ClipboardCopy } from 'lucide-react'
import { useState } from 'react'

/**
 * Payment details an administrator has saved in Admin → Settings, shown to a signed-in customer on an old-style request.
 * Nothing is built into the site: bookings are paid on Dodo Payments' checkout.
 */
export function PaymentDetails({ upiId, payeeName }: { upiId: string; payeeName: string }) {
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(upiId)
      setCopied('copied')
    } catch {
      setCopied('failed')
    }
  }

  return (
    <div className="card card--flat pay">
      <dl className="summary">
        <div><dt>UPI ID</dt><dd>{upiId}</dd></div>
        {payeeName && <div><dt>Name on the account</dt><dd>{payeeName}</dd></div>}
      </dl>
      <div className="cluster">
        <button type="button" className="btn btn--ghost btn--sm" onClick={copy}><ClipboardCopy size={16} aria-hidden="true" /> Copy UPI ID</button>
        <span role="status" className="hint">{copied === 'copied' ? 'Copied.' : copied === 'failed' ? 'Couldn’t copy. Please select and copy it.' : ''}</span>
      </div>
    </div>
  )
}
