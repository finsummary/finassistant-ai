'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

type Message = {
  role: 'user' | 'assistant'
  content: string
  framework_step?: string
}

export function AIAssistant({ currentStep }: { currentStep: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)

    // Add user message
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage,
          framework_step: currentStep,
        }),
      })

      const json = await res.json()
      if (!json?.ok) {
        throw new Error(json?.error || 'Failed to get AI response')
      }

      // Add assistant response
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: json.response,
          framework_step: json.framework_step,
        },
      ])
    } catch (e: any) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: `Error: ${e.message || 'Failed to get response from AI assistant.'}`,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const suggestedQuestions = [
    'Explain my current cash position',
    'What changed this month?',
    'What risks should I be aware of?',
    'What should I do next?',
  ]

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>AI Assistant</CardTitle>
        <CardDescription>
          Ask questions about your finances. I'll explain using the {currentStep.toUpperCase()} framework.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-4 min-h-[300px] max-h-[500px]">
          {messages.length === 0 ? (
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Ask me anything about your finances. I can:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Explain your current cash position</li>
                <li>Analyze changes and trends</li>
                <li>Identify risks and opportunities</li>
                <li>Suggest next steps</li>
              </ul>
              <div className="mt-4">
                <p className="mb-2">Try asking:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((q, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setInput(q)
                        setTimeout(() => sendMessage(), 100)
                      }}
                      className="text-xs"
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-sm text-muted-foreground">Thinking...</p>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about your finances..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
