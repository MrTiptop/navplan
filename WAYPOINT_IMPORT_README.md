# Waypoint Import Feature

## Overview

This feature allows users to import waypoints from external files into Navplan. It supports three popular aviation file formats:

- **GPX** (GPS Exchange Format) - Used by many GPS devices and aviation apps
- **KML** (Keyhole Markup Language) - Used by Google Earth and other mapping applications
- **FPL** (Garmin Flight Plan) - Native format for Garmin avionics and apps

## Features

### Import Functionality
- Upload and parse GPX, KML, and FPL files
- Extract waypoints, routes, and track points
- Convert coordinates and elevation data to Navplan format
- Option to append to existing route or replace it

### User Interface
- File upload button in the "Route & Fuel" section
- File format validation
- Success/error messages
- Interactive dialog for append vs. replace choice

## Files Added/Modified

### New Files
1. **php/waypointImport.php** - Backend file upload and parsing
2. **test_samples/sample_route.gpx** - GPX test file
3. **test_samples/sample_route.kml** - KML test file
4. **test_samples/sample_route.fpl** - FPL test file
5. **WAYPOINT_IMPORT_README.md** - This documentation

### Modified Files
1. **waypoints/waypoints.html** - Added import UI
2. **waypoints/waypointCtrl.js** - Added import logic
3. **navplanCtrl.js** - Enhanced dialog support
4. **index.php** - Updated dialog template

## Usage Instructions

### For Users

1. Navigate to the "Route & Fuel" tab in Navplan
2. Click on the "Choose File" button in the "Import Waypoints" section
3. Select a GPX, KML, or FPL file from your device
4. Click the "Import" button
5. If you already have waypoints:
   - Click "Replace" to clear existing waypoints and load the new ones
   - Click "Append" to add the new waypoints to the end of your current route
   - Click "Cancel" to abort the import
6. View your imported waypoints in the route table

### File Format Support

#### GPX Files
The parser supports:
- `<wpt>` elements (individual waypoints)
- `<rte>` and `<rtept>` elements (route waypoints)
- `<trk>` and `<trkpt>` elements (track points - sampled every 10th point)
- Name, description, latitude, longitude, and elevation

#### KML Files
The parser supports:
- `<Placemark>` with `<Point>` (individual waypoints)
- `<Placemark>` with `<LineString>` (route as a line)
- Name, description, and coordinates

#### FPL Files
The parser supports:
- Garmin FPL format
- Airport waypoints (with ICAO codes)
- User waypoints
- Standard waypoints
- VOR/NDB navaids

## Technical Details

### Backend (PHP)

**waypointImport.php** handles:
- File upload validation
- MIME type checking
- XML parsing using SimpleXMLElement
- Error handling and response formatting
- Returns JSON with waypoint array

### Frontend (JavaScript/AngularJS)

**waypointCtrl.js** includes:
- `importWaypoints()` - Handles file upload
- `addImportedWaypoints()` - Adds waypoints to route
- File validation
- FormData API for file upload
- Error handling

### Data Format

Imported waypoints are converted to the Navplan waypoint format:
```javascript
{
  type: 'waypoint' | 'airport',
  checkpoint: 'Name',
  latitude: 46.914100,
  longitude: 7.497100,
  elevation: 510,
  remark: 'Description',
  freq: '',
  callsign: '',
  alt: '',
  isminalt: 0,
  ismaxalt: 0,
  isaltatlegstart: 0,
  supp_info: ''
}
```

## Testing

### Test Files
Sample files are provided in the `test_samples/` directory:
- `sample_route.gpx` - Contains waypoints and routes for Swiss airports
- `sample_route.kml` - Contains the same route in KML format
- `sample_route.fpl` - Contains the same route in Garmin FPL format

### Test Procedure
1. Start the Navplan application
2. Navigate to "Route & Fuel"
3. Import each test file individually
4. Verify waypoints appear correctly
5. Test both "Replace" and "Append" options
6. Verify error handling with invalid files

## Limitations

- Track points are sampled (every 10th point) to avoid importing thousands of points
- Some metadata may not be preserved (e.g., waypoint symbols, colors)
- Airport identification depends on ICAO codes being present
- Large files may take time to process

## Future Enhancements

Possible improvements:
- Support for TCX (Training Center XML) format
- Support for PLN (FSX/MSFS flight plan) format
- Client-side file parsing (no server upload)
- Drag-and-drop file upload
- Batch import of multiple files
- Import preview before adding to route
- Configurable track point sampling rate
- Waypoint deduplication

## Security Considerations

- File size limits enforced by PHP configuration
- File type validation (extension + XML parsing)
- Input sanitization for waypoint data
- User authentication not required (same as other features)
- Files are not stored permanently on the server

## Browser Compatibility

Tested on:
- Chrome/Edge (recommended)
- Firefox
- Safari

Requires:
- File API support
- FormData API support
- XMLHttpRequest Level 2

## Troubleshooting

### "File upload failed"
- Check file size (max 2MB by default)
- Ensure file is a valid GPX, KML, or FPL file
- Check PHP upload settings

### "Unsupported file format"
- File must have .gpx, .kml, or .fpl extension
- File must be valid XML

### "Failed to parse file"
- File may be corrupted
- File may not conform to standard format
- Check XML structure

### Waypoints not appearing
- Check browser console for errors
- Verify file contains valid coordinates
- Try with sample files first

## Support

For issues or questions:
- Check the Navplan GitHub issues
- Contact: info@navplan.ch
- Facebook: https://www.facebook.com/navplan.ch

