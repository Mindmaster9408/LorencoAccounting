# 🛡️ Backup System Guide

## Overview

Your coaching app now has a **comprehensive 3-layer backup system** to ensure your client data is never lost:

### 1. **Automatic Local Backups** ⏰
- Runs every **5 minutes** automatically
- Keeps the last **10 backups** in browser localStorage
- Zero configuration needed - works in the background
- Backups are created whenever the app is open

### 2. **Manual File Backups** 💾
- Download your entire database as a JSON file
- Store it on your computer, cloud drive, or external drive
- Can be imported back anytime to restore data
- Perfect for creating restore points before major changes

### 3. **Cross-Device Protection** 🌐
- Each backup file is portable
- Can be imported on any device or browser
- Useful for migrating between computers
- Great for testing changes safely

---

## How to Use

### Accessing Backup Manager

Click the **"🛡️ Backup Manager"** button in the sidebar at the bottom (above the Logout button).

### Quick Actions

#### Create Manual Backup
1. Click **"📦 Create Manual Backup"**
2. A timestamped backup is instantly created
3. Appears in the backup list immediately

#### Download Backup File
1. Click **"💾 Download Backup File"**
2. A JSON file downloads to your computer
3. File name includes your username and timestamp
4. **Store this file safely** - it contains all your client data

#### Import from File
1. Click **"📁 Import from File"**
2. Select a previously downloaded JSON backup file
3. Confirms number of clients imported
4. Automatically redirects to dashboard

#### Restore from Automatic Backup
1. Browse the list of automatic backups
2. Click **"Restore"** on any backup
3. Confirms before replacing current data
4. Redirects to dashboard after restore

---

## Backup Strategy Recommendations

### **Daily Use:**
- Let automatic backups run (no action needed)
- They create backups every 5 minutes while app is open

### **Before Major Changes:**
- Click **"Create Manual Backup"** before:
  - Deleting clients
  - Bulk editing data
  - Testing new features
  - Updating client information

### **Weekly/Monthly:**
- Download a backup file once per week
- Store it in:
  - **Google Drive** ✅ Recommended
  - **OneDrive** ✅ Recommended
  - **Dropbox** ✅ Recommended
  - **External Hard Drive** ✅ Good for extra security
  - **Email to yourself** ✅ Simple but works

### **Before Browser Maintenance:**
- Download backup file before:
  - Clearing browser data
  - Updating browser
  - Switching browsers
  - Reinstalling Windows

---

## What Gets Backed Up?

✅ **All client data:**
- Personal information (name, email, phone, company)
- BASIS assessment results
- Journey progress and completion dates
- Step notes and insights
- Gauges/cockpit values
- Dreams, goals, and stress points
- All custom notes

✅ **Training data:**
- Uploaded documents
- Custom prompts
- Training history

❌ **NOT backed up:**
- User login credentials (these are separate)
- App settings
- Public leads (stored separately)

---

## Recovery Scenarios

### Scenario 1: Accidentally Deleted a Client
**Solution:** Restore from the most recent automatic backup
1. Go to Backup Manager
2. Click "Restore" on the latest backup (top of list)
3. Client data is restored

### Scenario 2: Browser Data Cleared
**Solution:** Import from downloaded file
1. Open backup-manager.html
2. Click "Import from File"
3. Select your saved JSON file
4. All data restored

### Scenario 3: Moving to New Computer
**Solution:** Transfer via backup file
1. On old computer: Download backup file
2. Transfer file to new computer (email, USB, cloud)
3. On new computer: Open app, go to Backup Manager
4. Import the file

### Scenario 4: Want to Undo Recent Changes
**Solution:** Restore from earlier automatic backup
1. Check timestamp of backups in Backup Manager
2. Find one from before the changes
3. Click "Restore"

---

## Storage Information

### Automatic Backups
- **Location:** Browser localStorage
- **Lifespan:** Until browser data is cleared
- **Limit:** 10 most recent backups
- **Size:** Typically 50-500 KB each

### Downloaded Files
- **Location:** Your downloads folder
- **Lifespan:** Forever (until you delete)
- **Limit:** Unlimited
- **Size:** Same as automatic backups

---

## Best Practices

✅ **DO:**
- Download a backup file weekly
- Store backup files in multiple locations
- Create manual backup before bulk operations
- Check Backup Manager occasionally to verify backups exist

❌ **DON'T:**
- Rely only on automatic backups (browser data can be cleared)
- Delete all your backup files
- Ignore backup notifications
- Share backup files (they contain client data)

---

## Security Notes

🔒 **Your backup files contain sensitive client data!**

- Store them securely
- Don't share via unencrypted email
- Use cloud storage with strong passwords
- Consider encrypting backup files if storing on shared drives

---

## Troubleshooting

### "No backups found"
- **Cause:** App hasn't been open for 5 minutes yet
- **Solution:** Wait a few minutes, backups will appear

### "Import failed"
- **Cause:** Corrupted or incompatible file
- **Solution:** Try a different backup file

### "Restore failed"
- **Cause:** Browser storage permission issue
- **Solution:** Refresh page and try again

### Backups taking too much space
- **Solution:** Download a file backup, then click "Delete All Backups" to free space

---

## Summary

✨ **Your data is now protected with:**
1. Automatic backups every 5 minutes
2. Manual backup creation on demand
3. Downloadable file backups for external storage
4. Easy restore from any backup point
5. Cross-device portability

**Remember:** The best backup is one you actually have! Download a file backup regularly and store it somewhere safe.

---

## Quick Reference

| Action | When to Use | Location |
|--------|------------|----------|
| Auto Backup | Automatic - no action needed | Background process |
| Manual Backup | Before risky operations | Backup Manager |
| Download File | Weekly/before browser maintenance | Backup Manager |
| Import File | After data loss or browser reset | Backup Manager |
| Restore Backup | Undo recent changes | Backup Manager |

---

*Last updated: 2026-01-02*
