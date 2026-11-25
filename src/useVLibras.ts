import { useEffect } from 'react'

const widgetRoot = 'https://vlibras.gov.br/app'

export function useVLibras(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const root = document.documentElement
    root.setAttribute('data-vlibras-enabled', '')
    if (!document.getElementById('vlibras-script')) {
      const script = document.createElement('script')
      script.id = 'vlibras-script'
      script.async = true
      script.src = `${widgetRoot}/vlibras-plugin.js`
      script.onerror = () => script.remove()
      script.onload = () => {
        const { VLibras } = window as Window & {
          VLibras?: { Widget: new (options: { rootPath: string; position: 'L' }) => unknown }
        }
        if (VLibras) new VLibras.Widget({ rootPath: widgetRoot, position: 'L' })
      }
      document.body.appendChild(script)
    }
    return () => root.removeAttribute('data-vlibras-enabled')
  }, [enabled])
}
