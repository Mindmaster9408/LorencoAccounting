# Recent Updates - The Neuro-Coach Method

## Summary of Changes

This document summarizes all the major updates made to the coaching app.

---

## 1. GitHub Deployment Ready

**Status**: ✅ Complete

The app is now ready to deploy to GitHub Pages for live access anywhere in the world.

### Files Created:
- `.gitignore` - Excludes unnecessary files from version control
- `README.md` - Project documentation
- `DEPLOYMENT.md` - Step-by-step deployment instructions
- Git repository initialized with first commit

### How to Deploy:
1. Create a GitHub repository
2. Push code using commands in DEPLOYMENT.md
3. Enable GitHub Pages in repository settings
4. App will be live at `https://yourusername.github.io/coaching-app/`

### Important Notes:
- GitHub Pages uses localStorage (browser-based storage)
- Each coach/device has separate data
- Use Backup & Restore feature regularly
- For production with database, deploy to Railway/Render later

---

## 2. Settings Page - Company Branding & Report Templates

**Status**: ✅ Complete

New Settings page allows you to customize company branding and report templates.

### Features:

#### Company Details Tab:
- **Company Name** - Used in reports and throughout app
- **Company Logo Upload** - PNG/SVG, max 2MB
  - Appears on reports
  - Shows next to Control Tower on dashboard
  - Replace/remove anytime

#### Report Templates Tab:
- **BASIS Assessment Report**:
  - Custom header text
  - Custom footer text (supports {year}, {companyName}, {coachName} variables)
  - Toggle: Include Coach Name
  - Toggle: Include Date
  - Toggle: Include Page Numbers

- **Progress Report**:
  - Custom header text
  - Custom footer text
  - Toggle options for coach name and date

#### Branding & Colors Tab:
- **Primary Color** (Phase 1) - Default: #3b82f6 (Blue)
- **Secondary Color** (Phase 2) - Default: #8b5cf6 (Purple)
- **Accent Color** (Phase 3) - Default: #ec4899 (Pink)
- Live preview of color changes
- Used in journey phases, reports, and dashboard

### Access:
Navigate to Settings via top navigation or go to `settings.html`

### Files Created:
- `settings.html` - Settings page
- `js/settings.js` - Settings logic
- `css/settings.css` - Settings styling

---

## 3. Client Photo Upload

**Status**: ✅ Complete

Coaches can now upload photos for each client.

### Features:
- Upload client photo in Client Details tab
- Accepts: JPG, PNG, GIF (max 5MB)
- Photo displays:
  - In sidebar when viewing client
  - On client cards (future enhancement)
- Remove photo option
- Fallback: Colored circle with client's initials

### How to Use:
1. Open any client
2. Go to "Details" tab
3. Click "📷 Upload Photo"
4. Select image file
5. Photo saves automatically

### Technical Details:
- Photos stored as base64 in localStorage
- Added `client.photo` field to client data model
- Functions: `handleClientPhotoUpload()`, `removeClientPhoto()`

---

## 4. Client Status Management

**Status**: ✅ Complete

Client status field upgraded from text input to dropdown with predefined statuses.

### Status Options:
1. **Active** - Currently working with client
2. **Archived** - Completed or no longer active
3. **On Hold** - Temporarily paused
4. **Completed** - Journey finished successfully

### Features:
- Dropdown in Client Details tab
- Dashboard automatically filters by status:
  - "Active Clients" tab shows Active/On Hold clients
  - "Past Clients" tab shows Archived/Completed clients
- Update status anytime to move clients between tabs

### Usage:
1. Open client
2. Go to Details tab
3. Select status from dropdown
4. Save details
5. Client appears in appropriate dashboard tab

---

## 5. Journey Structure Updates

**Status**: ✅ Complete

Major restructuring of the 16-step journey.

### Changes:

#### Step 7 Renamed:
- **Old**: "The Dashboard"
- **New**: "The Cockpit" 🎛️
- Description: "Your personal flight control center and metrics dashboard"

#### New Step 8 Added:
- **Personal Driving Dynamics (PDD)** ⚙️
- Phase: Phase 2
- Description: "Understand your core motivators and behavioral drivers"
- Purpose: Reveals what truly motivates you, identifies driving forces, aligns actions with intrinsic motivation

#### Journey Now Has 17 Steps:

**Phase 1: Foundation** (Steps 1-6)
1. 4 Quadrant Exercise ➕
2. Present-Gap-Future 🎯
3. Flight Plan ✈️
4. Deep Dive 🔍
5. Ecochart 🌐
6. Assessments 📊

**Phase 2: Transformation** (Steps 7-12)
7. The Cockpit 🎛️ _(renamed)_
8. Personal Driving Dynamics (PDD) ⚙️ _(NEW)_
9. Psychoeducation 🧠 _(was Step 8)_
10. MLNP 🧬 _(was Step 9)_
11. Reassess 🔄 _(was Step 10)_
12. Revisit ↩️ _(was Step 11)_

**Phase 3: Mastery** (Steps 13-17)
13. The Dream-Spot 💭 _(was Step 12)_
14. Values & Beliefs ⚖️ _(was Step 13)_
15. Success Traits ⛰️ _(was Step 14)_
16. Curiosity, Passion, Purpose 🎯 _(was Step 15)_
17. Creativity and Flow ⚡ _(was Step 16)_

### Files Updated:
- `js/journey-data.js` - Journey structure, step definitions
- `js/journey-exercises.js` - Exercise routing, renamed renderCockpitReview(), added renderPDD()
- `js/journey-helpers.js` - Updated MLNP completion to move to step 11
- `index.html` - Updated step count to 17

### Impact:
- All existing client data remains intact
- Progress percentages recalculated based on 17 steps
- New clients start with 17-step journey
- Step 8 (PDD) currently shows placeholder - ready for your specification

---

## Files Modified Summary

### New Files:
- `.gitignore`
- `README.md`
- `DEPLOYMENT.md`
- `settings.html`
- `js/settings.js`
- `css/settings.css`
- `RECENT_UPDATES.md` (this file)

### Modified Files:
- `js/journey-data.js` - 17 steps, Cockpit rename, PDD added
- `js/journey-exercises.js` - Updated routing, step numbers
- `js/journey-helpers.js` - Updated MLNP completion
- `js/clients.js` - Photo upload, sidebar photo display, status dropdown
- `index.html` - Step count updated to 17

---

## 6. Company Logo Display in Main App

**Status**: ✅ Complete

The uploaded company logo now appears throughout the main application.

### Features:
- **Sidebar Branding**:
  - Company logo displays at top of sidebar (if uploaded)
  - Company name shows below logo
  - Fallback to "Coaching App" text if no logo/name set
  - Logo max size: 150px wide × 40px tall

- **Dashboard Control Tower**:
  - Company logo displays next to "Control Tower" heading
  - Company name replaces "Control Tower" if set
  - Logo max size: 200px wide × 60px tall

- **Automatic Updates**:
  - Branding updates immediately when settings are saved
  - No page reload required
  - Dynamic loading on app initialization

### Files Modified:
- `index.html` - Added IDs to sidebar brand and Control Tower sections
- `js/app.js` - Added `updateCompanyBranding()` function, auto-loads on init
- `js/settings.js` - Calls branding update after saving settings

---

## 7. Drag-and-Drop Photo Uploads

**Status**: ✅ Complete

Both company logo and client photo uploads now support drag-and-drop.

### Company Logo (Settings Page):
- Drag image file over upload area
- Visual feedback: blue border, light blue background, scale animation
- Drop to upload instantly
- Click anywhere on area to browse files
- Support for PNG, JPG, SVG, GIF (max 2MB)

### Client Photos (Client Details):
- Drag image file over photo area
- Visual feedback during drag operation
- Drop to upload and auto-save
- Click area to browse files
- Support for JPG, PNG, GIF (max 5MB)
- Photo displays in circular frame

### Technical Details:
- HTML5 Drag and Drop API
- Event handlers: `dragover`, `drop`, `dragleave`
- Proper `event.preventDefault()` and `stopPropagation()`
- CSS transitions for smooth visual feedback
- FileReader API for base64 encoding
- Automatic re-render after upload

### Files Modified:
- `js/settings.js` - Company logo drag-and-drop handlers
- `css/settings.css` - Drag-over visual styles
- `js/clients.js` - Client photo drag-and-drop handlers

---

## 8. Report Template Download/Upload System

**Status**: ✅ Complete

Coaches can now download, customize, and re-upload report templates.

### Features:
- **Preview Templates**:
  - Opens template in new browser window
  - Shows full report with current branding
  - Includes company logo, colors, header/footer

- **Download as HTML**:
  - Downloads complete HTML file
  - All CSS styles inline (no external dependencies)
  - Edit with any text/code editor
  - Customizable header, footer, colors, layout

- **Upload Modified Template**:
  - Upload edited HTML file
  - Replaces default template
  - Custom template saved to localStorage
  - Used for all future reports

- **Template Types**:
  - BASIS Assessment Report
  - Progress Report
  - Each has independent download/upload

### Usage:
1. Go to Settings → Report Templates
2. Scroll to "Template Management" section
3. Click "Preview" to see current template
4. Click "Download" to get HTML file
5. Edit HTML file with any editor
6. Click "Upload" to replace template
7. Custom template used for all reports

### Variables Supported in Templates:
- `{year}` - Current year
- `{companyName}` - Company name from settings
- `{coachName}` - Current coach's name

### Files Modified:
- `js/settings.js` - Template preview, download, upload functions
- `css/settings.css` - Template button styling

---

## 9. Journey Reporting System

**Status**: ✅ Complete

A comprehensive reporting system that generates detailed reports for individual journey steps and complete journey summaries.

### Features:

#### Individual Step Reports:
- **Generate reports for any journey step** (Steps 1-17)
- Each report includes:
  - Step title, description, and phase
  - Completion status and date
  - All session notes from the coach
  - All AI Coach discussion history
  - Professional formatting with company branding
  - Company logo and colors

#### Comprehensive Journey Report:
- **All-in-one master report** covering the entire 17-step journey
- Includes:
  - Executive summary with statistics
  - Progress overview (steps completed, percentage)
  - All 3 phases organized with phase dividers
  - Every step's notes and AI discussions
  - Completion dates for each step
  - Professional multi-page format
  - Full company branding integration

### How to Use:

**Generate Step Report:**
1. Open any client
2. Go to "Journey Map" tab
3. Click "📄 Step Report" button on any unlocked step
4. Report opens in new window AND downloads automatically

**Generate Comprehensive Report:**
1. Open any client
2. Go to "Journey Map" tab
3. Click "📄 Generate Comprehensive Report" at the top
4. Complete report opens in new window AND downloads

### Report Formats:

Both report types are generated as:
- **HTML files** - Can be opened in any browser
- **Print-ready** - Can be printed or saved as PDF
- **Fully standalone** - All styles inline, no external dependencies
- **Branded** - Uses company logo, colors, and name from settings

### Use Cases:

1. **End of Session Documentation** - Generate step report after each coaching session
2. **Client Handoff** - Comprehensive report when client completes journey
3. **Progress Reviews** - Print reports for client review meetings
4. **Record Keeping** - Archive HTML files for client records
5. **Insurance/Compliance** - Professional documentation of coaching process

### Files Created:
- `js/journey-report-generator.js` - Report generation logic

### Files Modified:
- `js/journey-ui.js` - Added report buttons and generation functions

---

## Next Steps (Recommendations)

1. **Test the app** - Verify all features work correctly
2. **Deploy to GitHub Pages** - Follow DEPLOYMENT.md instructions
3. **Specify Step 8 (PDD)** - What exercises/content for Personal Driving Dynamics?
4. **Complete remaining steps** - Steps 9, 11-17 need exercise content
5. **Production deployment** - When ready for multi-coach use with database

---

## Data Safety Notes

- **GitHub Pages**: Data stored in browser localStorage
  - Use Backup & Restore regularly
  - Each browser/device has separate data
  - Clearing browser data = data loss

- **Production Deployment**: When you deploy to Railway/Render:
  - PostgreSQL database for permanent storage
  - Multi-coach authentication
  - Centralized data management
  - Automatic backups

---

## Questions or Issues?

If you encounter any issues or have questions about these updates:
1. Check the relevant documentation file (README.md, DEPLOYMENT.md)
2. Review this file for feature details
3. Test in a browser to verify functionality

All code is now committed to git and ready for deployment!
