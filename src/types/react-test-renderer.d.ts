declare module 'react-test-renderer' {
  import React from 'react'
  export function create(_element: React.ReactElement): {
    unmount: () => void
    update: (_element: React.ReactElement) => void
    toJSON(): any
    toTree(): any
  }
  export function act(_callback: () => void | Promise<void>): void | Promise<void>
}
