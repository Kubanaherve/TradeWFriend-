# TradeWFriend+ - Setup Guide

## ✨ What's New

TradeWFriend+ is now a **generic, reusable business management system** (no longer jewelry-specific). Here's what changed:

### 🎯 Key Features Added

1. **Editable Business Settings**
   - Set your business name
   - Set initial capital (starting balance)
   - Set target capital (financial goal)
   - All settings are saved and applied throughout the system

2. **Factory Reset Capability**
   - Reset all data (customers, sales, inventory)
   - Preserve your business settings
   - Start fresh with a clean slate

3. **Generic Terminology**
   - Changed from "Jewelry" to generic "Items" and "Products"
   - Works for any type of business
   - Renamed from "Jewelry Ledger" to "TradeWFriend+"

4. **Rebranded for Resale**
   - New app name: TradeWFriend+
   - New app ID: com.tradewfriend.plus
   - Generic messaging and descriptions

---

## 🚀 Getting Started

### First Time Setup

1. **Launch the app** and log in with your PIN
2. **Go to Settings** (gear icon in Dashboard menu)
3. **Configure your business:**
   - Enter your business name
   - Set your initial capital (starting money)
   - Set your target capital (goal amount)
4. **Click "Save Settings"**

### Daily Usage

- **Add Transactions**: Use "Add Debt" to record customer sales or items given out
- **Track Sales**: Record item costs and selling prices
- **Manage Inventory**: Keep track of your stock
- **Monitor Customers**: See who owes you money
- **View Reports**: Check debt alerts and business metrics

---

## 🔄 How It Works Now

### Business Settings (NEW)

All business settings are stored in:
- **Local Storage** (for offline access)
- **Supabase Database** (if connected)

Your settings are:
```json
{
  "businessName": "Your Business Name",
  "initialCapital": 100000,
  "targetCapital": 500000
}
```

### System Persistence

The system automatically:
1. Loads your business settings on launch
2. Displays your business name throughout the app
3. Calculates your progress toward target capital
4. Preserves settings even after factory reset

### Factory Reset Process

When you click "Factory Reset All Data":
- ❌ All customer records are deleted
- ❌ All sales history is deleted
- ❌ All inventory items are deleted
- ❌ All cached data is cleared
- ✅ Your business settings are **preserved**

Perfect for:
- Preparing the app for a new customer setup
- Cleaning up old data
- Starting the year fresh
- Getting the app ready to resell

---

## 📋 Page Changes

### Dashboard
- Now displays your **business name** instead of app name
- Shows your configured **initial capital**
- Settings button added to menu (gear icon)

### Settings Page (NEW)
- Configure business name
- Set initial and target capital
- Factory reset all data
- All changes saved automatically

### All Pages
- Removed jewelry-specific language
- Generic terminology throughout
- Supports any type of business
- Kinyarwanda support maintained

---

## 🛠️ For Developers

### Key Files Modified

**Configuration:**
- `package.json` - App name changed to "trade-wfriend-plus"
- `app.json` - Android/iOS package IDs updated
- `capacitor.config.ts` - App ID: com.tradewfriend.plus
- `index.html` - Title and meta tags updated
- `vite.config.ts` - PWA manifest updated

**Hooks:**
- `src/hooks/useBusinessSettings.ts` - NEW - Manage business settings

**Pages:**
- `src/pages/Settings.tsx` - NEW - Settings management
- `src/pages/Dashboard.tsx` - Updated to show business name
- `src/pages/Auth.tsx` - Updated branding
- `src/pages/Install.tsx` - Updated branding
- `src/pages/Debts.tsx` - PDF header updated

**Libraries:**
- `src/lib/kinyarwanda.ts` - Generic terminology
- `src/lib/debtAlerts.ts` - Updated storage keys
- `src/lib/localAuth.ts` - Updated storage keys

**Routing:**
- `src/App.tsx` - Added /settings route

### Storage Keys (Updated)

**Old Keys:**
```
jewelry_ledger_local_accounts
jewelry_ledger_current_local_account
jeanne_friend_debt_alert_notifications
jeanne_friend_last_active_at
```

**New Keys:**
```
tradewfriend_local_accounts
tradewfriend_current_local_account
tradewfriend_debt_alert_notifications
tradewfriend_last_active_at
tradewfriend_business_settings (NEW)
```

### Hook Usage Example

```typescript
import { useBusinessSettings } from "@/hooks/useBusinessSettings";

export const MyComponent = () => {
  const { settings, loading, updateSettings } = useBusinessSettings();
  
  // Access settings
  console.log(settings.businessName);
  console.log(settings.initialCapital);
  
  // Update settings
  updateSettings({
    businessName: "New Name"
  });
  
  return <div>{settings.businessName}</div>;
};
```

---

## 📱 Customization Ideas

### Easy Customizations

1. **Change the emoji** in Dashboard header (currently 📊)
2. **Modify colors** in Settings page
3. **Add more business fields** in useBusinessSettings
4. **Customize factory reset** - choose what to delete
5. **Add currency selection** to business settings

### Advanced Customizations

1. **Multi-currency support** - Store currency in settings
2. **Business categories** - Add business type selection
3. **Team members** - Add user management
4. **Export data** - Add CSV/Excel export
5. **Cloud sync** - Full Supabase integration

---

## 🔐 Security Notes

- PIN-based authentication (6 digits)
- Local storage encrypted with SHA-256
- Supabase integration available
- Offline-first capability
- Session timeout: 10 hours

---

## 🚢 Ready to Ship

This system is now:
- ✅ Generic (not jewelry-specific)
- ✅ Reusable (any business type)
- ✅ Customizable (business settings)
- ✅ Resettable (factory reset)
- ✅ Production-ready

You can package and sell this as a white-label solution!

---

## 📞 Support

For issues or questions:
1. Check Settings page for configuration
2. Verify business settings are saved
3. Try factory reset if data looks wrong
4. Check browser console for errors (Dev Tools)

---

**Version:** 1.0.0  
**Build Date:** 2024  
**License:** [Your License Here]
