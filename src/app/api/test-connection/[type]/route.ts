import { NextRequest, NextResponse } from 'next/server'
import { createOpenAIInstance } from '@/lib/openai'

export async function GET(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  const { type } = params
  const { searchParams } = new URL(request.url)
  const apiKey = searchParams.get('apiKey')

  try {
    if (type === 'openai') {
      // Check if API key is provided
      if (!apiKey) {
        return NextResponse.json({
          success: false,
          message: 'OpenAI API key is required for testing'
        }, { status: 400 })
      }

      // Test OpenAI connection
      const openai = createOpenAIInstance(apiKey)
      
      try {
        // Make a simple test request to verify the API key works
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "user",
              content: "Hello, this is a connection test. Please respond with 'Connection successful'."
            }
          ],
          max_tokens: 10,
        })

        if (response.choices && response.choices.length > 0) {
          return NextResponse.json({
            success: true,
            message: 'OpenAI connection successful!',
            response: response.choices[0].message?.content
          })
        } else {
          return NextResponse.json({
            success: false,
            message: 'OpenAI connection failed - no response received'
          }, { status: 400 })
        }
      } catch (openaiError: any) {
        console.error('OpenAI API Error:', openaiError)
        
        let errorMessage = 'OpenAI connection failed'
        if (openaiError.status === 401) {
          errorMessage = 'Invalid API key'
        } else if (openaiError.status === 429) {
          errorMessage = 'Rate limit exceeded'
        } else if (openaiError.status === 500) {
          errorMessage = 'OpenAI server error'
        } else if (openaiError.message) {
          errorMessage = openaiError.message
        }

        return NextResponse.json({
          success: false,
          message: errorMessage,
          error: openaiError.message
        }, { status: 400 })
      }
    } else if (type === 'shopify') {
      // Test Shopify connection (basic check)
      const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN
      const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN

      if (!shopifyDomain || !shopifyToken) {
        return NextResponse.json({
          success: false,
          message: 'Shopify credentials not configured in environment variables'
        }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        message: 'Shopify environment variables are configured',
        domain: shopifyDomain
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'Invalid connection type'
      }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Connection test error:', error)
    return NextResponse.json({
      success: false,
      message: 'Connection test failed',
      error: error.message
    }, { status: 500 })
  }
}
