import { createSignal } from "solid-js"

const SERVER_URL = process.env.KNALS_SERVER_URL ?? "http://localhost:8080"

export function useLogStream() {
  const [lines, setLines] = createSignal<string[]>([])
  const [isFollowing, setIsFollowing] = createSignal(true)
  const [isConnected, setIsConnected] = createSignal(false)

  let controller: AbortController | null = null

  async function start(cluster: string, namespace: string, pod: string) {
    stop()
    setLines([])
    setIsFollowing(true)
    setIsConnected(false)

    controller = new AbortController()
    const url = `${SERVER_URL}/clusters/${encodeURIComponent(cluster)}/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(pod)}/logs?follow=true&tailLines=100`

    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok || !response.body) {
        setIsConnected(false)
        return
      }
      setIsConnected(true)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split("\n")
        buffer = parts.pop() ?? ""

        if (parts.length > 0) {
          setLines(prev => [...prev, ...parts])
        }
      }

      if (buffer) {
        setLines(prev => [...prev, buffer])
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setIsConnected(false)
      }
    }
  }

  function stop() {
    if (controller) {
      controller.abort()
      controller = null
    }
    setIsConnected(false)
  }

  function scrollUp() {
    setIsFollowing(false)
  }

  function toggleFollow() {
    setIsFollowing(true)
  }

  return { lines, isFollowing, isConnected, start, stop, scrollUp, toggleFollow }
}
