import { WebSocket } from 'undici'

Reflect.set(globalThis, 'WebSocket', WebSocket)

export class LazyWebSocket {
  static CLOSED = globalThis.WebSocket.CLOSED
  static CLOSING = globalThis.WebSocket.CLOSING
  static CONNECTING = globalThis.WebSocket.CONNECTING
  static OPEN = globalThis.WebSocket.OPEN

  constructor(...args: ConstructorParameters<typeof globalThis.WebSocket>) {
    return new globalThis.WebSocket(...args)
  }
}
