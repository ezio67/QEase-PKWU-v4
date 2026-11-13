import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GoogleGenAI } from '@google/genai'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3000

interface ChatMessageInput {
  role: 'user' | 'model'
  text: string
}

interface GroundingLink {
  title: string
  uri: string
  reviewSnippet?: string
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  })
}

function buildSmartQueueFallback(
  userMessage: string,
  queueContext: Array<{
    slug: string
    name: string
    category: string
    location: string
    hours: string
    queueStatus: string
    activeStaffCount: number
    freeStaffCount: number
    nowServing: {
      ticketId: string
      customerName: string
      serviceName: string | null
      staffName: string | null
      elapsedMinutes: number
      totalDurationMinutes: number
      minutesLeftToFinish: number
    } | null
    calledNow: { ticketId: string; customerName: string } | null
    nextInLine: { ticketId: string; customerName: string; status: string } | null
    waitingCount: number
    waitingTickets: Array<{ position: number; ticketId: string; customerName: string; status: string; service: string }>
    services: Array<{ name: string; durationMinutes: number; priceRupiah: number }>
  }> = [],
): string {
  if (!queueContext.length) {
    return 'QEase helps you join local walk-in queues virtually and track your Return Window in real time.'
  }

  const lower = userMessage.toLowerCase()
  const target =
    lower.includes('wash') || lower.includes('kilap') || lower.includes('car')
      ? queueContext.find((b) => b.slug === 'kilap-car-wash') ?? queueContext[0]
      : queueContext.find((b) => b.slug === 'barber-kawan') ?? queueContext[0]

  if (
    lower.includes('min') ||
    lower.includes('finish') ||
    lower.includes('left') ||
    lower.includes('next') ||
    lower.includes('serving') ||
    lower.includes('wait') ||
    lower.includes('how long')
  ) {
    const lines: string[] = []
    for (const biz of queueContext) {
      if (biz.nowServing) {
        lines.push(
          `**${biz.name}**: Currently serving **${biz.nowServing.ticketId} (${biz.nowServing.customerName})** for *${biz.nowServing.serviceName}*${biz.nowServing.staffName ? ` with ${biz.nowServing.staffName}` : ''}. About **${biz.nowServing.minutesLeftToFinish} min left** to finish (${biz.nowServing.elapsedMinutes} of ${biz.nowServing.totalDurationMinutes} min elapsed).`,
        )
      } else {
        lines.push(`**${biz.name}**: No one is currently in the chair/bay — the team is ready for the next customer immediately!`)
      }
      if (biz.calledNow) {
        lines.push(`• Called now: **${biz.calledNow.ticketId} (${biz.calledNow.customerName})** is checking in.`)
      }
      if (biz.nextInLine) {
        lines.push(
          `• Next in queue: **${biz.nextInLine.ticketId} (${biz.nextInLine.customerName})** (${biz.waitingCount} total waiting, ${biz.freeStaffCount} staff free right now).`,
        )
      }
    }
    return lines.join('\n\n')
  }

  return `Here is the live QEase queue status right now:\n\n• **${target.name}** (${target.location}, ${target.hours}): ${
    target.nowServing
      ? `Serving **${target.nowServing.ticketId} (${target.nowServing.customerName})** with **~${target.nowServing.minutesLeftToFinish} min left** to finish.`
      : 'Ready immediately with 0 min in-service wait.'
  } There are **${target.waitingCount} people** in the waiting line and **${target.freeStaffCount}/${target.activeStaffCount} staff** available.`
}

async function startServer() {
  const app = express()
  app.use(express.json({ limit: '2mb' }))

  app.post('/api/chat', async (req, res) => {
    const {
      messages = [],
      queueContext = [],
      userLocation = null,
      useMaps = false,
    } = req.body as {
      messages?: ChatMessageInput[]
      queueContext?: any[]
      userLocation?: { latitude: number; longitude: number } | null
      useMaps?: boolean
    }

    const latestUserMessage =
      [...messages].reverse().find((m) => m.role === 'user')?.text ?? 'What is the current queue status?'

    const systemInstruction = `You are the official QEase Live Queue & Neighborhood Concierge Assistant.
Your role:
1. Answer questions accurately and concisely about QEase, how virtual Return Windows work, and the exact live queue status for businesses on QEase.
2. When asked how many minutes are left for the current or next person to finish, ALWAYS cite the exact ticket ID, customer name, service name, elapsed minutes, and remaining minutes from the LIVE QUEUE SNAPSHOT below.
3. When the user asks about places nearby (coffee shops, errands, directions, or things to do while waiting in the queue), use Google Maps grounding data to suggest real nearby spots so they can use their wait time well.
4. Keep responses warm, scannable, and under 140 words.

LIVE QUEUE SNAPSHOT (Real-time state from QEase):
${JSON.stringify(queueContext, null, 2)}
${userLocation ? `\nUSER APPROXIMATE LOCATION: lat ${userLocation.latitude}, lng ${userLocation.longitude}` : ''}`

    const ai = getAiClient()
    if (!ai) {
      return res.json({
        reply: buildSmartQueueFallback(latestUserMessage, queueContext),
        groundingLinks: [] as GroundingLink[],
        source: 'live-queue-engine',
      })
    }

    const lowerQuery = latestUserMessage.toLowerCase()
    const shouldUseMapsGrounding =
      Boolean(useMaps) ||
      lowerQuery.includes('near') ||
      lowerQuery.includes('coffee') ||
      lowerQuery.includes('food') ||
      lowerQuery.includes('cafe') ||
      lowerQuery.includes('where') ||
      lowerQuery.includes('map') ||
      lowerQuery.includes('direction') ||
      lowerQuery.includes('around') ||
      lowerQuery.includes('place')

    try {
      const contents = messages.map((msg) => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.text }],
      }))

      const config: Record<string, any> = {
        systemInstruction,
      }

      if (shouldUseMapsGrounding) {
        config.tools = [{ googleMaps: {} }]
        if (userLocation && typeof userLocation.latitude === 'number' && typeof userLocation.longitude === 'number') {
          config.toolConfig = {
            retrievalConfig: {
              latLng: {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
              },
            },
          }
        }
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: contents.length ? contents : [{ role: 'user', parts: [{ text: latestUserMessage }] }],
        config,
      })

      const replyText = response.text || buildSmartQueueFallback(latestUserMessage, queueContext)
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
      const groundingLinks: GroundingLink[] = []

      for (const chunk of chunks as any[]) {
        if (chunk?.maps?.uri) {
          const snippets = chunk.maps.placeAnswerSources?.reviewSnippets
          const firstSnippet = Array.isArray(snippets) && snippets.length > 0
            ? snippets[0]?.reviewText || snippets[0]?.text || undefined
            : undefined
          groundingLinks.push({
            title: chunk.maps.title || 'View on Google Maps',
            uri: chunk.maps.uri,
            reviewSnippet: firstSnippet,
          })
        }
      }

      return res.json({
        reply: replyText,
        groundingLinks,
        source: shouldUseMapsGrounding ? 'gemini-4-hydrogen+maps' : 'gemini-4-hydrogen',
      })
    } catch (error: any) {
      const fallback = buildSmartQueueFallback(latestUserMessage, queueContext)
      return res.json({
        reply: fallback,
        groundingLinks: [] as GroundingLink[],
        source: 'live-queue-fallback',
        warning: error?.message || 'Used local live queue engine.',
      })
    }
  })

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distPath = path.join(__dirname, 'dist')
    app.use(express.static(distPath))
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'))
    })
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QEase full-stack server running on http://localhost:${PORT}`)
  })
}

void startServer()
