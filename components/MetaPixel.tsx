'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

const FB_PIXEL_ID = '836930858768662'

declare global {
  interface Window {
    fbq: (...args: any[]) => void
    _fbq: (...args: any[]) => void
  }
}

export function MetaPixel() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'PageView')
    }
  }, [pathname])

  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '836930858768662');
            fbq('track', 'PageView');
          `,
        }}
      />
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src="https://www.facebook.com/tr?id=836930858768662&ev=PageView&noscript=1"
          alt=""
        />
      </noscript>
    </>
  )
}

/** Dispara quando clica no botão de assinar (checkout Hotmart) */
export function trackInitiateCheckout(value?: number) {
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'InitiateCheckout', {
      value: value || 49.90,
      currency: 'BRL',
      content_name: 'VPS Gestão — Assinatura Mensal',
    })
  }
}

/** Dispara quando completa a compra (webhook Hotmart) */
export function trackPurchase(value?: number, transactionId?: string) {
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'Purchase', {
      value: value || 49.90,
      currency: 'BRL',
      content_name: 'VPS Gestão — Assinatura Mensal',
      ...(transactionId ? { order_id: transactionId } : {}),
    })
  }
}

/** Dispara quando visita a landing page */
export function trackViewContent() {
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'ViewContent', {
      content_name: 'VPS Gestão — Landing Page',
      content_category: 'SaaS ERP Artesanato',
    })
  }
}

/** Dispara quando clica no botão de cadastro */
export function trackLead() {
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'Lead', {
      content_name: 'VPS Gestão — Cadastro',
    })
  }
}
