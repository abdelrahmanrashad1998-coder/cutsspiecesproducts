import { NextRequest, NextResponse } from 'next/server'

// CORS headers helper
function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  return response
}

// Handle preflight requests
export async function OPTIONS() {
  return addCorsHeaders(new NextResponse(null, { status: 200 }))
}

export async function POST(request: NextRequest) {
  try {
    console.log('Upload request received')
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    
    console.log('Image file:', imageFile ? `${imageFile.name} (${imageFile.size} bytes)` : 'null')
    
    if (!imageFile) {
      console.log('No image file provided')
      const response = NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }

    // Upload to ImgBB - send file directly as binary
    console.log('Uploading to ImgBB...')
    const imgbbFormData = new FormData()
    imgbbFormData.append('key', 'e3b046e22af89c41d5f196ed839b8a9f')
    imgbbFormData.append('image', imageFile)
    
    console.log('FormData contents:', {
      key: 'e3b046e22af89c41d5f196ed839b8a9f',
      imageSize: imageFile.size,
      imageType: imageFile.type,
      imageName: imageFile.name
    })
    
    const imgbbResponse = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: imgbbFormData,
    })
    
    if (!imgbbResponse.ok) {
      console.error('ImgBB upload failed:', imgbbResponse.status, imgbbResponse.statusText)
      const errorText = await imgbbResponse.text()
      console.error('ImgBB error response:', errorText)
      const response = NextResponse.json(
        { error: `Failed to upload to ImgBB: ${imgbbResponse.status} ${imgbbResponse.statusText}` },
        { status: 500 }
      )
      return addCorsHeaders(response)
    }
    
    const imgbbData = await imgbbResponse.json()
    console.log('ImgBB response:', imgbbData)
    
    if (!imgbbData.success) {
      console.error('ImgBB upload failed:', imgbbData.error)
      const response = NextResponse.json(
        { error: `ImgBB upload failed: ${imgbbData.error?.message || 'Unknown error'}` },
        { status: 500 }
      )
      return addCorsHeaders(response)
    }
    
    const publicUrl = imgbbData.data.url
    console.log('Upload successful:', publicUrl)
    
      const response = NextResponse.json({
        success: true,
        url: publicUrl,
        message: 'Image uploaded successfully to ImgBB'
      })
      return addCorsHeaders(response)
    
  } catch (error) {
    console.error('Error uploading image:', error)
    const response = NextResponse.json(
      { error: `Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
    return addCorsHeaders(response)
  }
}