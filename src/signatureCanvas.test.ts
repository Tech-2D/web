import { describe, expect, it } from 'vitest'
import { normalizeRotation, resizeLayer, type ShapeLayer } from './signatureCanvas'

describe('signature rotation', () => {
  it('wraps angles in both directions', () => {
    expect(normalizeRotation(-15)).toBe(345)
    expect(normalizeRotation(360)).toBe(0)
    expect(normalizeRotation(725)).toBe(5)
  })

  it('resizes a turned object along its own axes while anchoring the opposite corner', () => {
    const shape: ShapeLayer = { id: 'shape', label: 'Shape', kind: 'shape', color: '#000000', x: 200, y: 100, width: 100, height: 40, rotation: 90 }
    const resized = resizeLayer(shape, -20, 40, { width: 640, height: 400 })
    expect(resized.width).toBe(140)
    expect(resized.height).toBe(60)
    expect(resized.x).toBe(170)
    expect(resized.y).toBe(110)
  })
})
