const BLOCKED_SHIFT_SHORTCUTS = new Set(['c', 'i', 'j'])

function isEditableTarget(target) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

function isBlockedShortcut(event) {
  const key = event.key.toLowerCase()
  const hasPrimaryModifier = event.ctrlKey || event.metaKey

  if (event.key === 'F12') return true
  if (hasPrimaryModifier && event.shiftKey && BLOCKED_SHIFT_SHORTCUTS.has(key)) return true
  if (hasPrimaryModifier && key === 'u') return true

  return false
}

export function installSourceDeterrence() {
  if (typeof document === 'undefined') return () => {}

  const onContextMenu = (event) => {
    if (isEditableTarget(event.target)) return
    event.preventDefault()
  }

  const onKeyDown = (event) => {
    if (!isBlockedShortcut(event)) return
    event.preventDefault()
    event.stopPropagation()
  }

  document.addEventListener('contextmenu', onContextMenu)
  document.addEventListener('keydown', onKeyDown, true)

  return () => {
    document.removeEventListener('contextmenu', onContextMenu)
    document.removeEventListener('keydown', onKeyDown, true)
  }
}
