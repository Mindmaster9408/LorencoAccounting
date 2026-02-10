# GitHub Pages Deployment Instructions

Your coaching app is now ready to deploy to GitHub Pages!

## Step 1: Create GitHub Repository

1. Go to https://github.com and log in
2. Click the "+" icon in top right → "New repository"
3. Repository name: `coaching-app` (or your preferred name)
4. Description: "The Neuro-Coach Method - 16 Step Coaching Journey"
5. Make it **Public** (required for free GitHub Pages)
6. **DO NOT** initialize with README (you already have one)
7. Click "Create repository"

## Step 2: Push Your Code to GitHub

GitHub will show you commands. Use these in your terminal:

```bash
cd "c:\Users\info\OneDrive\Desktop\Ruan\Coaching app"
git remote add origin https://github.com/YOUR-USERNAME/coaching-app.git
git branch -M main
git push -u origin main
```

Replace `YOUR-USERNAME` with your actual GitHub username.

## Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click "Settings" tab
3. Click "Pages" in left sidebar
4. Under "Source", select "main" branch
5. Click "Save"
6. Wait 1-2 minutes for deployment

## Step 4: Access Your Live App

Your app will be live at:
```
https://YOUR-USERNAME.github.io/coaching-app/
```

## Important Notes

### Data Storage
- Data is stored in browser localStorage (per device)
- Use the Backup & Restore feature regularly
- Each coach/device has separate data

### Updating the App
After making changes locally:
```bash
git add .
git commit -m "Description of changes"
git push
```

Changes will be live in 1-2 minutes.

### Current Limitations (GitHub Pages)
- No PostgreSQL database (localStorage only)
- No multi-user authentication
- Data is device-specific

### Future: Production Deployment
When ready for production with database:
1. Use Railway, Render, or similar hosting
2. Deploy the `/backend` folder
3. Connect PostgreSQL database
4. Enable multi-coach access
5. Permanent data storage

## Troubleshooting

**If site doesn't load:**
- Check that repository is Public
- Ensure GitHub Pages is enabled in Settings
- Wait 5 minutes for first deployment
- Try opening in incognito mode

**If JavaScript doesn't work:**
- Ensure all files were pushed (run `git status`)
- Check browser console for errors (F12)

## Next Steps

1. Test the live site thoroughly
2. Share the URL with other coaches
3. Remind coaches to use Backup & Restore regularly
4. When ready, migrate to production hosting for database support
