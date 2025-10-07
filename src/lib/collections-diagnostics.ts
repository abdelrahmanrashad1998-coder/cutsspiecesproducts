/**
 * Diagnostics utility for collections loading issues
 */

export interface CollectionDiagnostic {
  issue: string
  severity: 'high' | 'medium' | 'low'
  solution: string
  canAutoFix?: boolean
}

export interface DiagnosticResult {
  issues: CollectionDiagnostic[]
  recommendations: string[]
  canContinue: boolean
}

/**
 * Diagnose common collections loading issues based on error details
 */
export function diagnoseCollectionIssues(
  errorStatus: number,
  errorMessage: string,
  shopData?: any,
  debugInfo?: any
): DiagnosticResult {
  const issues: CollectionDiagnostic[] = []
  const recommendations: string[] = []

  // Check authentication issues
  if (errorStatus === 401) {
    issues.push({
      issue: 'Authentication Failed',
      severity: 'high',
      solution: 'Your Firebase authentication token has expired or is invalid.',
      canAutoFix: true
    })
    recommendations.push('Please log out and log back in to refresh your authentication.')
  }

  // Check authorization issues
  if (errorStatus === 403) {
    issues.push({
      issue: 'Permission Denied',
      severity: 'high',
      solution: 'Your account does not have permission to access this shop.',
      canAutoFix: false
    })
    recommendations.push('Verify you are trying to access a shop that belongs to you.')
    recommendations.push('If this is your shop, check if it was created under a different account.')
  }

  // Check shop not found
  if (errorStatus === 404) {
    issues.push({
      issue: 'Shop Not Found',
      severity: 'high',
      solution: 'The requested shop does not exist in the database.',
      canAutoFix: false
    })
    recommendations.push('Try reconnecting your Shopify store.')
    recommendations.push('Check if you selected the correct shop from the dropdown.')
  }

  // Check credential issues
  if (errorStatus === 400 && errorMessage.includes('credentials')) {
    issues.push({
      issue: 'Invalid Shop Credentials',
      severity: 'high',
      solution: 'Your Shopify access token is invalid or has expired.',
      canAutoFix: false
    })
    recommendations.push('Update your Shopify access token in the shop settings.')
    recommendations.push('Ensure you are using the correct Shopify shop domain.')
  }

  // Check Shopify API issues
  if (errorStatus === 502 || errorStatus === 503) {
    issues.push({
      issue: 'Shopify API Connection Failed',
      severity: 'medium',
      solution: 'Unable to connect to Shopify servers.',
      canAutoFix: false
    })
    recommendations.push('Check your internet connection.')
    recommendations.push('Verify your Shopify store domain is correct.')
    recommendations.push('Shopify servers might be temporarily unavailable.')
  }

  // Check for domain format issues
  if (shopData?.shopifyDomain && !shopData.shopifyDomain.includes('.myshopify.com')) {
    issues.push({
      issue: 'Invalid Domain Format',
      severity: 'medium',
      solution: 'Your shop domain is not in the correct Shopify format.',
      canAutoFix: true
    })
    recommendations.push('Shop domain should end with .myshopify.com (e.g., your-shop.myshopify.com)')
  }

  // Check for missing access token
  if (shopData && !shopData.shopifyAccessToken) {
    issues.push({
      issue: 'Missing Access Token',
      severity: 'high',
      solution: 'No Shopify access token found for this shop.',
      canAutoFix: false
    })
    recommendations.push('Reconnect your Shopify store to generate a new access token.')
  }

  // Check for short access token (likely incomplete)
  if (shopData?.shopifyAccessToken && shopData.shopifyAccessToken.length < 20) {
    issues.push({
      issue: 'Access Token Too Short',
      severity: 'high',
      solution: 'Your Shopify access token appears to be incomplete.',
      canAutoFix: false
    })
    recommendations.push('Verify you copied the complete access token from Shopify admin.')
    recommendations.push('Access tokens are typically 50+ characters long.')
  }

  // Check for Firestore permission errors
  if (errorMessage.includes('permission-denied') || errorMessage.includes('Firestore security rules')) {
    issues.push({
      issue: 'Firestore Security Rules Not Deployed',
      severity: 'high',
      solution: 'Firestore database security rules need to be deployed.',
      canAutoFix: false
    })
    recommendations.push('Go to Firebase Console → Firestore Database → Rules')
    recommendations.push('Deploy the security rules to allow database access.')
  }

  // Check for network/connection issues
  if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
    issues.push({
      issue: 'Network Connection Problem',
      severity: 'medium',
      solution: 'Unable to connect to the server.',
      canAutoFix: false
    })
    recommendations.push('Check your internet connection.')
    recommendations.push('Try refreshing the page.')
    recommendations.push('Disable ad blockers or VPN that might be blocking requests.')
  }

  // Default case - unknown error
  if (issues.length === 0) {
    issues.push({
      issue: 'Unknown Error',
      severity: 'medium',
      solution: errorMessage || 'An unexpected error occurred.',
      canAutoFix: false
    })
    recommendations.push('Check the browser console for detailed error information.')
    recommendations.push('Try refreshing the page and testing again.')
  }

  const canContinue = issues.filter(i => i.severity === 'high').length === 0

  return {
    issues,
    recommendations,
    canContinue
  }
}

/**
 * Generate a user-friendly diagnostic message
 */
export function generateDiagnosticMessage(diagnostic: DiagnosticResult): string {
  if (diagnostic.issues.length === 0) {
    return 'No issues detected.'
  }

  const highPriorityIssues = diagnostic.issues.filter(i => i.severity === 'high')
  const mediumPriorityIssues = diagnostic.issues.filter(i => i.severity === 'medium')

  let message = ''
  
  if (highPriorityIssues.length > 0) {
    message += 'Critical Issues Found:\n'
    highPriorityIssues.forEach((issue, index) => {
      message += `${index + 1}. ${issue.issue}: ${issue.solution}\n`
    })
    message += '\n'
  }

  if (mediumPriorityIssues.length > 0) {
    message += 'Additional Issues:\n'
    mediumPriorityIssues.forEach((issue, index) => {
      message += `${index + 1}. ${issue.issue}: ${issue.solution}\n`
    })
    message += '\n'
  }

  if (diagnostic.recommendations.length > 0) {
    message += 'Recommendations:\n'
    diagnostic.recommendations.forEach((rec, index) => {
      message += `• ${rec}\n`
    })
  }

  return message
}
