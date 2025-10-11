# 🎯 Complete Onboarding Flow Documentation

## User Journey After Login

### Flow Chart:
```
User Logs In
    ↓
Check: Trial Accepted?
    ├─ NO → Show Subscription Modal (BLOCKING)
    │   ↓
    │   User Chooses:
    │   ├─ Free Trial → Accept → trialAccepted = true
    │   ├─ Basic Plan → Upgrade → trialAccepted = true
    │   └─ Premium Plan → Upgrade → trialAccepted = true
    │
    ↓
Trial Accepted ✅
    ↓
Check: Has Shops?
    ├─ NO → Show First Shop Modal → Redirect to /connect-shop
    └─ YES → Redirect to /dashboard
```

---

## Modal Sequence

### 1️⃣ **Subscription Modal** (First Time Only)
**When:** User hasn't accepted trial yet (`trialAccepted === false`)  
**Where:** Appears on ANY page after login  
**Can Close:** ❌ NO - MANDATORY  

**User Options:**
- **Start Free Trial** 🎁
  - 1 shop
  - 20 products/month
  - 2 months free
  - Email verification required (7 days)
  
- **Choose Basic** (500 EGP/mo)
  - 2 shops
  - 50 products/month
  - No email verification needed
  
- **Choose Premium** (750 EGP/mo)
  - Unlimited shops
  - Unlimited products
  - No email verification needed

**After Selection:**
- `trialAccepted` → true
- Modal closes
- Next modal appears...

---

### 2️⃣ **First Shop Onboarding Modal** (If No Shops)
**When:** 
- Trial accepted ✅
- User has 0 shops
- User is on `/dashboard` page

**Where:** Only on dashboard (not on /connect-shop or /pricing)  
**Can Close:** ✅ YES - has "I'll do this later" option

**User Options:**
- **Connect My First Shop** → Redirects to `/connect-shop`
- **I'll do this later** → Stays on dashboard

**Why This Modal:**
- Guides new users to set up their first shop
- Explains what they can do after connecting
- Shows quick 3-step setup guide
- Not blocking - user can skip

---

## Smart Redirect Logic

### Scenario 1: Brand New User
```
Login → Subscription Modal → Accept Free Trial → 
First Shop Modal → Connect Shop → Dashboard
```

### Scenario 2: New User Who Upgrades
```
Login → Subscription Modal → Choose Premium → 
First Shop Modal → Connect Shop → Dashboard
```

### Scenario 3: Returning User (Has Shops)
```
Login → Dashboard directly (no modals)
```

### Scenario 4: User Who Skipped Shop Setup
```
Login → Dashboard → First Shop Modal → 
Click "I'll do this later" → Dashboard
```

### Scenario 5: User Connects Shop Later
```
Click "Manage Shops" in sidebar → 
Connect Shop Page → Add shop → 
First Shop Modal won't show again ✅
```

---

## Technical Implementation

### Files Involved:

1. **SubscriptionOnboardingModal** (`src/components/subscription-onboarding-modal.tsx`)
   - Shows if `trialAccepted === false`
   - Cannot be closed
   - Has 3 plan options
   - Updates Firestore on selection

2. **FirstShopOnboardingModal** (`src/components/first-shop-onboarding-modal.tsx`)
   - Shows if `trialAccepted === true` AND `shops.length === 0`
   - Only on `/dashboard` page
   - Can be dismissed
   - Redirects to `/connect-shop`

3. **DashboardLayout** (`src/components/layout/dashboard-layout.tsx`)
   - Renders both modals
   - Modals handle their own display logic
   - Order: SubscriptionModal → FirstShopModal

### Modal Display Logic:

**SubscriptionModal:**
```typescript
if (!subscription.trialAccepted) {
  return <Modal /> // BLOCKING
}
return null
```

**FirstShopModal:**
```typescript
if (!subscription.trialAccepted) return null  // Wait for subscription modal
if (pathname !== '/dashboard') return null     // Only on dashboard
if (shops.length > 0) return null             // User has shops
if (!open) return null                        // Already dismissed

return <Modal /> // SHOW IT
```

---

## User Experience Benefits

### ✅ Progressive Disclosure
- One step at a time
- Not overwhelming
- Clear progression

### ✅ Smart Context
- Right modal at right time
- No duplicate prompts
- Page-aware (doesn't show on connect-shop page)

### ✅ Flexibility
- Can skip shop setup
- Can connect shop later
- Can upgrade anytime

### ✅ Security
- Subscription modal is mandatory
- Shop modal is optional but helpful
- Email verification enforced

---

## Testing Checklist

### Test 1: New User Flow
- [ ] Create new account
- [ ] Login
- [ ] See subscription modal ✅
- [ ] Click "Start Free Trial"
- [ ] Modal closes
- [ ] See first shop modal ✅
- [ ] Click "Connect My First Shop"
- [ ] Redirected to /connect-shop ✅

### Test 2: Skip Shop Setup
- [ ] Accept trial
- [ ] See first shop modal
- [ ] Click "I'll do this later"
- [ ] Stay on dashboard ✅
- [ ] Refresh page
- [ ] First shop modal appears again ✅

### Test 3: Upgrade Path
- [ ] See subscription modal
- [ ] Click "Choose Premium"
- [ ] Upgraded successfully ✅
- [ ] See first shop modal ✅
- [ ] Connect shop
- [ ] Dashboard accessible ✅

### Test 4: User With Shops
- [ ] User already has shops
- [ ] Login
- [ ] Go to dashboard
- [ ] No first shop modal ✅

### Test 5: Page Navigation
- [ ] Accept trial, see first shop modal
- [ ] Navigate to /connect-shop directly
- [ ] First shop modal should NOT appear ✅
- [ ] Navigate back to /dashboard
- [ ] First shop modal should appear again ✅

---

## Configuration

### Adjust Modal Delays:
```typescript
// In first-shop-onboarding-modal.tsx, line ~48
setTimeout(() => setOpen(true), 500) // Change 500 to desired delay (ms)
```

### Change Which Pages Show First Shop Modal:
```typescript
// In first-shop-onboarding-modal.tsx, line ~76
if (pathname === '/connect-shop' || pathname === '/pricing') return null
// Add more paths to exclude
```

---

## Summary

**Habeby**, your platform now has:
- ✅ **Mandatory subscription modal** (trial acceptance or upgrade)
- ✅ **Helpful first shop modal** (guides users to connect shop)
- ✅ **Smart redirects** (based on shop count)
- ✅ **Page-aware logic** (modals show on right pages)
- ✅ **Beautiful UI** (welcoming, not shocking)
- ✅ **Flexible UX** (can skip shop setup if needed)

The onboarding is now **smooth, smart, and secure**! 🎉

