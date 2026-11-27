import { useLayoutEffect, useRef, type ReactNode } from 'react'

const highlightName = 'd2-untyped'

export function AssistantTyping({ active, children }: { active: boolean; children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null)
  const cursor = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const root = content.current
    const caret = cursor.current
    const highlights = window.CSS?.highlights
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!active || !root || !caret || !highlights || typeof Highlight !== 'function' || typeof Intl.Segmenter !== 'function'
      || reducedMotion?.matches || document.documentElement.dataset.motion === 'reduzido') return

    // Animate the rendered text, including Markdown, without changing the document read by assistive technology.
    const segmenter = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' })
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const positions: { node: Text; offset: number }[] = []
    const markers = new Map<HTMLElement, number>()
    let node = walker.nextNode() as Text | null
    while (node) {
      if (node.data.trim()) {
        const item = node.parentElement?.closest('li')
        if (item && !markers.has(item)) markers.set(item, positions.length)
        for (const segment of segmenter.segment(node.data)) {
          positions.push({ node, offset: segment.index + segment.segment.length })
        }
      }
      node = walker.nextNode() as Text | null
    }
    if (!positions.length) return

    const range = document.createRange()
    range.selectNodeContents(root)
    const highlight = new Highlight(range)
    const transcript = root.closest<HTMLElement>('.agenda-assistant-turns')
    const cursorRange = document.createRange()
    const duration = Math.min(2800, 600 + positions.length * 13)
    let started: number | undefined
    let frame = 0
    let last = -1
    let scrollTop = transcript?.scrollTop ?? 0
    let following = true
    highlights.set(highlightName, highlight)
    root.dataset.typing = ''
    markers.forEach((_, item) => { item.dataset.d2Pending = '' })

    function finish() {
      cancelAnimationFrame(frame)
      if (highlights?.get(highlightName) === highlight) highlights.delete(highlightName)
      if (caret) caret.hidden = true
      if (root) delete root.dataset.typing
      markers.forEach((_, item) => { delete item.dataset.d2Pending })
    }

    function reveal(now: number) {
      if (document.documentElement.dataset.motion === 'reduzido') return finish()
      started ??= now
      const visible = Math.floor(positions.length * Math.min(1, (now - started) / duration))
      if (visible === positions.length) return finish()
      if (visible !== last) {
        last = visible
        const position = positions[Math.max(0, visible - 1)]
        const offset = visible ? position.offset : 0
        range.setStart(position.node, offset)
        highlights?.set(highlightName, highlight)
        markers.forEach((start, item) => {
          if (start < visible) delete item.dataset.d2Pending
        })
        cursorRange.setStart(position.node, offset)
        cursorRange.collapse(true)
        const rect = cursorRange.getClientRects?.()[0]
        if (rect && root && caret) {
          const area = root.getBoundingClientRect()
          caret.style.left = Math.min(rect.left - area.left, area.width - 2) + 'px'
          caret.style.top = rect.top - area.top + 'px'
          caret.style.height = rect.height + 'px'
          caret.hidden = false
          if (transcript && following) {
            following = Math.abs(transcript.scrollTop - scrollTop) < 2
            const viewport = transcript.getBoundingClientRect()
            if (following && rect.bottom > viewport.bottom - 10) {
              transcript.scrollTop += rect.bottom - viewport.bottom + 12
              scrollTop = transcript.scrollTop
            }
          }
        }
      }
      frame = requestAnimationFrame(reveal)
    }

    // A link reached through the keyboard should be visible immediately.
    root.addEventListener('focusin', finish)
    reducedMotion?.addEventListener?.('change', finish)
    frame = requestAnimationFrame(reveal)
    return () => {
      finish()
      root.removeEventListener('focusin', finish)
      reducedMotion?.removeEventListener?.('change', finish)
    }
  }, [active])

  return <div ref={content} className="assistant-typing-content">
    {children}
    <i ref={cursor} className="assistant-typing-caret" aria-hidden="true" hidden />
  </div>
}
