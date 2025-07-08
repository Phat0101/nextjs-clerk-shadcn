# Job Switcher Debugging Guide

## Quick Debugging Steps

### 1. Open Browser Developer Tools
- Press `F12` or right-click and select "Inspect"
- Go to the **Console** tab

### 2. Navigate to a Job Page
- Go to any job page (e.g., `/jobs/[some-job-id]`)
- Look for the job switcher button in the center of the header

### 3. Check Console for Debug Messages
When you click the job switcher button, you should see these messages:

```
🔍 Job data debugging: { myActiveJobs: X, clientJobs: Y, allJobs: Z, ... }
🔽 Job switcher button clicked, current state: true/false
📊 Recent jobs count: X
📋 Recent jobs: [{ id: "...", title: "..." }, ...]
```

### 4. Test Job Selection
When you click on a job in the dropdown, you should see:
```
🔄 Job switcher clicked: { jobId: "...", title: "...", ... }
📍 Navigating to: /jobs/[job-id]
```

## Common Issues and Solutions

### Issue 1: No jobs showing in dropdown
**Symptoms:** Dropdown opens but is empty
**Debug:** Check console for `⚠️ No jobs found in any category`
**Solution:** 
- Verify you have access to jobs (check user permissions)
- Check if Convex queries are working: `myActiveJobs`, `clientJobs`, `allJobs`

### Issue 2: Dropdown doesn't open
**Symptoms:** Clicking button does nothing
**Debug:** Check if you see `🔽 Job switcher button clicked` in console
**Solution:**
- Check if `recentJobs.length > 0` condition is met
- Verify the button click handler is working

### Issue 3: Navigation doesn't work
**Symptoms:** Clicking a job doesn't navigate
**Debug:** Check if you see `📍 Navigating to:` message
**Solution:**
- Verify Next.js router is working
- Check if the job ID is valid

### Issue 4: Dropdown closes immediately
**Symptoms:** Dropdown opens then closes right away
**Debug:** Check click outside handler
**Solution:**
- The `data-job-switcher` attribute should prevent this
- Check if other event handlers are interfering

## Manual Testing Commands

Run these in the browser console to test specific functionality:

```javascript
// Check if job switcher element exists
document.querySelector('[data-job-switcher]')

// Check if dropdown is visible
document.querySelector('[data-job-switcher] .absolute')

// Check how many job buttons are in dropdown
document.querySelectorAll('[data-job-switcher] button').length

// Test navigation manually
window.location.href = '/jobs/[some-job-id]'

// Check current URL
window.location.href
```

## Expected Behavior

1. **Button Click:** Should toggle dropdown and show debug info
2. **Dropdown Content:** Should show list of recent jobs (max 10)
3. **Job Selection:** Should navigate to selected job
4. **Click Outside:** Should close dropdown
5. **Current Job:** Should be highlighted in blue

## If Still Not Working

1. **Check Network Tab:** Verify Convex queries are returning data
2. **Check React DevTools:** Verify component state
3. **Check for Errors:** Look for red error messages in console
4. **Test in Incognito:** Rule out browser cache issues
5. **Check User Permissions:** Verify you have access to the jobs

## Debugging Console Messages

- `🔍 Job data debugging:` - Shows job counts from different sources
- `✅ Using active jobs:` - Shows which job source is being used
- `📋 Final recent jobs:` - Shows the final list of jobs
- `🔽 Job switcher button clicked:` - Confirms button click
- `🔄 Job switcher clicked:` - Confirms job selection
- `📍 Navigating to:` - Confirms navigation attempt 