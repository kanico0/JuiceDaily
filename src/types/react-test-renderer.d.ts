declare module 'react-test-renderer' {
  import React from 'react'
  export function create (element: React.ReactElement): {
    unmount: () => void
    update: (element: React.ReactElement) => void
    toJSON (): any
    toTree (): any
  }
  export function act (callback: () => void | Promise<void>): void | Promise<void>
}
