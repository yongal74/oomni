type WsHandler = (data: unknown) => void

class OomniWebSocket {
  private ws: WebSocket | null = null
  private handlers = new Map<string, Set<WsHandler>>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private isManualClose = false

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return
    this.ws = new WebSocket('ws://localhost:3001/ws')
    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as { type: string; data: unknown }
        this.handlers.get(msg.type)?.forEach(h => h(msg.data))
      } catch { /* ignore */ }
    }
    this.ws.onclose = () => {
      if (this.isManualClose) return
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null
        this.connect()
      }, 3000)
    }
    this.ws.onerror = () => this.ws?.close()
  }

  on(type: string, handler: WsHandler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(handler)
    return () => this.handlers.get(type)?.delete(handler)
  }

  disconnect() {
    this.isManualClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
    this.isManualClose = false
  }
}

export const oomniWs = new OomniWebSocket()
