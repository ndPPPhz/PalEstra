'use client';

import { useState } from 'react';
import { Button } from '@/ui';

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="secondary"
      className="px-3 py-1.5 text-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          // Clipboard access can be refused (insecure origin, permissions);
          // showing the link lets the coach copy it by hand.
          window.prompt('Copia il link', url);
        }
      }}
    >
      {copied ? 'Copiato' : 'Copia link'}
    </Button>
  );
}
