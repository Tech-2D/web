import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

type Position = { x: number; y: number }
const storageKey = 'tech-2d:assistant-position'
const defaultPosition: Position = { x: 1, y: 1 }
const clamp = (value: number) => Math.max(0, Math.min(1, value))

function readPosition(): Position {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) return { x: clamp(saved.x), y: clamp(saved.y) }
  } catch { /* A blocked or stale preference uses the default position. */ }
  return defaultPosition
}

export function useAssistantLauncherPosition() {
  const [position, setPosition] = useState(readPosition)
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number; initial: Position; moved?: Position } | null>(null)
  const preventClick = useRef(false)

  function save(value: Position) {
    setPosition(value)
    try { localStorage.setItem(storageKey, JSON.stringify(value)) } catch { /* Keep the position for this page. */ }
  }

  const handlers = {
    onPointerDown(event: PointerEvent<HTMLButtonElement>) {
      if (!event.isPrimary || event.button !== 0) return
      const button = event.currentTarget
      const rect = button.getBoundingClientRect()
      preventClick.current = false
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, initial: position }
      button.setPointerCapture(event.pointerId)
    },
    onPointerMove(event: PointerEvent<HTMLButtonElement>) {
      const gesture = drag.current
      const button = event.currentTarget
      const area = button.parentElement?.getBoundingClientRect()
      if (!gesture || gesture.id !== event.pointerId || !area) return
      const dx = event.clientX - gesture.x
      const dy = event.clientY - gesture.y
      if (!gesture.moved && Math.hypot(dx, dy) < 6) return
      const rect = button.getBoundingClientRect()
      gesture.moved = {
        x: clamp((gesture.left + dx - area.left) / Math.max(1, area.width - rect.width)),
        y: clamp((gesture.top + dy - area.top) / Math.max(1, area.height - rect.height)),
      }
      preventClick.current = true
      setPosition(gesture.moved)
    },
    onPointerUp(event: PointerEvent<HTMLButtonElement>) {
      const gesture = drag.current
      if (!gesture || gesture.id !== event.pointerId) return
      if (gesture.moved) save(gesture.moved)
      drag.current = null
    },
    onLostPointerCapture(event: PointerEvent<HTMLButtonElement>) {
      const gesture = drag.current
      if (!gesture || gesture.id !== event.pointerId) return
      if (gesture.moved) setPosition(gesture.initial)
      drag.current = null
    },
    onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
      switch (event.key) {
        case 'ArrowLeft': save({ ...position, x: clamp(position.x - .05) }); break
        case 'ArrowRight': save({ ...position, x: clamp(position.x + .05) }); break
        case 'ArrowUp': save({ ...position, y: clamp(position.y - .05) }); break
        case 'ArrowDown': save({ ...position, y: clamp(position.y + .05) }); break
        case 'Home': save(defaultPosition); break
        default: return
      }
      event.preventDefault()
    },
  }

  function wasDragged(clickCount: number) {
    const dragged = preventClick.current && clickCount > 0
    preventClick.current = false
    return dragged
  }

  return { position, handlers, wasDragged }
}
