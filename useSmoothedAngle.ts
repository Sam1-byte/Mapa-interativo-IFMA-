import { useEffect, useRef, useState } from "react"

const wrap180 = (d: number) => (((d + 180) % 360) + 360) % 360 - 180

/** Eases an angle toward `target` along the shortest path (damps sensor jitter). */
export function useSmoothedAngle(target: number, rate = 0.15) {
  const [angle, setAngle] = useState(target)
  const current = useRef(target)
  const goal = useRef(target)
  const raf = useRef(0)

  useEffect(() => {
    goal.current = target
    if (raf.current) return
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    const step = () => {
      const d = wrap180(goal.current - current.current)
      if (reduce || Math.abs(d) < 0.05) {
        current.current = goal.current
        setAngle(goal.current)
        raf.current = 0
        return
      }
      current.current += d * rate
      setAngle(current.current)
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }, [target, rate])

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      raf.current = 0
    },
    [],
  )

  return angle
}
