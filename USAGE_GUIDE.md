# 🚀 Navplan Local Installation - Usage Guide

## ✅ STATUS: RUNNING!

Your Navplan installation is now running successfully!

## 📍 Access Points

- **Main Application**: http://localhost:8080
- **Database Admin (PhpMyAdmin)**: http://localhost:8081
- **Sample Import Files**: `/Users/dewetro1/Documents/Bitbucket/navplan/test_samples/`

## 🎯 How to Use the Waypoint Import Feature

### Step 1: Access Navplan
Open your web browser and go to: **http://localhost:8080**

### Step 2: Navigate to Waypoints
Click on the **"Route & Fuel"** tab in the top navigation bar

### Step 3: Import Your Waypoints

You'll see a new section called **"Import Waypoints"** with:
- A file chooser button
- An "Import" button
- Support for GPX, KML, and FPL files

#### Method 1: Test with Sample Files

I've created sample test files for you:
- `/Users/dewetro1/Documents/Bitbucket/navplan/test_samples/sample_route.gpx`
- `/Users/dewetro1/Documents/Bitbucket/navplan/test_samples/sample_route.kml`
- `/Users/dewetro1/Documents/Bitbucket/navplan/test_samples/sample_route.fpl`

**Steps:**
1. Click "Choose File" in the Import Waypoints section
2. Navigate to the `test_samples` folder
3. Select one of the sample files (try `sample_route.gpx` first)
4. Click the blue "Import" button
5. You'll see a success message and waypoints will appear in the table below!

#### Method 2: Import Your Own Files

1. Click "Choose File"
2. Select any GPX, KML, or FPL file from your computer
3. Click "Import"
4. If you already have waypoints in your route, you'll see a dialog asking:
   - **"Replace"** - Clear current route and load new waypoints
   - **"Append"** - Add new waypoints to the end of your current route
   - **"Cancel"** - Abort the import

### Step 4: View Your Imported Waypoints

After importing, you'll see:
- Waypoints listed in the route table with:
  - Checkpoint names
  - Coordinates (automatically calculated)
  - Distance and bearing between waypoints
  - Fuel calculations
- Waypoints plotted on the map (click "Map" tab)

### Step 5: Export Your Route

Once you have waypoints, you can export them in various formats:
- Click "Export" in the top menu
- Choose your format: PDF, Excel, KML, GPX, FPL, etc.

## 📝 Sample Route Details

The test files contain a VFR route through Swiss airports:
- **LSZB** (Bern-Belp) - Start
- **WP1** (Via waypoint)
- **LSGN** (Grenchen) - Checkpoint  
- **LFSB** (Basel-Mulhouse) - Destination

## 🔧 Docker Management Commands

```bash
# View logs
docker-compose logs -f

# Stop Navplan
docker-compose down

# Restart Navplan
docker-compose restart

# Rebuild after code changes
docker-compose up --build

# Stop and remove everything (including database)
docker-compose down -v
```

## 🐛 Troubleshooting

### Waypoints not appearing?
- Check browser console for errors (F12 → Console tab)
- Verify file format is valid GPX, KML, or FPL
- Try with one of the sample files first

### Import button not working?
- Make sure you've selected a file first
- Check file extension is .gpx, .kml, or .fpl
- Refresh the page and try again

### Database connection errors?
- Wait 10 seconds after starting containers
- Check database is running: `docker-compose ps`
- Restart: `docker-compose restart`

## 📚 Supported File Formats

### GPX (GPS Exchange Format)
- Standard GPS file format
- Supports waypoints, routes, and tracks
- Used by most GPS devices and aviation apps
- **Best for**: General use, multi-point routes

### KML (Keyhole Markup Language)
- Google Earth format
- Supports points and lines
- Great for visualization
- **Best for**: Routes created in Google Earth

### FPL (Garmin Flight Plan)
- Native Garmin format
- Includes airport ICAO codes
- Compatible with Garmin avionics
- **Best for**: Garmin users, IFR planning

## 🎨 Next Steps

1. **Create a route**: Click on the map to add waypoints
2. **Plan fuel**: Enter your aircraft speed and consumption
3. **Save your route**: Login/register to save routes to your account
4. **Export**: Create PDF navigation logs or share with other apps
5. **Explore**: Check METAR/TAF, NOTAMs, and airspace information

## 📞 Support

- GitHub: https://github.com/opacopac/navplan
- Facebook: https://www.facebook.com/navplan.ch
- Email: info@navplan.ch

---

**Enjoy your local Navplan installation with waypoint import! ✈️**

