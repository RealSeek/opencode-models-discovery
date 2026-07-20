import { resolve4 } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'

async function requestJsonOverIPv4<T>(url: string, timeoutMs: number): Promise<T | undefined> {
  const parsedUrl = new URL(url)
  const addresses = await resolve4(parsedUrl.hostname)
  const address = addresses[0]
  if (!address) return undefined

  return new Promise((resolve) => {
    let settled = false
    const finish = (value: T | undefined) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    const requestOptions: https.RequestOptions = {
      protocol: parsedUrl.protocol,
      hostname: address,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Host: parsedUrl.host,
      },
      timeout: timeoutMs,
      ...(parsedUrl.protocol === 'https:' ? { servername: parsedUrl.hostname } : {}),
    }
    const transport = parsedUrl.protocol === 'https:' ? https : http
    const request = transport.request(requestOptions, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk: string) => body += chunk)
      response.on('end', () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          finish(undefined)
          return
        }

        try {
          finish(JSON.parse(body) as T)
        } catch {
          finish(undefined)
        }
      })
      response.on('error', () => finish(undefined))
    })

    request.on('error', () => finish(undefined))
    request.on('timeout', () => {
      request.destroy()
      finish(undefined)
    })
    request.end()
  })
}

export async function fetchJsonWithIPv4Fallback<T>(url: string, timeoutMs: number): Promise<T | undefined> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    })
    return response.ok ? await response.json() as T : undefined
  } catch {
    try {
      return await requestJsonOverIPv4<T>(url, timeoutMs)
    } catch {
      return undefined
    }
  }
}
