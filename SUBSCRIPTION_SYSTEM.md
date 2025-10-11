# Subscription System Documentation

## Overview

The Shopify AI Manager now includes a comprehensive subscription-based system with three pricing tiers designed for different business needs.

## Pricing Plans

### 1. **Free Trial** (2 months)
- **Price**: 0 EGP
- **Duration**: 2 months from registration
- **Features**:
  - Manage 1 shop
  - Unlimited product generations
  - AI-powered product descriptions
  - Image analysis
  - Collection management

### 2. **Basic Plan**
- **Price**: 500 EGP/month
- **Features**:
  - Manage up to 2 shops
  - 50 product generations/month
  - AI-powered product descriptions
  - Image analysis
  - Collection management
  - Priority support

### 3. **Premium Plan**
- **Price**: 750 EGP/month
- **Features**:
  - Unlimited shops
  - Unlimited product generations/month
  - AI-powered product descriptions
  - Image analysis
  - Collection management
  - Priority support
  - Advanced analytics (coming soon)

## Technical Implementation

### Architecture

The subscription system is implemented using Firebase/Firestore for data persistence and React Context for state management.

#### Key Components:

1. **SubscriptionContext** (`src/contexts/SubscriptionContext.tsx`)
   - Manages subscription state
   - Handles plan upgrades
   - Tracks usage (product generations)
   - Enforces limits (shops, product generations)

2. **Firebase Collections**:
   - `subscriptions/{userId}`: Stores user subscription data
   - `usageLogs/{logId}`: Tracks usage events for analytics

### Data Structure

#### Subscription Document (Firestore)
```typescript
{
  plan: 'free' | 'basic' | 'premium',
  status: 'trial' | 'active' | 'expired' | 'cancelled',
  trialEndsAt: Timestamp,
  subscriptionStartDate: Timestamp,
  subscriptionEndDate: Timestamp,
  monthlyProductGenerations: number,
  lastResetDate: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### Usage Log Document (Firestore)
```typescript
{
  userId: string,
  actionType: 'product_generation' | 'shop_connection',
  timestamp: Timestamp,
  metadata: string (JSON)
}
```

### Features

#### 1. **Automatic Trial Creation**
- When a user first signs up, a 2-month free trial is automatically created
- Trial provides full access with a limit of 1 shop

#### 2. **Usage Tracking**
- Product generations are tracked and incremented each time AI analysis is performed
- Monthly counter resets automatically every 30 days
- Usage logs are stored for analytics

#### 3. **Limit Enforcement**
- **Shop Limits**: Users cannot connect more shops than their plan allows
- **Product Generation Limits**: Users cannot generate more products than their monthly limit
- Real-time checks before actions are performed

#### 4. **Trial Expiration**
- System automatically detects when trial period ends
- Users are prompted to upgrade when trial expires
- Warning notifications appear 7 days before expiration

#### 5. **Plan Upgrades**
- Users can upgrade to Basic or Premium at any time
- Upgrades take effect immediately
- New subscription period starts from upgrade date

### User Interface Updates

#### Dashboard
- Displays current subscription plan and status
- Shows product generation usage (current/limit)
- Shows number of shops and maximum allowed
- Displays days remaining in trial
- Warning banners for trial expiration and limit reached

#### Pricing Page (`/pricing`)
- Beautiful card-based layout showing all plans
- Clear feature comparison
- Current plan indication
- One-click upgrade functionality
- FAQ section

#### Add Product Page
- Shows current usage counter
- Prevents product generation when limit is reached
- Clear upgrade prompts when limits are exceeded

#### Connect Shop Page
- Shows connected shops vs. maximum allowed
- Disables "Add Shop" button when limit reached
- Clear messaging about shop limits

#### Sidebar Navigation
- Added "Pricing & Plans" menu item with crown icon
- Easy access to subscription management

### Helper Functions

#### `canAddShop(currentShopCount: number): boolean`
Checks if user can add another shop based on their current plan and shop count.

#### `canGenerateProduct(): boolean`
Checks if user has remaining product generations for the current month.

#### `incrementProductGeneration(): Promise<void>`
Increments the product generation counter and logs the usage.

#### `upgradePlan(plan: SubscriptionPlan): Promise<void>`
Upgrades the user's subscription plan.

#### `isTrialActive(): boolean`
Returns true if user is currently in trial period.

#### `daysLeftInTrial(): number`
Returns the number of days remaining in the trial period.

## Setup Instructions

### 1. Firebase Setup
The subscription system uses existing Firebase configuration. No additional setup needed.

### 2. Automatic Initialization
When a user signs up or logs in:
- System automatically checks for subscription document
- Creates trial subscription if none exists
- Loads existing subscription data if available

### 3. Testing
To test the subscription system:

1. **Test Trial**:
   - Create a new user account
   - Verify 2-month trial is created automatically
   - Check dashboard shows trial status

2. **Test Shop Limits**:
   - Try to add more shops than plan allows
   - Verify error message and upgrade prompt

3. **Test Product Generation Limits**:
   - Generate products until limit is reached (Basic plan)
   - Verify AI analysis is blocked with upgrade prompt

4. **Test Upgrades**:
   - Navigate to Pricing page
   - Click upgrade on a plan
   - Verify plan changes immediately

## Future Enhancements

1. **Payment Integration**
   - Integrate with payment gateway (Stripe, PayPal, local Egyptian payment providers)
   - Automatic subscription renewal
   - Payment history tracking

2. **Admin Panel**
   - Manage user subscriptions
   - View analytics and usage statistics
   - Manual plan adjustments

3. **Advanced Analytics**
   - Usage trends
   - Product performance metrics
   - Shop-level analytics

4. **Email Notifications**
   - Trial expiration reminders
   - Usage limit warnings
   - Successful upgrade confirmations

5. **Promo Codes**
   - Discount codes for special offers
   - Referral bonuses

6. **Annual Plans**
   - Discounted annual subscription options
   - Better value for long-term customers

## Support

For subscription-related issues:
1. Check current plan status on Dashboard
2. Review usage limits on Pricing page
3. Contact support for billing issues

## Notes

- All prices are in Egyptian Pounds (EGP)
- Subscription periods are based on calendar months (30 days)
- Trial period is exactly 2 months from registration date
- Upgrades are immediate and prorated
- Downgrades take effect at the end of current billing period


