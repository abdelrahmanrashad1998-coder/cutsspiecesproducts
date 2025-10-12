import OpenAI from 'openai'

// Function to create OpenAI instance using system-wide configuration
export function createOpenAIInstance() {
  const key = process.env.OPENAI_API_KEY
  
  if (!key) {
    throw new Error('OpenAI API key is required. Please set the OPENAI_API_KEY environment variable.')
  }
  
  return new OpenAI({
    apiKey: key,
  })
}

export interface ProductAnalysis {
  title: string
  description: string
  tags: string
  suggestedCollection?: string
}

export async function analyzeProductImages(
  imageUrls: string[],
  model: string = 'gpt-4o',
  storeDescription?: string,
  availableCollections?: any[],
  storeCurrency: string = 'USD'
): Promise<ProductAnalysis> {
  try {

    const openai = createOpenAIInstance()
    
    // Build the prompt with store description context
    let promptText = `You are a professional e-commerce product analyst. You have been provided with ${imageUrls.length} image(s) to analyze. Look at each image carefully and describe exactly what you see.

REQUIRED OUTPUT: You MUST return ONLY a valid JSON object with exactly these keys: title, description, tags, suggestedCollection

1. A compelling, SEO-friendly product title (max 100 characters) based on what's visible in the image
2. A detailed, persuasive product description (2-3 sentences) that describes what you can see and reasonable features
3. Relevant tags separated by commas that describe the product (e.g., "electronics, wireless, premium, bluetooth")
4. A suggested collection name that would be most suitable for this product

CRITICAL: You must analyze the actual image content. Describe only what you can see. If the image is abstract, random, or unclear, describe it as such. Do not invent specific details. For random or abstract images, use generic descriptions like "Abstract Art Print" or "Decorative Wall Art".

Example format:
{
  "title": "Premium Wireless Bluetooth Headphones",
  "description": "Experience crystal-clear audio with these premium wireless headphones featuring noise cancellation and 30-hour battery life. Perfect for music lovers and professionals who demand quality sound.",
  "tags": "electronics, wireless, bluetooth, headphones, premium, noise-cancelling, audio",
  "suggestedCollection": "Electronics & Audio"
}`
    
    if (storeDescription && storeDescription.trim()) {
      promptText += `\n\nSTORE CONTEXT: This product is for a store with the following brand description: "${storeDescription}".

Please tailor the product title, description, and tags to align with this store's brand identity, target audience, and style. Make sure the tone and language match the store's brand voice.`
    }

    if (availableCollections && availableCollections.length > 0) {
      const collectionNames = availableCollections.map(c => c.title).join(', ')
      promptText += `\n\nAVAILABLE COLLECTIONS: The store has the following existing collections: ${collectionNames}

For the suggestedCollection field, you should either:
1. Choose the most suitable existing collection from the list above, OR
2. Suggest a new collection name if none of the existing collections are appropriate

If you suggest an existing collection, use the exact name from the list above. If you suggest a new collection, make sure it's descriptive and fits the store's style.`
    }

    console.log('Sending to OpenAI:', {
      model,
      imageCount: imageUrls.length,
      imageUrls: imageUrls.map(url => url.substring(0, 50) + '...'),
      promptLength: promptText.length,
      storeCurrency,
      hasStoreDescription: !!storeDescription,
      collectionsCount: availableCollections?.length || 0
    })

    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: "You are a professional e-commerce product analyst. You MUST always respond with valid JSON format only. Never refuse to analyze an image. Always provide creative product interpretations. Do not include any text before or after the JSON object."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: promptText
            },
            ...imageUrls.map(url => ({
              type: "image_url" as const,
              image_url: {
                url: url,
                detail: "high" as const
              }
            }))
          ]
        }
      ],
      max_tokens: 800,
      temperature: 0.7,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    console.log('Raw OpenAI response:', content)
    console.log('Response length:', content.length)

    // Clean the response to extract JSON
    const cleanContent = content.trim()
    let jsonContent = cleanContent

    // Try to extract JSON from markdown code blocks
    const jsonMatch = cleanContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (jsonMatch) {
      jsonContent = jsonMatch[1]
    }

    // Try to find JSON object in the response
    const jsonStart = jsonContent.indexOf('{')
    const jsonEnd = jsonContent.lastIndexOf('}')
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1)
    }

    console.log('Cleaned JSON content:', jsonContent)

    // Try to parse the JSON response
    try {
      const analysis = JSON.parse(jsonContent) as ProductAnalysis
      console.log('Successfully parsed JSON:', analysis)
      return analysis
    } catch (parseError) {
      // If JSON parsing fails, try to extract information from text
      console.warn('Failed to parse OpenAI response as JSON, extracting from text')
      console.log('Raw OpenAI response:', content)
      
      // More robust fallback parsing logic using cleaned content
      const titleMatch = jsonContent.match(/"title"\s*:\s*"([^"]+)"/i) || 
                        jsonContent.match(/title[:\s]*["']?([^"'\n,}]+)["']?/i)
      const descriptionMatch = jsonContent.match(/"description"\s*:\s*"([^"]+)"/i) || 
                              jsonContent.match(/description[:\s]*["']?([^"'\n,}]+)["']?/i)
      const tagsMatch = jsonContent.match(/"tags"\s*:\s*"([^"]+)"/i) || 
                       jsonContent.match(/tags[:\s]*["']?([^"'\n,}]+)["']?/i)
      const collectionMatch = jsonContent.match(/"suggestedCollection"\s*:\s*"([^"]+)"/i) || 
                             jsonContent.match(/collection[:\s]*["']?([^"'\n,}]+)["']?/i)

      const result = {
        title: titleMatch?.[1]?.trim() || 'Untitled Product',
        description: descriptionMatch?.[1]?.trim() || 'No description available',
        tags: tagsMatch?.[1]?.trim() || 'general',
        suggestedCollection: collectionMatch?.[1]?.trim() || undefined
      }

      console.log('Fallback parsing result:', result)
      return result
    }
  } catch (error) {
    console.error('Error analyzing product images:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
      
      // Provide more specific error messages
      if (error.message.includes('Timeout while downloading')) {
        throw new Error('Image download timeout - please try with a different image URL')
      }
      if (error.message.includes('invalid_image_url')) {
        throw new Error('Invalid image URL - please upload a valid image')
      }
      if (error.message.includes('rate_limit')) {
        throw new Error('OpenAI rate limit exceeded - please try again later')
      }
    }
    throw new Error('Failed to analyze product images with OpenAI')
  }
}
