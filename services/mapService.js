﻿/**
 * Map Service
 */

navplanApp
	.factory('mapService', mapService);

mapService.$inject = ['$http', 'mapFeatureService', 'metarTafNotamService', 'meteoService'];

function mapService($http, mapFeatureService, metarTafNotamService, meteoService)
{
    //region INIT

	var MAX_ZOOMLEVEL = 17;

	var map = undefined;
	var mapLayer,
        wpTrackLayer,
        closeIconLayer,
        airportLayer,
        navaidLayer,
        airspaceLayer,
        reportingpointLayer,
        userWpLayer,
        flightTrackLayer,
        geopointLayer,
        trafficLayer,
        locationLayer,
        weatherLayer,
        webcamLayer,
        notamPolyLayer,
        notamTextLayer,
        meteoBgLayer,
        meteoSmaLayer;
    var airspaceImageLayer;
	var chartLayerCache = new ChartLayerCache();
	var wpCache = new WaypointCache(undefined, undefined, undefined);
	var currentOverlay = undefined;
	var modifySnapInteractions = [];
	var lastOwnPos;
    var centerOwnPosContainer;
    var onFeatureSelectCallback = undefined;
    var onMapClickCallback = undefined;
    var onMoveEndCallback = undefined;
	var onTrackModifyEndCallback = undefined;
	var onMapActivityCallback = undefined;
	var onFullScreenCallback = undefined;
	var onCenterOwnPositionCallback = undefined;
	var isGeopointSelectionActive = false;
	var wgs84Sphere = new ol.Sphere(6378137);
	var minZoomLevel = [];
	var maxAgeSecTrackDots = 120;
	var maxAgeSecInactive = 30;
	var maxTrafficForTrails = 30;
	var adChartBaseUrl = 'php/ad_charts.php?v=' + navplanVersion;
    var displaceAirspaceCat = {
        "CTR": ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        "A": ['E', 'F', 'G'],
        "B": ['E', 'F', 'G'],
        "C": ['E', 'F', 'G'],
        "D": ['E', 'F', 'G']
    };


    // return api reference
	return {
		addOverlay: addOverlay,
		clearAllCharts: clearAllCharts,
		closeOverlay: closeOverlay,
		displayChart: displayChart,
        drawFlightTrack: drawFlightTrack,
        drawGeopointSelection: drawGeopointSelection,
        drawOwnPlane: drawOwnPlane,
        drawMeteoBg: drawMeteoBg,
        drawSmaMeasurements: drawSmaMeasurements,
        drawTraffic: drawTraffic,
        drawWaypoints: drawWaypoints,
        fitViewLatLon: fitViewLatLon,
		getAirport: getAirport,
		getBearing: getBearing,
		getDistance: getDistance,
		getLatLonCoordinates: getLatLonCoordinates,
		getLatLonFromPixel: getLatLonFromPixel,
        getMercatorFromPixel: getMercatorFromPixel,
		getMapPosition: getMapPosition,
		getMercatorCoordinates: getMercatorCoordinates,
		getViewExtentLatLon: getViewExtentLatLon,
		init: init,
        loadAndDrawUserPoints: loadAndDrawUserPoints,
		setMapPosition: setMapPosition,
        updateMapSize: updateMapSize
	};

	//endregion


    // region CLASSES

    function WaypointCache(wps, alternate, variation)
    {
        this.wps = wps;
        this.alternate = alternate;
        this.variation = variation;
    }


    function ChartLayerCache()
    {
        this.chartLayers = [];
    }

    // endregion


    //region INIT MAP
	
	// init map
	function init(mapPos, mapClickCallback, featureSelectCallback, moveEndCallback, trackModEndCallback, mapActivityCallback, toggleFullScreenCallback, centerOwnPositionCallback)
    {
        // set callbacks
        onMapClickCallback = mapClickCallback;
        onFeatureSelectCallback = featureSelectCallback;
        onMoveEndCallback = moveEndCallback;
        onTrackModifyEndCallback = trackModEndCallback;
        onMapActivityCallback = mapActivityCallback;
        onFullScreenCallback = toggleFullScreenCallback;
        onCenterOwnPositionCallback = centerOwnPositionCallback;


        if (map) // re-attach map if it already exists (e.g. from switching views)
        {
            map.setTarget(null);
            map.setTarget("map");
            return;
        }

        // init layers
        mapLayer = createMapLayer();
        locationLayer = createEmptyVectorLayer();
        trafficLayer = createEmptyVectorLayer();
        wpTrackLayer = createEmptyVectorLayer();
        closeIconLayer = createEmptyVectorLayer();
        airportLayer = createEmptyVectorLayer();
        navaidLayer = createEmptyVectorLayer();
        reportingpointLayer = createEmptyVectorLayer();
        userWpLayer = createEmptyVectorLayer();
        airspaceLayer = createEmptyVectorLayer();
        flightTrackLayer = createEmptyVectorLayer();
        webcamLayer = createEmptyVectorLayer();
        weatherLayer = createEmptyVectorLayer();
        geopointLayer = createEmptyVectorLayer();
        notamPolyLayer = createEmptyVectorLayer();
        notamTextLayer = createEmptyVectorLayer();
        meteoBgLayer = createEmptyVectorLayer();
        meteoSmaLayer = createEmptyVectorLayer();
        airspaceImageLayer = createImageVectorLayerFromVectorLayer(airspaceLayer);

        // buttons
        ol.inherits(ZoomButtonsControl, ol.control.Control);
        var zoomButtonsControl =new ZoomButtonsControl();

        ol.inherits(FullScreenButtonControl, ol.control.Control);
        var fsButtonControl = new FullScreenButtonControl();

        ol.inherits(CenterOwnPositionControl, ol.control.Control);
        var centerOwnPosButtonControl = new CenterOwnPositionControl();


        // init map
        map = new ol.Map({
            target: 'map',
            controls: [
                new ol.control.ScaleLine({ units: 'nautical' }),
                fsButtonControl,
                new ol.control.Rotate(),
                new ol.control.Attribution(),
                zoomButtonsControl,
                centerOwnPosButtonControl
            ],
            layers: [
                mapLayer,
                airspaceImageLayer,
                notamPolyLayer,
                webcamLayer,
                closeIconLayer,
                reportingpointLayer,
                userWpLayer,
                navaidLayer,
                airportLayer,
                weatherLayer,
                notamTextLayer,
                meteoBgLayer,
                wpTrackLayer,
                flightTrackLayer,
                trafficLayer,
                meteoSmaLayer,
                geopointLayer,
                locationLayer
            ],
            view: new ol.View(
                {
                    center: mapPos.center,
                    zoom: mapPos.zoom
                })
        });

        // add rotate interaction
        map.addInteraction(new ol.interaction.DragRotateAndZoom());

        // register map events
        map.on('singleclick', onSingleClick);
        map.on('pointermove', onPointerMove);
        map.on('moveend', onMoveEnd);
        map.getView().on('change:rotation', onViewRotation);

        minZoomLevel = [
            {layer: closeIconLayer, minZoom: 9},
            {layer: airportLayer, minZoom: 9},
            {layer: navaidLayer, minZoom: 9},
            {layer: airspaceImageLayer, minZoom: 9},
            {layer: notamPolyLayer, minZoom: 9},
            {layer: notamTextLayer, minZoom: 9},
            {layer: reportingpointLayer, minZoom: 11},
            {layer: userWpLayer, minZoom: 11},
            {layer: webcamLayer, minZoom: 10},
            {layer: trafficLayer, minZoom: 7},
            {layer: meteoBgLayer, minZoom: 9},
            {layer: meteoSmaLayer, minZoom: 9},
            {layer: weatherLayer, minZoom: 9}];

        setLayerVisibility();
    }


    //endregion


    //region LAYERS

    function createEmptyVectorLayer()
    {
        return new ol.layer.Vector({
            source: new ol.source.Vector({})
        });
    }


    function createImageVectorLayerFromVectorLayer(vectorLayer)
    {
        return new ol.layer.Image({
            source: new ol.source.ImageVector({
                source: vectorLayer.getSource()
            })
        });
    }


    function createMapLayer()
    {
        return new ol.layer.Tile({
            source: new ol.source.XYZ({
                tileUrlFunction: getTileUrl,
                minZoom: 0,
                maxZoom: MAX_ZOOMLEVEL,
                crossOrigin: null,
                attributions:
                    [
                        new ol.Attribution({ html: 'Map Data: &copy; <a href="https://openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors <a href="https://creativecommons.org/licenses/by-sa/2.0/" target="_blank">(CC-BY-SA)</a>' }),
                        new ol.Attribution({ html: 'Elevation Data: <a href="https://lta.cr.usgs.gov/SRTM" target="_blank">SRTM</a>' }),
                        new ol.Attribution({ html: 'Map Visualization: <a href="http://www.opentopomap.org/" target="_blank">OpenTopoMap</a> <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank">(CC-BY-SA)</a>' }),
                        new ol.Attribution({ html: 'Aviation Data: <a href="http://www.openaip.net/" target="_blank">openAIP</a> <a href="https://creativecommons.org/licenses/by-nc-sa/3.0/" target="_blank">(BY-NC-SA)</a>' }),
                        new ol.Attribution({ html: 'Traffic Data: <a href="http://wiki.glidernet.org/about" target="_blank">Open Glider Network</a> | <a href="http://www.ADSBexchange.com/" target="_blank">ADSBexchange</a>' }),
                        new ol.Attribution({ html: 'Aerodrome Charts: <a href="http://www.avare.ch/" target="_blank">Avare.ch</a>' }),
                        new ol.Attribution({ html: 'Weather Data: <a href="https://www.aviationweather.gov/" target="_blank">NOAA - Aviation Weather Center</a>' }),
                        new ol.Attribution({ html: 'NOTAM Data: <a href="https://www.icao.int/safety/iStars/pages/intro.aspx" target="_blank">ICAO - iSTARS API Data Service</a>' }),
                        new ol.Attribution({ html: 'Geographical Data: <a href="http://www.geonames.org/" target="_blank">GeoNames</a> <a href="http://creativecommons.org/licenses/by/3.0/" target="_blank">(CC-BY)</a>' }),
                        new ol.Attribution({ html: 'Links to Webcams: all images are digital property of the webcam owners. check the reference for details.' })
                    ]
            })
        });


        function getTileUrl(coordinate)
        {
            var otmBaseUrls = [ "//a.tile.opentopomap.org/", "//b.tile.opentopomap.org/", "//c.tile.opentopomap.org/" ];
            //var otmBaseUrls = [ "//opentopomap.org/", "//opentopomap.org/", "//opentopomap.org/" ];
            var localBaseUrl = "maptiles/";
            var z = coordinate[0];
            var y = coordinate[1];
            var x = (-coordinate[2] - 1);

            //return "https://tile.mapzen.com/mapzen/terrain/v1/normal/" + z + "/" + y + "/" + x + ".png?api_key=mapzen-ECzH36f";
            //return "https://api.mapbox.com/styles/v1/opacopac/cj0msmdwf00ad2snz48faknaq/tiles/256/" + z + "/" + y + "/" + x + "@2x?access_token=pk.eyJ1Ijoib3BhY29wYWMiLCJhIjoiY2owbXNsN3ltMDAwdjMyczZudmt0bGwwdiJ9.RG5N7U6VkoIQ44S-bB-aNg";

            /*if (isBranch())
            {
                // TODO: temp for saving map views
                var email = getCookie("email");

                    if (!(email && isSelf(email)))
                    return "https://api.mapbox.com/styles/v1/opacopac/cj0mxdtd800bx2slaha4b0p68/tiles/256/" + z + "/" + y + "/" + x + "@2x?access_token=pk.eyJ1Ijoib3BhY29wYWMiLCJhIjoiY2oxYjZ6aDQxMDA1ejJ3cGUzbmZ1Zm81eiJ9.oFvbw05OkuQesxOghWqv_A";
            }
            else
                return "https://api.mapbox.com/styles/v1/opacopac/cj0mxdtd800bx2slaha4b0p68/tiles/256/" + z + "/" + y + "/" + x + "@2x?access_token=pk.eyJ1Ijoib3BhY29wYWMiLCJhIjoiY2oxYjdkOXpzMDA2dTMycGV3ZDlkM3R2NyJ9.paBLy_T8QJLELJd8VAAEIw";*/

            if (isLocalTile(z, y, x))
            {
                return localBaseUrl + z + "/" + y + "/" + x + ".png";
            }
            else
            {
                var n = (z + y + x) % otmBaseUrls.length;
                return otmBaseUrls[n] + z + "/" + y + "/" + x + ".png";
            }
        }


        function isLocalTile(z, y, x)
        {
            if (z <= 6)
                return true;

            var zrange = [7, 14];
            var zoomfact = Math.pow(2, (z - 6));
            var yrange = [33 * zoomfact, 33 * zoomfact + zoomfact - 1 ];
            var xrange = [22 * zoomfact, 22 * zoomfact + zoomfact - 1 ];

            if (z < zrange[0] || z > zrange[1])
                return false;

            if (y < yrange[0] || y > yrange[1])
                return false;

            if (x < xrange[0] || x > xrange[1])
                return false;

            return true;
        }
    }


    function setLayerVisibility()
    {
        var zoom = map.getView().getZoom();

        for (var i = 0; i < minZoomLevel.length; i++)
        {
            if (zoom >= minZoomLevel[i].minZoom)
                minZoomLevel[i].layer.setVisible(true);
            else
                minZoomLevel[i].layer.setVisible(false);
        }
    }

    //endregion


    //region DRAW MAP FEATURES

    function drawAirports(airportList)
    {
        airportLayer.getSource().clear();

        for (var i = 0; i < airportList.length; i++) {
            var ap = airportList[i];

            // airport icon
            var adFeature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat([ap.longitude, ap.latitude]))
            });

            adFeature.airport = ap;

            var adStyle = createAdStyle(ap.type, ap.icao);

            if (adStyle)
                adFeature.setStyle(adStyle);
            else
                continue;

            airportLayer.getSource().addFeature(adFeature);


            // rwy icon
            if (ap.runways && ap.runways.length > 0 && ap.type !== "AD_CLOSED" && ap.type !== "HELI_CIVIL" && ap.type !== "HELI_MIL")
            {
                var rwyFeature = new ol.Feature({
                    geometry: new ol.geom.Point(ol.proj.fromLonLat([ap.longitude, ap.latitude]))
                });

                var rwyStyle = createRwyStyle(ap.type, ap.runways[0]);

                if (rwyStyle)
                {
                    rwyFeature.setStyle(rwyStyle);
                    airportLayer.getSource().addFeature(rwyFeature);
                }
            }


            //  parachute feature
            if (ap.mapfeatures && ap.mapfeatures.length > 0 && ap.mapfeatures[0].type === "PARACHUTE")
            {
                var parachuteFeature = new ol.Feature({
                    geometry: new ol.geom.Point(ol.proj.fromLonLat([ap.longitude, ap.latitude]))
                });

                parachuteFeature.airport = ap;

                var parachuteStyle = createParachuteStyle();
                parachuteFeature.setStyle(parachuteStyle);

                airportLayer.getSource().addFeature(parachuteFeature);
            }
        }


        function createAdStyle(ad_type, name)
        {
            var textColor = "#451A57";
            var src;

            if (ad_type === "APT" || ad_type === "INTL_APT")
                src = 'icon/ad_civ.png';
            else if (ad_type === "AF_CIVIL" || ad_type === "GLIDING" || ad_type === "LIGHT_AIRCRAFT" || ad_type === "AF_MOUNTAIN")
                src = 'icon/ad_civ_nofac.png';
            else if (ad_type === "AF_MIL_CIVIL")
                src = 'icon/ad_civmil.png';
            else if (ad_type === "HELI_CIVIL" || ad_type === "HELI_MOUNTAIN" || ad_type === "HELI_HOSPITAL")
                src = 'icon/ad_heli.png';
            else if (ad_type === "HELI_MIL")
                src = 'icon/ad_heli_mil.png';
            else if (ad_type === "AF_WATER")
                src = 'icon/ad_water.png';
            else if (ad_type === "AD_MIL") {
                src = 'icon/ad_mil.png';
                textColor = "#AE1E22";
            }
            else if (ad_type === "AD_CLOSED") {
                src = 'icon/ad_closed.png';
                name = '';
            }
            else
                return;

            return new ol.style.Style({
                image: new ol.style.Icon(({
                    anchor: [0.5, 0.5],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'fraction',
                    scale: 1,
                    opacity: 0.75,
                    src: src
                })),
                text: new ol.style.Text({
                    font: 'bold 14px Calibri,sans-serif',
                    text: name,
                    fill: new ol.style.Fill({color: textColor}),
                    stroke: new ol.style.Stroke({color: "#FFFFFF", width: 2}),
                    offsetX: 0,
                    offsetY: 25
                })
            });
        }


        function createRwyStyle(ad_type, rwy)
        {
            if (!rwy)
                return;

            var src;
            var rwy_surface = rwy.surface ? rwy.surface : undefined;
            var rwy_direction = rwy.direction ? rwy.direction : undefined;

            // no rwy for mountain landing sites
            if (ad_type === "AF_MOUNTAIN" || ad_type === "HELI_MOUNTAIN")
                return;

            if (ad_type === "AD_MIL")
                src = 'icon/rwy_mil.png';
            else if (rwy_surface === "ASPH" || rwy_surface === "CONC")
                src = 'icon/rwy_concrete.png';
            else if (rwy_surface !== "WATE")
                src = 'icon/rwy_grass.png';
            else
                return;

            return new ol.style.Style({
                image: new ol.style.Icon(({
                    anchor: [0.5, 0.5],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'fraction',
                    scale: 1,
                    rotation: (rwy_direction - 45) / 180 * Math.PI,
                    rotateWithView: true,
                    opacity: 0.75,
                    src: src
                }))
            });
        }


        function createParachuteStyle()
        {
            return new ol.style.Style({
                image: new ol.style.Icon(({
                    anchor: [45, 16],
                    anchorXUnits: 'pixels',
                    anchorYUnits: 'pixels',
                    scale: 1,
                    rotateWithView: false,
                    opacity: 0.8,
                    src: 'icon/feature_parachute.png'
                }))
            });
        }
    }


    function drawWeatherInfo(weatherInfoList)
    {
        weatherLayer.getSource().clear();

        if (!weatherInfoList)
            return;

        for (var i = 0; i < weatherInfoList.length; i++)
        {
            var weatherInfo = weatherInfoList[i];
            var icao = weatherInfo.properties.id;
            var ap = mapFeatureService.getAirportByIcao(icao);

            if (!ap)
                continue;
            else
                ap.weatherInfo = weatherInfo;

            // sky conditions
            var skycondFeature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat([ap.longitude, ap.latitude]))
            });

            skycondFeature.weatherInfo = weatherInfo;

            var skycondStyle = createSkycondStyle(weatherInfo);

            if (skycondStyle) {
                skycondFeature.setStyle(skycondStyle);
                weatherLayer.getSource().addFeature(skycondFeature);
            }


            // wind
            var windFeature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat([ap.longitude, ap.latitude]))
            });

            windFeature.weatherInfo = weatherInfo;

            var windStyle = createWindStyle(weatherInfo);

            if (windStyle) {
                windFeature.setStyle(windStyle);
                weatherLayer.getSource().addFeature(windFeature);
            }
        }


        function createSkycondStyle(weatherInfo)
        {
            if (!weatherInfo)
                return;

            var wx_cond = weatherInfo.properties.wx ? weatherInfo.properties.wx : "";
            var src;

            switch (weatherInfo.properties.cover)
            {
                case "CAVOK" :
                case "SKC" :
                case "CLR" :
                case "NSC" :
                    src = "icon/sky_skc.png";
                    break;
                case "FEW" :
                    src = "icon/sky_few.png";
                    break;
                case "SCT" :
                    src = "icon/sky_sct.png";
                    break;
                case "BKN" :
                    src = "icon/sky_bkn.png";
                    break;
                case "OVC" :
                    src = "icon/sky_ovc.png";
                    break;
                default:
                    return;
            }

            return new ol.style.Style({
                image: new ol.style.Icon(({
                    anchor: [-24, 20],
                    anchorXUnits: 'pixels',
                    anchorYUnits: 'pixels',
                    scale: 1,
                    //opacity: 0.75,
                    src: src
                })),
                text: new ol.style.Text({
                    textAlign: "end",
                    textBaseline: "baseline",
                    font: '13px Calibri,sans-serif',
                    text: wx_cond,
                    fill: new ol.style.Fill({color: '#000000'}),
                    stroke: new ol.style.Stroke({color: '#FFFFFF', width: 2}),
                    offsetX: 43,
                    offsetY: -8
                })
            });
        }


        function createWindStyle(weatherInfo)
        {
            if (!weatherInfo)
                return;

            var src;
            var rot = weatherInfo.properties.wdir ? deg2rad(weatherInfo.properties.wdir + 90) + map.getView().getRotation() : undefined;
            var windrange = [[0, "0"], [2, "1-2"], [7, "5"], [12, "10"], [17, "15"], [22, "20"], [27, "25"], [32, "30"], [37, "35"], [42, "40"], [47, "45"], [55, "50"], [65, "60"], [75, "70"], [85, "80"], [95, "90"], [105, "100"]];

            for (var i = 0; i < windrange.length; i++)
            {
                if (weatherInfo.properties.wspd <= windrange[i][0])
                {
                    src = "icon/wind_" + windrange[i][1] + "kt.png";

                    if (i === 0)
                        rot = 0;

                    break;
                }
            }

            if (!src)
                return;

            var anchorX = -15 - 17;
            var anchorY = 5 - 17;
            var fakeX = anchorX * Math.cos(-rot) - anchorY * Math.sin(-rot) + 17;
            var fakeY = anchorX * Math.sin(-rot) + anchorY * Math.cos(-rot) + 17;

            return new ol.style.Style({
                image: new ol.style.Icon(({
                    anchor: [fakeX, fakeY],
                    anchorXUnits: 'pixels',
                    anchorYUnits: 'pixels',
                    //anchor: [0.5, 0.5],
                    //anchorXUnits: 'fraction',
                    //anchorYUnits: 'fraction',
                    scale: 1,
                    rotation: rot,
                    rotateWithView: false,
                    src: src
                }))
            });
        }
    }


    function drawAreaNotams(notamList)
    {
        if (!notamList)
            return;

        var notamBoundariesMer;

        notamPolyLayer.getSource().clear();
        notamTextLayer.getSource().clear();

        for (var i = 0; i < notamList.length; i++)
        {
            var notamPolyFeature, notamTextFeature;
            var notamGeometry = notamList[i].geometry;

            if (!notamGeometry)
            {
                continue;
            }
            else if (notamGeometry.polygon)
            {
                notamBoundariesMer = new ol.geom.Polygon([convertPolygonToMercator(notamGeometry.polygon)]);
                if (!ol.extent.intersects(getViewExtentMercator(), notamBoundariesMer.getExtent()))
                    continue;

                // polygon
                notamPolyFeature = new ol.Feature();
                notamPolyFeature.setGeometry(notamBoundariesMer);
                notamPolyFeature.setStyle(createNotamPolyStyle(notamList[i].id));
                notamPolyLayer.getSource().addFeature(notamPolyFeature);

                // text
                notamTextFeature = new ol.Feature();
                notamTextFeature.setGeometry(notamBoundariesMer.getInteriorPoint());
                notamTextFeature.setStyle(createNotamTextStyle(notamList[i].id));
                notamTextFeature.notam = notamList[i];
                notamTextLayer.getSource().addFeature(notamTextFeature);
            }
            else if (notamGeometry.multipolygon)
            {
                for (var j = 0; j < notamGeometry.multipolygon.length; j++)
                {
                    notamBoundariesMer = new ol.geom.Polygon([convertPolygonToMercator(notamGeometry.multipolygon[j])]);
                    if (!ol.extent.intersects(getViewExtentMercator(), notamBoundariesMer.getExtent()))
                        continue;

                    // polygon
                    notamPolyFeature = new ol.Feature();
                    notamPolyFeature.setGeometry(notamBoundariesMer);
                    notamPolyFeature.setStyle(createNotamPolyStyle(notamList[i].id));
                    notamPolyLayer.getSource().addFeature(notamPolyFeature);

                    // text
                    notamTextFeature = new ol.Feature();
                    notamTextFeature.setGeometry(notamBoundariesMer.getInteriorPoint());
                    notamTextFeature.setStyle(createNotamTextStyle(notamList[i].id));
                    notamTextFeature.notam = notamList[i];
                    notamTextLayer.getSource().addFeature(notamTextFeature);
                }
            }
            else if (notamGeometry.center)
            {
                if (notamGeometry.radius > nautmile2m(50)) // TODO: hide if radius > 50NM => temp hack
                    notamGeometry.radius = 1;
					
				var polycirc = new ol.geom.Polygon.circular(new ol.Sphere(6378137), notamGeometry.center, notamGeometry.radius);
				var polycirc_mer = convertPolygonToMercator(polycirc.getCoordinates()[0]);
				var polycirc_geom = new ol.geom.Polygon([polycirc_mer]);
				
                var centerMer = getMercatorCoordinates(notamGeometry.center[1], notamGeometry.center[0]);
                if (!ol.extent.intersects(getViewExtentMercator(), polycirc_geom.getExtent()))
                    continue;

                // polygon
                notamPolyFeature = new ol.Feature();
                notamPolyFeature.setGeometry(polycirc_geom);
                notamPolyFeature.setStyle(createNotamPolyStyle(notamList[i].id));
                notamPolyLayer.getSource().addFeature(notamPolyFeature);


                // text
                notamTextFeature = new ol.Feature();
                notamTextFeature.setGeometry(new ol.geom.Point(centerMer));
                notamTextFeature.setStyle(createNotamTextStyle(notamList[i].id));
                notamTextFeature.notam = notamList[i];
                notamTextLayer.getSource().addFeature(notamTextFeature);
            }
        }


        function createNotamPolyStyle()
        {
            return new ol.style.Style({
                fill: new ol.style.Fill({
                    color: 'rgba(255, 0, 0, 0.15)'}),
                stroke: new ol.style.Stroke({
                    color: 'rgba(255, 0, 0, 0.8)',
                    width: 3
                })
            });
        }


        function createNotamTextStyle(name)
        {
            return new ol.style.Style({
                fill: new ol.style.Fill({
                    color: 'rgba(0, 0, 0, 0.0)'}),
                stroke: new ol.style.Stroke({
                    color: 'rgba(0, 0, 0, 0.0)',
                    width: 0}),
                text: new ol.style.Text({
                    font: 'bold 14px Calibri,sans-serif',
                    text: name,
                    fill: new ol.style.Fill({color: 'rgba(255, 0, 0, 1.0)'}),
                    stroke: new ol.style.Stroke({color: '#FFFFFF', width: 2}),
                })
            });
        }
    }


    function drawNavaids(navaidList)
    {
        navaidLayer.getSource().clear();

        for (var i = 0; i < navaidList.length; i++) {
            var navaid = navaidList[i];

            var navaidFeature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat([navaid.longitude, navaid.latitude]))
            });

            navaidFeature.navaid = navaid;

            var navaidStyle = createNavaidStyle(navaid.type, navaid.kuerzel);

            if (navaidStyle)
                navaidFeature.setStyle(navaidStyle);
            else
                continue;

            navaidLayer.getSource().addFeature(navaidFeature);


            function createNavaidStyle(navaid_type, name)
            {
                var src, textOffsetY;

                if (navaid_type === "NDB") {
                    src = 'icon/navaid_ndb.png';
                    textOffsetY = 33;
                }
                else if (navaid_type === "VOR-DME" || navaid_type === "DVOR-DME") {
                    src = 'icon/navaid_vor-dme.png';
                    textOffsetY = 20;
                }
                else if (navaid_type === "VOR" || navaid_type === "DVOR") {
                    src = 'icon/navaid_vor.png';
                    textOffsetY = 20;
                }
                else if (navaid_type === "DME") {
                    src = 'icon/navaid_dme.png';
                    textOffsetY = 20;
                }
                else if (navaid_type === "TACAN") {
                    src = 'icon/navaid_tacan.png';
                    textOffsetY = 25;
                }
                else if (navaid_type === "VORTAC" || navaid_type === "DVORTAC") {
                    src = 'icon/navaid_vortac.png';
                    textOffsetY = 25;
                }
                else
                    return;

                return new ol.style.Style({
                    image: new ol.style.Icon(({
                        anchor: [0.5, 0.5],
                        anchorXUnits: 'fraction',
                        anchorYUnits: 'fraction',
                        scale: 1,
                        opacity: 0.75,
                        src: src
                    })),
                    text: new ol.style.Text({
                        //textAlign: align,
                        //textBaseline: baseline,
                        font: 'bold 14px Calibri,sans-serif',
                        text: name,
                        fill: new ol.style.Fill({color: '#451A57'}),
                        stroke: new ol.style.Stroke({color: '#FFFFFF', width: 2}),
                        offsetX: 0,
                        offsetY: textOffsetY
                    })
                });
            }
        }
    }


    function drawReportingPoints(reportingPointList)
    {
        reportingpointLayer.getSource().clear();

        for (var i = 0; i < reportingPointList.length; i++) {
            var rp = reportingPointList[i];

            var feature;

            if (rp.type === "POINT")
                feature = createReportingPointFeature(rp);
            else if (rp.type === "SECTOR")
                feature = createReportingSectorFeature(rp);
            else
                continue;

            feature.reportingpoint = rp;

            reportingpointLayer.getSource().addFeature(feature);
        }


        function createReportingPointFeature(rp)
        {
            var src = "icon/";

            if ((rp.inbd_comp && rp.outbd_comp) || (rp.inbd_comp == null && rp.outbd_comp == null))
                src += "rp_comp.png";
            else if (rp.inbd_comp || rp.outbd_comp)
                src += "rp_inbd.png";
            else
                src += "rp.png";


            var style = new ol.style.Style({
                image: new ol.style.Icon(({
                    anchor: [0.5, 0.5],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'fraction',
                    scale: 1,
                    opacity: 0.75,
                    src: src
                })),
                text: new ol.style.Text({
                    font: 'bold 14px Calibri,sans-serif',
                    text: rp.name,
                    fill: new ol.style.Fill({color: '#0077FF'}),
                    stroke: new ol.style.Stroke({color: '#FFFFFF', width: 2}),
                    offsetX: 0,
                    offsetY: 20
                })
            });


            var feature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat([rp.longitude, rp.latitude]))
            });

            feature.setStyle(style);

            return feature;
        }


        function createReportingSectorFeature(rp)
        {
            var merCoords, lonLat;
            var merPoly = [];

            // convert to mercator
            for (var i = 0; i < rp.polygon.length; i++) {
                lonLat = rp.polygon[i];
                merCoords = ol.proj.fromLonLat(lonLat);
                merPoly.push(merCoords);
            }

            var style = new ol.style.Style({
                fill: new ol.style.Fill({
                    color: 'rgba(124, 47, 215, 0.3)'}),
                stroke: new ol.style.Stroke({
                    color: 'rgba(124, 47, 215, 0.5)',
                    width: 2}),
                text: new ol.style.Text({
                    font: 'bold 14px Calibri,sans-serif',
                    text: rp.name,
                    fill: new ol.style.Fill({color: '#7C4AD7'}),
                    stroke: new ol.style.Stroke({color: '#FFFFFF', width: 2}),
                })
            });

            var feature = new ol.Feature({
                geometry: new ol.geom.Polygon([merPoly])
            });

            feature.setStyle(style);

            return feature;
        }
    }


    function loadAndDrawUserPoints()
    {
        mapFeatureService.loadAllUserPoints(drawUserPoints);
    }


    function drawUserPoints(userpointList)
    {
        if (!userWpLayer)
            return;

        userWpLayer.getSource().clear();

        for (var i = 0; i < userpointList.length; i++)
        {
            var up = userpointList[i];

            var userWpFeature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat([up.longitude, up.latitude]))
            });

            userWpFeature.userWaypoint = up;

            var userWpStyle = createUserPointStyle(up.name);

            if (userWpStyle)
                userWpFeature.setStyle(userWpStyle);
            else
                continue;

            userWpLayer.getSource().addFeature(userWpFeature);
        }


        function createUserPointStyle(name) {
            return new ol.style.Style({
                image: new ol.style.Icon(({
                    anchor: [0.5, 0.5],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'fraction',
                    scale: 1,
                    opacity: 0.75,
                    src: 'icon/wp_user.png'
                })),
                text: new ol.style.Text({
                    font: 'bold 14px Calibri,sans-serif',
                    text: name,
                    fill: new ol.style.Fill({color: '#0077FF'}),
                    stroke: new ol.style.Stroke({color: '#FFFFFF', width: 2}),
                    offsetX: 0,
                    offsetY: 20
                })
            });
        }
    }


    function drawAirspaces(airspaceList)
    {
        airspaceLayer.getSource().clear();

        for (var key in airspaceList)
        {
            var airspace = airspaceList[key];

            convertPolygon(airspace);

            var airspaceFeature = new ol.Feature({
                geometry: new ol.geom.Polygon([airspace.merPolygon]),
                airspace: airspace
            });

            var airspaceStyle = createAirspaceStyle(airspace.category);

            if (airspaceStyle)
                airspaceFeature.setStyle(airspaceStyle);
            else
                continue;

            airspaceLayer.getSource().addFeature(airspaceFeature);
        }


        function convertPolygon(airspace)
        {
            var merCoords, lonLat;
            var merPoly = [];
            var minLat, maxLat, minLon, maxLon;

            for (var i = 0; i < airspace.polygon.length; i++)
            {
                lonLat = airspace.polygon[i];
                merCoords = ol.proj.fromLonLat(lonLat);
                merPoly.push(merCoords);

                if (!minLon || lonLat[0] < minLon)
                    minLon = lonLat[0];

                if (!maxLon || lonLat[0] > maxLon)
                    maxLon = lonLat[0];

                if (!minLat || lonLat[1] < minLat)
                    minLat = lonLat[1];

                if (!maxLat || lonLat[1] > maxLat)
                    maxLat = lonLat[1];
            }

            airspace.merPolygon = merPoly;
            airspace.lonLatExtent = [[minLon, maxLon], [minLat, maxLat]];
        }


        function createAirspaceStyle(category) {
            if (category === "CTR") {
                return new ol.style.Style({
                    fill: new ol.style.Fill({
                        color: 'rgba(152, 206, 235, 0.3)'
                    }),
                    stroke: new ol.style.Stroke({
                        color: 'rgba(23, 128, 194, 0.8)',
                        width: 3,
                        lineDash: [10, 7]
                    })
                });
            }
            else if (category === "A") {
                return new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'rgba(174, 30, 34, 0.8)',
                        width: 3
                    })
                });
            }
            else if (category === "B" || category === "C" || category === "D") {
                return new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'rgba(23, 128, 194, 0.8)',
                        width: 3
                    })
                });
            }
            else if (category === "E") {
                return new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'rgba(23, 128, 194, 0.8)',
                        width: 2
                    })
                });
            }
            else if (category === "DANGER" || category === "RESTRICTED" || category === "PROHIBITED") {
                return new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'rgba(174, 30, 34, 0.8)',
                        width: 2
                    })
                });
            }
            else if (category === "TMZ" || category === "RMZ" || category === "FIZ" || category === "ATZ") {
                return new ol.style.Style({
                    /*fill: new ol.style.Fill({
                     color: 'rgba(152, 206, 235, 0.3)'
                     }),*/
                    stroke: new ol.style.Stroke({
                        color: 'rgba(23, 128, 194, 0.8)',
                        //color: 'rgba(0, 0, 0, 1.0)',
                        width: 3,
                        lineDash: [1, 7]
                    })
                });
            }
            else if (category === "FIR" || category === "UIR") {
                return new ol.style.Style({
                    /*fill: new ol.style.Fill({
                     color: 'rgba(152, 206, 235, 0.3)'
                     }),*/
                    stroke: new ol.style.Stroke({
                        color: 'rgba(0, 150, 64, 0.8)',
                        width: 3,
                        lineDash: [5, 20]
                    })
                });
            }
            else if (category === "GLIDING" || category === "WAVE" || category === "SPORT") {
                return new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'rgba(0, 150, 64, 0.8)',
                        width: 2
                    })
                });
            }
        }
    }


    function drawWebcams(webcamList)
    {
        webcamLayer.getSource().clear();

        for (var i = 0; i < webcamList.length; i++) {
            var webcam = webcamList[i];
            var webcamFeature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat([webcam.longitude, webcam.latitude])),
                title: webcam.name
            });

            var webcamStyle = new ol.style.Style({
                image: new ol.style.Icon(({
                    anchor: [0.5, 0.5],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'fraction',
                    scale: 1,
                    opacity: 0.9,
                    src: 'icon/webcam.png',
                    title: webcam.name
                }))
            });

            webcamFeature.setStyle(webcamStyle);
            webcamFeature.webcam = webcam;

            webcamLayer.getSource().addFeature(webcamFeature);
        }
    }


    function drawMeteoBg(showBg)
    {
        meteoBgLayer.getSource().clear();

        if (!showBg)
            return;

        var mer_coordinates = [[
            getMercatorCoordinates(-85, -180),
            getMercatorCoordinates(85, -180),
            getMercatorCoordinates(85, 180),
            getMercatorCoordinates(-85, 180),
            getMercatorCoordinates(-85, -180)
        ]];

        var bgFeature = new ol.Feature({
            geometry: new ol.geom.Polygon(mer_coordinates)
        });

        var bgStyle = new ol.style.Style({
            fill: new ol.style.Fill({
                color: 'rgba(0, 0, 0, 0.5)'
            })
        });

        bgFeature.setStyle(bgStyle);

        meteoBgLayer.getSource().addFeature(bgFeature);
    }


    function drawSmaMeasurements(measurementList)
    {
        meteoSmaLayer.getSource().clear();

        if (!measurementList)
            return;

        for (var i = 0; i < measurementList.length; i++)
        {
            var measurement = measurementList[i];

            drawLocationDot(measurement);
            drawWindArrow(measurement);

            if (map.getView().getZoom() > 10)
                drawDetailBox(measurement);
            else
                drawSmallBox(measurement);
        }


        function drawLocationDot(measurement)
        {
            var dotFeature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat([measurement.station_lon, measurement.station_lat]))
            });

            var dotStyle = new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 4,
                    fill: new ol.style.Fill({
                        color: '#FFFFFF'
                    }),
                    stroke: new ol.style.Stroke({
                        color: '#000000',
                        width: 2
                    })
                })
            });

            dotFeature.setStyle(dotStyle);
            meteoSmaLayer.getSource().addFeature(dotFeature);
        }


        function drawWindArrow(measurement)
        {
            var windArrowFeature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat([measurement.station_lon, measurement.station_lat]))
            });

            var windArrowImage = meteoService.getWindArrowImage(measurement);
            var rotRad = deg2rad(measurement.wind_dir);

            var windArrowStyle = new ol.style.Style({
                image: new ol.style.Icon({
                    anchor: [0.5, 0.0],
                    opacity: 1.0,
                    img: windArrowImage,
                    imgSize : [windArrowImage.width, windArrowImage.height],
                    scale: windArrowImage.displayScale,
                    rotation: rotRad,
                    rotateWithView: true
                }),
                text: new ol.style.Text({
                    //textAlign: align,
                    //textBaseline: baseline,
                    font: 'bold 15px Calibri,sans-serif',
                    text: Math.round(kmh2kt(measurement.wind_speed_kmh)) + "kt",
                    fill: new ol.style.Fill({color: "#FFFFFF"}),
                    stroke: new ol.style.Stroke({color: "#000000", width: 2}),
                    offsetX: -windArrowImage.height / 2 * windArrowImage.displayScale * Math.sin(rotRad + map.getView().getRotation()),
                    offsetY: windArrowImage.height / 2 * windArrowImage.displayScale * Math.cos(rotRad  + map.getView().getRotation())
                })
            });


            windArrowFeature.setStyle(windArrowStyle);
            windArrowFeature.smaMeasurement = measurement;
            meteoSmaLayer.getSource().addFeature(windArrowFeature);
        }


        function drawDetailBox(measurement)
        {
            var boxFeature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat([measurement.station_lon, measurement.station_lat]))
            });

            var boxImage = meteoService.getDetailBoxImage(measurement);
            var rotDeg = measurement.wind_dir + rad2deg(map.getView().getRotation())

            var anchor;
            if (rotDeg >= 90 && rotDeg < 270)
                anchor = [0.5, -0.2];
            else
                anchor = [0.5, 1.2];

            /*
            if (rotDeg >= 0 && rotDeg < 90)
                anchor = [0.5, 1.2]; //anchor = [-0.1, 1.1];
            else if (rotDeg >= 90 && rotDeg < 180)
                anchor = [0.5, -0.2]; //anchor = [-0.1, -0.1];
            else if (rotDeg >= 180 && rotDeg < 270)
                anchor = [0.5, -0.2]; // anchor = [1.1, -0.1];
            else
                anchor = [0.5, 1.2]; // anchor = [1.1, 1.1];*/


            var boxStyle = new ol.style.Style({
                image: new ol.style.Icon({
                    anchor: anchor,
                    opacity: 0.9,
                    img: boxImage,
                    imgSize : [boxImage.width, boxImage.height],
                    scale: boxImage.displayScale
                })
            });


            boxFeature.setStyle(boxStyle);
            boxFeature.smaMeasurement = measurement;
            meteoSmaLayer.getSource().addFeature(boxFeature);
        }
    }


    function drawSmallBox(measurement)
    {
        var boxFeature = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.fromLonLat([measurement.station_lon, measurement.station_lat]))
        });

        var smallBoxImage = meteoService.getSmallBoxImage(measurement);

        var offsetPixel = 18 / smallBoxImage.displayScale;
        var rot = measurement.wind_dir ? deg2rad(measurement.wind_dir) : 0.0;
        var anchor = [-offsetPixel * Math.sin(rot) + 7, offsetPixel * Math.cos(rot) + 7];

        var boxStyle = new ol.style.Style({
            image: new ol.style.Icon({
                anchor: anchor,
                anchorXUnits: 'pixels',
                anchorYUnits: 'pixels',
                opacity: 0.9,
                img: smallBoxImage,
                imgSize : [smallBoxImage.width, smallBoxImage.height],
                scale: smallBoxImage.displayScale
            })
        });


        boxFeature.setStyle(boxStyle);
        boxFeature.smaMeasurement = measurement;
        meteoSmaLayer.getSource().addFeature(boxFeature);
    }


    //endregion


    //region USER EVENTS


    function onZoomInClicked()
    {
        onMapActivityOccuring();

        var view = map.getView();
        var zoom = view.getZoom();

        if (zoom < MAX_ZOOMLEVEL)
            view.setZoom(zoom + 1);
    }


    function onZoomOutClicked()
    {
        onMapActivityOccuring();

        var view = map.getView();
        var zoom = view.getZoom();

        if (zoom > 1)
            view.setZoom(zoom - 1);
    }


    function onMapActivityOccuring()
    {
        if (onMapActivityCallback)
            onMapActivityCallback();
    }


    // click event
    function onSingleClick(event)
    {
        var eventConsumed = false;

        // geopoint layers
        map.forEachFeatureAtPixel(
            event.pixel,
            function (feature, layer)
            {
                if (eventConsumed)
                    return;

                // specific feature clicked
                if (feature.geopoint ||
                    feature.notam ||
                    feature.notamList ||
                    feature.airport ||
                    feature.navaid ||
                    feature.waypoint ||
                    feature.userWaypoint ||
                    feature.reportingpoint ||
                    feature.webcam ||
                    feature.weatherInfo ||
                    feature.smaMeasurement ||
                    feature.closeChartId)
                {
                    closeOverlay();
                    clearGeopointSelection();

                    if (feature.closeChartId)
                        removeChart(feature);
                    else
                        onFeatureSelectCallback(event, feature);

                    eventConsumed = true;
                }
            },
            {
                hitTolerance: 10,
                layerFilter : function (layer) // layers to search for features
                {
                    return (layer === geopointLayer ||
                        layer === closeIconLayer ||
                        layer === notamTextLayer ||
                        layer === airportLayer ||
                        layer === navaidLayer ||
                        layer === reportingpointLayer ||
                        layer === userWpLayer ||
                        layer === wpTrackLayer ||
                        layer === webcamLayer ||
                        layer === weatherLayer ||
                        layer === meteoSmaLayer);
                }
            }
        );

        // traffic layer
        if (!eventConsumed)
        {
            map.forEachFeatureAtPixel(
                event.pixel,
                function (feature, layer) {
                    if (eventConsumed)
                        return;

                    // specific feature clicked
                    if (feature.acInfo)
                    {
                        onFeatureSelectCallback(event, feature);
                        clearGeopointSelection();
                        eventConsumed = true;
                    }
                },
                {
                    layerFilter: function (layer) // layers to search for features
                    {
                        return layer === trafficLayer;
                    }
                }
            );
        }


        if (!eventConsumed)
        {
            if (isGeopointSelectionActive || currentOverlay) // close overlay or geopointselection
            {
                clearGeopointSelection();
                closeOverlay();
            }
            else // click on 'empty' map
                onMapClickCallback(event, ol.proj.toLonLat(event.coordinate), getClickRadius(event));
        }
    }


    // pointermove event
    function onPointerMove(event)
    {
        if (event.dragging)
            return;

        var hit = map.forEachFeatureAtPixel(
            event.pixel,
            function(feature, layer) { return true; },
            {
                layerFilter: function(layer)
                {
                    return (layer === geopointLayer ||
                    layer === closeIconLayer ||
                    layer === notamTextLayer ||
                    layer === airportLayer ||
                    layer === navaidLayer ||
                    layer === reportingpointLayer ||
                    layer === userWpLayer ||
                    layer === wpTrackLayer ||
                    layer === trafficLayer ||
                    layer === webcamLayer ||
                    layer === weatherLayer ||
                    layer === meteoSmaLayer);
                }
            }
        );

        if (hit)
            map.getTargetElement().style.cursor = 'pointer';
        else
            map.getTargetElement().style.cursor = '';
    }


    // moveend event (pan / zoom)
    function onMoveEnd(event)
    {
        onMapActivityOccuring();

        setLayerVisibility();

        map.getView().setRotation((map.getView().getRotation() + 2 * Math.PI) % (2 * Math.PI));

        // show center own pos button
        var mapLatLon = getMapPosition().center;

        if (lastOwnPos !== undefined && roundToDigits(mapLatLon[1], 7) === roundToDigits(lastOwnPos.lat, 7) && roundToDigits(mapLatLon[0], 7) === roundToDigits(lastOwnPos.lon, 7)) {
            centerOwnPosContainer.style.visibility = "hidden";
        } else {
            centerOwnPosContainer.style.visibility = "visible";
        }


        // update map features
        if (map.getView().getZoom() >= 9) // TODO: variable zoom level
        {
            var extent = getViewExtentLatLon();
            mapFeatureService.getMapFeatures(extent, onMapFeaturesLoaded, onMapFeatureError);
        }

        onMoveEndCallback(event);


        function onMapFeaturesLoaded(mapFeatureList)
        {
            drawAirports(mapFeatureList.airports);
            drawNavaids(mapFeatureList.navaids);
            drawAirspaces(mapFeatureList.airspaces);
            drawReportingPoints(mapFeatureList.reportingPoints);
            drawUserPoints(mapFeatureList.userPoints);
            drawWebcams(mapFeatureList.webcams);

            metarTafNotamService.getAreaWeatherInfos(getViewExtentLatLon(), drawWeatherInfo);
            metarTafNotamService.getNotams(getViewExtentLatLon(), mapFeatureList.airports, drawAreaNotams);
        }


        function onMapFeatureError()
        {
            // TODO
        }
    }


    // rotate event
    function onViewRotation(event)
    {
        if (wpCache && wpCache.wps)
        {
            drawWaypoints(wpCache.wps, wpCache.alternate, wpCache.variation);
            wpTrackLayer.getSource().changed();
        }
    }


    function getClickRadius(event) {
        var clickPos = [event.pixel[0], event.pixel[1]];
        var coord1 = map.getCoordinateFromPixel(clickPos);
        var lat1 = ol.proj.toLonLat(coord1)[1];

        clickPos[1] -= 50;
        var coord2 = map.getCoordinateFromPixel(clickPos);
        var lat2 = ol.proj.toLonLat(coord2)[1];

        return Math.abs(lat2 - lat1);
    }

    //endregion


    //region MAP POSITION/SIZE

    function getMapPosition()
    {
        return {
            center: ol.proj.toLonLat(map.getView().getCenter()),
            zoom: map.getView().getZoom()
        };
    }


    function setMapPosition(lat, lon, zoom, forceRender, isOwnPosition)
    {
        if (!map || !map.getView())
            return;

        if (lat && lon)
        {
            var pos = ol.proj.fromLonLat([lon, lat]);
            map.getView().setCenter(pos);
        }

        if (zoom)
            map.getView().setZoom(zoom);

        if (forceRender)
            map.renderSync();

        if (isOwnPosition === true) {
            lastOwnPos = { lat: lat, lon: lon };
        }
    }


    function updateMapSize()
    {
        map.updateSize();
    }


    function getViewExtentMercator()
    {
        return map.getView().calculateExtent(map.getSize());
    }


    function getViewExtentLatLon()
    {
        var extent = map.getView().calculateExtent(map.getSize());

        return ol.proj.transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
    }


    function fitViewLatLon(extentLatLon)
    {
        if (!extentLatLon || extentLatLon.length != 4)
            return;

        var minMercator = getMercatorCoordinates(extentLatLon[1], extentLatLon[0]);
        var maxMercator = getMercatorCoordinates(extentLatLon[3], extentLatLon[2]);

        fitViewMercator([minMercator[0], minMercator[1], maxMercator[0], maxMercator[1]]);
    }


    function fitViewMercator(extentMercator)
    {
        if (!extentMercator || !map || !map.getView || !map.getSize)
            return;

        var paddingFactor = 0.05;
        var mapSize = map.getSize();
        var padX = Math.ceil(mapSize[0] * paddingFactor / 2);
        var padY = Math.ceil(mapSize[1] * paddingFactor / 2);

        map.getView().fit(extentMercator, { size: map.getSize(), padding: [ padX, padX, padY, padY], maxZoom: 15 });
    }

    //endregion


    //region CONTROLS & BUTTONS


    function ZoomButtonsControl(opt_options)
    {
        var options = opt_options || {};

        var img1 = document.createElement('span');
        img1.className = "glyphicon glyphicon-plus";

        var img2 = document.createElement('span');
        img2.className = "glyphicon glyphicon-minus";

        var button1 = document.createElement('button');
        button1.className = "btn btn-primary btn-circle btn-lg";
        button1.setAttribute("type", "button");
        button1.setAttribute("title", "zoom in");
        button1.setAttribute("style", "border-top-left-radius: 25px; border-top-right-radius: 25px");
        button1.addEventListener('click', onZoomInClicked, false);
        button1.appendChild(img1);

        var button2 = document.createElement('button');
        button2.className = "btn btn-primary btn-circle btn-lg";
        button2.setAttribute("type", "button");
        button2.setAttribute("title", "zoom out");
        button2.setAttribute("style", "border-bottom-left-radius: 25px; border-bottom-right-radius: 25px");
        button2.addEventListener('click', onZoomOutClicked, false);
        button2.appendChild(img2);

        var div = document.createElement('div');
        div.className = 'btn-group-vertical mapbutton-zoom';
        div.appendChild(button1);
        div.appendChild(button2);

        ol.control.Control.call(this, {
            element: div,
            target: options.target
        });
    }


    function FullScreenButtonControl(opt_options)
    {
        var options = opt_options || {};

        var img = document.createElement('i');
        img.className = "glyphicon glyphicon-fullscreen";

        var img2 = document.createElement('i');
        img2.className = "glyphicon glyphicon-resize-small";

        var button = document.createElement('button');
        button.setAttribute("title", "toggle full screen mode");
        button.addEventListener('click', onFullScreenButtonClicked, false);
        button.appendChild(img);
        button.appendChild(img2);

        var div = document.createElement('div');
        div.className = 'ol-full-screen ol-unselectable ol-control';
        div.appendChild(button);

        if (!isFullScreenEnabled2())
            div.setAttribute("style", "display:none");

        ol.control.Control.call(this, {
            element: div,
            target: options.target
        });


        function onFullScreenButtonClicked()
        {
            if (onFullScreenCallback)
                onFullScreenCallback();
        }
    }


    function CenterOwnPositionControl(opt_options)
    {
        var options = opt_options || {};

        var img = document.createElement('i');
        img.className = "fa fa-thumb-tack";

        var button = document.createElement('button');
        button.setAttribute("title", "center own position");
        button.addEventListener('click', onCenterOwnPositionClicked, false);
        button.appendChild(img);

        centerOwnPosContainer = document.createElement('div');
        centerOwnPosContainer.className = 'mapbutton-center-position ol-unselectable ol-control';
        centerOwnPosContainer.appendChild(button);

        ol.control.Control.call(this, {
            element: centerOwnPosContainer,
            target: options.target
        });


        function onCenterOwnPositionClicked()
        {
            if (onCenterOwnPositionCallback) {
                onCenterOwnPositionCallback();
            }
        }
    }


    //endregion


	//region OVERLAYS

	function addOverlay(coordinates, container, autopan)
	{
		if (currentOverlay)
			closeOverlay();

		if (container.style.visibility === "hidden")
			container.style.visibility = "visible";

		currentOverlay = new ol.Overlay({
			element: container,
			autoPan: autopan,
			autoPanAnimation: {duration: 250}
		});

		map.addOverlay(currentOverlay);
		
		currentOverlay.setPosition(coordinates); // force auto panning
	}


	function closeOverlay()
	{
		if (!currentOverlay)
			return;

        map.removeOverlay(currentOverlay);

		currentOverlay = undefined;
	}

	//endregion


	//region GEOPOINT SELECTION

	function clearGeopointSelection()
	{
		geopointLayer.getSource().clear();
		isGeopointSelectionActive = false;
	}
	
	
	function drawGeopointSelection(geopoints, notams, clickPixel)
	{
		var layerSource = geopointLayer.getSource();
		layerSource.clear();
		isGeopointSelectionActive = true;

		var clickLonLat;
		if (clickPixel)
			clickLonLat = ol.proj.toLonLat(map.getCoordinateFromPixel(clickPixel));
		else
			clickLonLat = ol.proj.fromLonLat([geopoints[0].longitude, geopoints[0].latitude]);

		// limit to 6 points
		var maxPoints = 6;
		if (geopoints.length > maxPoints)
			geopoints = geopoints.splice(0, maxPoints);

		// add clickpoint if no points found
		if (clickPixel && geopoints.length === 0)
			geopoints.push(getCoordinateGeopoint(clickLonLat));

		var airspaceSelection = getAirspacesAtLatLon(clickLonLat);
		var simpleAirspaceSelection = getSimplifiedAirspaces(airspaceSelection);

		var numPointsB = Math.floor(geopoints.length / 3);
		var numPointsT = geopoints.length - numPointsB;
		var numPointsTR = Math.floor(numPointsT / 2);
		var numPointsTL = numPointsT - numPointsTR;

		// create top/bottom partitions
		var pointsT = geopoints.slice(0).sort(function(a, b) { return b.latitude - a.latitude });
		var pointsB = pointsT.splice(numPointsT, numPointsB);

		// create top left/right partitions
		var pointsTL = pointsT.slice(0).sort(function(a, b) { return a.longitude - b.longitude });
		var pointsTR = pointsTL.splice(numPointsTL, numPointsTR);

		sortQuadrantClockwise(pointsTL, true, true);
		sortQuadrantClockwise(pointsTR, true, false);
		sortQuadrantClockwise(pointsB, false, true);

		setLabelCoordinates(pointsTL, Math.PI * 1.5);
		setLabelCoordinates(pointsTR, 0.0);
		setLabelCoordinates(pointsB, Math.PI);


		for (var i = 0; i < geopoints.length; i++)
		{
			// geo point feature
			var geoPointFeature = createGeoPointFeature(geopoints[i]);
			layerSource.addFeature(geoPointFeature);

			// label point feature
			var labelFeature = createLabelFeature(geopoints[i]);
			layerSource.addFeature(labelFeature);

			// line
			var lineFeature = createLineFeature(geopoints[i]);
			layerSource.addFeature(lineFeature);

			// add feature object
            mapFeatureService.addFeatureByTypeAndId(geopoints[i].type, geopoints[i].id, geoPointFeature);
            mapFeatureService.addFeatureByTypeAndId(geopoints[i].type, geopoints[i].id, labelFeature);
		}


		// notams
        if (notams && notams.length > 0)
        {
            var notamFeature = createNotamFeature(geopoints, notams);
            layerSource.addFeature(notamFeature);
        }


		// airspaces
		addAirspaceOverlay(geopoints, airspaceSelection, simpleAirspaceSelection);


		function getAirspacesAtLatLon(clickLonLat)
		{
			var asList = mapFeatureService.getAirspacesAtLatLon(clickLonLat);

			// reset previous exclusions
			for (var i = 0; i < asList.length; i++)
			{
				asList[i].hide = undefined;
				asList[i].alt.bottom_replace = undefined;
			}

			// sort airspaces top to bottom
			asList.sort(airspaceComparer);

			return asList;
		}


		function airspaceComparer(a, b)
        {
            var catPrio = (a.category > b.category) ? 1 : -1;

            return getAirspaceHeight(b.alt.bottom) - getAirspaceHeight(a.alt.bottom) + catPrio;
        }


        function airspaceComparerBottom2Top(as1, as2)
        {
            var bottomComp = heightComparerBottom2Top(as1.alt.bottom, as2.alt.bottom);

            if (bottomComp !== 0)
                return bottomComp;
            else
                return heightComparerBottom2Top(as1.alt.top, as2.alt.top);
        }


        function heightComparerBottom2Top(alt1, alt2)
        {
            // AGL first
            if (alt1.ref === "GND" && alt2.ref !== "GND")
                return -1;

            if (alt1.ref !== "GND" && alt2.ref === "GND")
                return 1;

            return getAirspaceHeight(alt1) - getAirspaceHeight(alt2);
        }


        function getAirspaceHeight(height)
		{
			if (height.unit === 'FL')
				return height.height * 100;
			else
				return height.height;
		}


		function isHigherOrEqual(alt1, alt2)
        {
            if (alt1.ref !== alt2.ref && (alt1.ref === 'GND' || alt2.ref === 'GND')) // don't mix reference planes
                return false;

            return (getAirspaceHeight(alt1) >= getAirspaceHeight(alt2));
        }


		function getSimplifiedAirspaces(airspaceList)
        {
            var i, j, cat;

            if (!airspaceList)
                return;

            // sort by airspace category
            var asByCat = {};

            for (i = 0; i < airspaceList.length; i++)
            {
                if (!(airspaceList[i].category in asByCat))
                    asByCat[airspaceList[i].category] = [];

                asByCat[airspaceList[i].category].push(airspaceList[i]);
            }

            // group overlapping per category
            var groupedAsByCat = {};

            for (cat in asByCat)
            {
                groupedAsByCat[cat] = [];

                // sort
                asByCat[cat].sort(airspaceComparerBottom2Top);

                var currentAs;

                for (i = 0; i < asByCat[cat].length; i++)
                {
                    if (i === 0)
                        currentAs = createAirspaceInfo(asByCat[cat][i]);

                    if (i < asByCat[cat].length - 1)
                    {
                        var as2 = asByCat[cat][i + 1];

                        if (isHigherOrEqual(as2.alt.bottom, currentAs.alt.bottom) && isHigherOrEqual(currentAs.alt.top, as2.alt.top)) // current completely overlaps b => stay with current & continue
                        {
                            currentAs.name = "";
                            continue;
                        }
                        else if (isHigherOrEqual(currentAs.alt.bottom, as2.alt.bottom) && isHigherOrEqual(as2.alt.top, currentAs.alt.top)) // b completely overlaps current => use b & continue
                        {
                            currentAs = createAirspaceInfo(asByCat[cat][i + 1]);
                            currentAs.name = "";
                            continue;
                        }
                        else if (isHigherOrEqual(currentAs.alt.top, as2.alt.bottom)) // bottom-top-overlap => set new top height of current
                        {
                            currentAs.name = "";
                            currentAs.alt.top = as2.alt.top;
                            continue;
                        }
                        else
                        {
                            groupedAsByCat[cat].push(currentAs);
                            currentAs = createAirspaceInfo(as2);
                            continue;
                        }
                    }
                }

                groupedAsByCat[cat].push(currentAs);
            }

            // create intermediate list
            var intermediateSimpleAsList = [];

            for (cat in groupedAsByCat)
            {
                for (i = 0; i < groupedAsByCat[cat].length; i++)
                    intermediateSimpleAsList.push(groupedAsByCat[cat][i]);
            }


            // displace airspaces
            for (i = 0; i < intermediateSimpleAsList.length; i++)
            {
                var asDom = intermediateSimpleAsList[i];

                if (asDom.category in displaceAirspaceCat) // check for dom category
                {
                    for (j = 0; j < intermediateSimpleAsList.length; j++)
                    {
                        var asSub = intermediateSimpleAsList[j];

                        if ($.inArray(asSub.category, displaceAirspaceCat[asDom.category]) < 0) // check for sub categories
                            continue;

                        if (asSub.isDeleted) // skip if already deleted
                            continue;

                        if (isHigherOrEqual(asSub.alt.bottom, asDom.alt.top) || isHigherOrEqual(asDom.alt.bottom, asSub.alt.top)) // not overlapping => skip
                            continue;

                        if (isHigherOrEqual(asDom.alt.top, asSub.alt.top) && isHigherOrEqual(asSub.alt.bottom, asDom.alt.bottom)) // full overlap => delete sub
                        {
                            asSub.deleted = true;
                            continue;
                        }

                        if (isHigherOrEqual(asDom.alt.top, asSub.alt.bottom)) // dom.top > sub.bottom => push sub up
                        {
                            asSub.alt.bottom = asDom.alt.top;

                            if (isHigherOrEqual(asSub.alt.bottom, asSub.alt.top)) // crushed to bits => delete sub
                                asSub.deleted = true;

                            continue;
                        }

                        if (isHigherOrEqual(asSub.alt.top, asDom.alt.bottom)) // sub.top > dom.bottom => push sub down
                        {
                            asSub.alt.top = asDom.alt.bottom;

                            if (isHigherOrEqual(asSub.alt.bottom, asSub.alt.top)) // crushed to bits => delete sub
                                asSub.deleted = true;

                            continue;
                        }
                    }
                }
            }


            // remove deleted entries
            var finalSimpleAsList = [];

            for (i = 0; i < intermediateSimpleAsList.length; i++)
            {
                if (!intermediateSimpleAsList[i].deleted)
                    finalSimpleAsList.push(intermediateSimpleAsList[i]);
            }

            finalSimpleAsList.sort(airspaceComparer);

            return finalSimpleAsList;
        }


        function createAirspaceInfo(airspace)
        {
            return {
                name: airspace.name,
                category: airspace.category,
                alt: {
                    top: {
                        height: airspace.alt.top.height,
                        ref: airspace.alt.top.ref,
                        unit: airspace.alt.top.unit
                    },
                    bottom: {
                        height: airspace.alt.bottom.height,
                        ref: airspace.alt.bottom.ref,
                        unit: airspace.alt.bottom.unit
                    }
                }
            }
        }


		function sortQuadrantClockwise(geopoints, isTopQuadrant, isLeftQuadrant)
		{
			if (!geopoints || geopoints.length <= 0)
				return;

			var center = { latitude: undefined, longitude: undefined };

			geopoints.sort(function(a, b) { return a.latitude - b.latitude }); // bottom to top

			if (isTopQuadrant)
				center.latitude = geopoints[0].latitude - 0.1;
			else
				center.latitude = geopoints[geopoints.length - 1].latitude + 0.1;

			geopoints.sort(function(a, b) { return a.longitude - b.longitude}); // left to right

			if (isLeftQuadrant)
				center.longitude = geopoints[geopoints.length - 1].longitude + 0.1;
			else
				center.longitude = geopoints[0].longitude - 0.1;

			geopoints.sort(function(a, b) {
				return Math.atan2(b.latitude - center.latitude, b.longitude - center.longitude) - Math.atan2(a.latitude - center.latitude, a.longitude - center.longitude)
			});
		}


		function setLabelCoordinates(geopoints, rotationRad)
		{
			if (geopoints.length === 0)
				return;

			var radiusPixel = 100;
			var rotOffset = 0;
			var rotInc = Math.PI / 2 / (geopoints.length + 1);

			for (var i = 0; i < geopoints.length; i++)
			{
				var geoPointPixel = map.getPixelFromCoordinate(ol.proj.fromLonLat([geopoints[i].longitude, geopoints[i].latitude]));
				var labelCoordX = geoPointPixel[0] + Math.sin(rotationRad + (i + 1) * rotInc + rotOffset) * radiusPixel;
				var labelCoordY = geoPointPixel[1] - Math.cos(rotationRad + (i + 1) * rotInc + rotOffset) * radiusPixel;

				geopoints[i].labelCoordinates = map.getCoordinateFromPixel([labelCoordX, labelCoordY]);
			}
		}


		function createGeoPointFeature(geopoint)
		{
			var geoPointFeature = new ol.Feature({
				geometry: new ol.geom.Point(ol.proj.fromLonLat([geopoint.longitude, geopoint.latitude]))
			});

			geoPointFeature.geopoint = geopoint;

			geoPointFeature.setStyle(
				new ol.style.Style({
					image: new ol.style.Circle({
						radius: 5,
						fill: new ol.style.Fill({
							color: '#FFFFFF'
						}),
						stroke: new ol.style.Stroke({
							color: '#000000',
							width: 2
						})
					})
				})
			);

			return geoPointFeature;
		}


		function createLabelFeature(geopoint)
		{
			var labelFeature = new ol.Feature({
				geometry: new ol.geom.Point(geopoint.labelCoordinates)
			});

			labelFeature.geopoint = geopoint;

			labelFeature.setStyle(
				new ol.style.Style({
					image: new ol.style.Circle({
						radius: 1,
						fill: new ol.style.Fill({
							color: '#000000'
						}),
						stroke: new ol.style.Stroke({
							color: '#000000',
							width: 2
						})
					}),
					text: new ol.style.Text({
						font: 'bold 20px Calibri,sans-serif',
						text: geopoint.name,
						fill: new ol.style.Fill( { color: '#660066' } ),
						stroke: new ol.style.Stroke( {color: '#FFFFFF', width: 20 } ),
						offsetX: 0,
						offsetY: 0
					})
				})
			);

			return labelFeature;
		}


		function createLineFeature(geopoint)
		{
			var points = [];
			points.push(ol.proj.fromLonLat([geopoint.longitude, geopoint.latitude]));
			points.push(geopoint.labelCoordinates);

			var lineFeature = new ol.Feature({
				geometry: new ol.geom.LineString(points)
			});

			lineFeature.setStyle(
				new ol.style.Style({
					stroke : new ol.style.Stroke({
						color: '#000000',
						width: 3
					})
				})
			);

			return lineFeature;
		}


        // determine top left coordinate in bottom right quadrant
		function getTLCoordInBRQuad(geopoints)
        {
            var minLat, maxLon;

            for (var i = 0; i < geopoints.length; i++) {
                if (!minLat || geopoints[i].latitude < minLat)
                    minLat = geopoints[i].latitude;

                if (!maxLon || geopoints[i].longitude > maxLon)
                    maxLon = geopoints[i].longitude;
            }

            return [maxLon, minLat];
        }


        function createNotamFeature(geopoints, notams)
        {
            // find position
            var topLeftCoord = getTLCoordInBRQuad(geopoints);
            var pixelTopLeft = map.getPixelFromCoordinate(ol.proj.fromLonLat(topLeftCoord));
            pixelTopLeft[0] += 50;


            var notamText = "NOTAM: " + notams.length + "x";

            var notamFeature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat(topLeftCoord))
            });

            notamFeature.notamList = notams;

            notamFeature.setStyle(
                new ol.style.Style({
                    text: new ol.style.Text({
                        textAlign: 'left',
                        font: 'bold 14px Calibri,sans-serif',
                        text: notamText,
                        fill: new ol.style.Fill( { color: '#660066' } ),
                        stroke: new ol.style.Stroke( {color: '#FFFFFF', width: 10 } ),
                        offsetX: 45,
                        offsetY: -15
                    })
                })
            );

            return notamFeature;
        }


		function addAirspaceOverlay(geopoints, airspaceSelection, simpleAirspaceSelection)
        {
            // find position
            var topLeftCoord = getTLCoordInBRQuad(geopoints);
            var pixelTopLeft = map.getPixelFromCoordinate(ol.proj.fromLonLat(topLeftCoord));
            pixelTopLeft[0] += 50;
            //pixelTopLeft[1] += 10;


            // build airspaces table
            var asTableHtml;

            if (airspaceSelection.length > simpleAirspaceSelection.length)
            {
                asTableHtml = getTableHtml(airspaceSelection, true, false);
                asTableHtml += getTableHtml(simpleAirspaceSelection, true, true);
            }
            else
                asTableHtml = getTableHtml(simpleAirspaceSelection, false, false);

            var airspaceContainer = document.createElement('div');


			airspaceContainer.setAttribute("class", "airspace-container");
			airspaceContainer.innerHTML = asTableHtml;

			addOverlay(map.getCoordinateFromPixel(pixelTopLeft), airspaceContainer, false);


			function getTableHtml(airspaceSelection, showToggle, isSimplified)
            {
                var id = isSimplified ? "airspace-popup-simplified" : "airspace-popup";
                var display = showToggle && !isSimplified ? "none" : "block";

                var asTableHtml = '<table id="' + id + '" style="border-spacing: 3px; border-collapse: separate; display: ' + display + '">';

                for (var j = 0; j < airspaceSelection.length; j++) {
                    var airspace = airspaceSelection[j];

                    if (airspace.hide)
                        continue;

                    var bottom_height = airspace.alt.bottom_replace ? airspace.alt.bottom_replace : airspace.alt.bottom;

                    // box
                    asTableHtml += '<tr><td><div style="position:relative"><table class="airspace-overlay ' + getBoxClass(airspace) + '">';

                    // top height
                    asTableHtml += '<tr style="border-bottom: thin solid"><td>' + getHeightText(airspace.alt.top) + '</td></tr>';

                    // bottom height
                    asTableHtml += '<tr><td>' + getHeightText(bottom_height) + '</td></tr>';

                    asTableHtml += '</table>';

                    // airspace category
                    var categoryBox = getAirspaceCategoryBox(airspace);

                    if (categoryBox)
                        asTableHtml += categoryBox;

                    // airspace name
                    var airspaceName = getAirspaceName(airspace);

                    if (airspaceName)
                        asTableHtml += airspaceName;

                    asTableHtml += '</div></td></tr>';
                }

                if (showToggle) {
                    if (isSimplified)
                        asTableHtml += '<tr><td><span class="airspace-toggle" onclick="airspaceListToggle()"><i class="glyphicon glyphicon-collapse-down"></i> details</span></td></tr>';
                    else
                        asTableHtml += '<tr><td><span class="airspace-toggle" onclick="airspaceListToggle()"><i class="glyphicon glyphicon-collapse-up"></i> group</span></td></tr>';
                }

                asTableHtml += '</table>';

                return asTableHtml;
            }


			function getBoxClass(airspace)
			{
				switch (airspace.category)
				{
					case 'A':
					case 'DANGER':
					case 'RESTRICTED':
					case 'PROHIBITED':
                        return 'airspace-overlay-red';
                    case 'FIR':
                    case 'UIR':
					case 'GLIDING':
                    case 'WAVE':
                    case 'SPORT':
                        return 'airspace-overlay-green';
					default:
						return 'airspace-overlay-blue';
				}
			}


			function getAirspaceCategoryBox(airspace)
			{
				var classStyle;
				var catText = airspace.category;

				switch (airspace.category)
				{
					case 'A':
						classStyle = "airspace-class-red";
						break;
                    case 'B':
					case 'C':
					case 'D':
					case 'E':
					case 'G':
                    case 'F':
                    case 'TMZ':
                    case 'RMZ':
                    case 'FIZ':
                    case 'ATZ':
						classStyle = "airspace-class-blue";
						break;
                    case 'FIR':
                    case 'UIR':
                        classStyle = "airspace-class-green";
                        break;
					case 'CTR':
						classStyle = "airspace-class-blue";
						catText = "CTR";
						break;
                    case 'DANGER':
                        classStyle = "airspace-class-red";
                        catText = "Dng";
                        break;
                    case 'RESTRICTED':
                        classStyle = "airspace-class-red";
                        catText = "R";
                        break;
                    case 'PROHIBITED':
                        classStyle = "airspace-class-red";
                        catText = "P";
                        break;
                    case 'GLIDING':
                    case 'WAVE':
                    case 'SPORT':
                        classStyle = "airspace-class-green";
                        catText = "GLD";
                        break;
					default:
                        classStyle = "airspace-class-blue";
						catText = undefined;
				}

				if (catText)
					return '<span class="airspace-class ' + classStyle + '">' + catText + '</span>';
				else
					return undefined;
			}


			function getAirspaceName(airspace)
			{
				var classStyle;
				var text = airspace.name;

				switch (airspace.category)
				{
					case 'A':
					case 'DANGER':
					case 'RESTRICTED':
					case 'PROHIBITED':
                        classStyle = "airspace-name-red";
                        break;
                    case 'FIR':
                    case 'UIR':
					case 'GLIDING':
                    case 'WAVE':
                    case 'SPORT':
						classStyle = "airspace-name-green";
						break;
					default:
						classStyle = "airspace-name-blue";
						break;
				}

				if (text)
					return '<span class="airspace-name ' + classStyle + '">' + text + '</span>';
				else
					return undefined;
			}


			function getHeightText(height)
			{
				var text = height.height.toString();
				var cssClass = "airspace-overlay-heighttext-normal";

				switch (height.ref) {
					case "STD":
						text = "FL " + text;
						break;
					case "GND":
						if (height.height > 0)
							text += " AGL";
						else
							text = "GND";
						break;
					case "MSL":
						cssClass = "airspace-overlay-heighttext-agl"; // italic
						break;
				}

				return '<span class="' + cssClass + '">' + text + '</span>';
			}			
		}
	}

	//endregion


    //region WAYPOINTS
	
	function drawWaypoints(wps, alternate, variation)
	{
		if (typeof wpTrackLayer === "undefined")
			return;

		// cache parameters for updates after view rotation
		wpCache = new WaypointCache(wps, alternate, variation);

		// remove features
		var trackSource = wpTrackLayer.getSource();
		trackSource.clear();

		// remove interactions
		for (var j = 0; j < modifySnapInteractions.length; j++) {
		    modifySnapInteractions[j].un('modifyend', onTrackModifyEnd);
            map.removeInteraction(modifySnapInteractions[j]);
        }
		modifySnapInteractions = [];


		// waypoints
		var prevWp, nextWp;

		for (var i = 0; i < wps.length; i++)
		{
			if (i < wps.length - 1)
				nextWp = wps[i + 1];
			else if (alternate)
				nextWp = alternate;
			else
				nextWp = undefined;
				
			addTrackPoints(trackSource, wps[i], nextWp, variation);
		}

		addTrackLine(wps, trackSource, false);


		// alternate
		if (alternate)
		{
			if (wps.length > 0)
			{
				prevWp = wps[wps.length - 1];
				nextWp = alternate;
			}
			else
			{
				prevWp = alternate;
				nextWp = undefined;
			}
				
			addTrackPoints(trackSource, prevWp, nextWp, variation);

			if (nextWp)
			{
				addTrackPoints(trackSource, nextWp, undefined, variation);
				addTrackLine([prevWp, nextWp], trackSource, true);
			}
		}


		// add snap interactions
		addSnapInteraction(airportLayer);
		addSnapInteraction(navaidLayer);
		addSnapInteraction(reportingpointLayer);
		addSnapInteraction(userWpLayer);


		function addTrackPoints(trackSource, wp, nextWp, variation)
		{
			// get wp coordinates
			var mapCoord = ol.proj.fromLonLat([wp.longitude, wp.latitude]);

			// add waypoint + label
			var wpFeature  = new ol.Feature({
				geometry: new ol.geom.Point(mapCoord)
			});

			var wpStyle = createWaypointStyle(wp, nextWp);
			wpFeature.setStyle(wpStyle);
			wpFeature.waypoint = wp;
			trackSource.addFeature(wpFeature);

			if (!nextWp)
				return;

			// add direction & bearing label
			var dbFeature  = new ol.Feature({
				geometry: new ol.geom.Point(mapCoord)
			});

			var dbStyle = createDirBearStyle(nextWp, variation);
			dbFeature.setStyle(dbStyle);
			trackSource.addFeature(dbFeature);
		}


		function addTrackLine(wps, trackSource, isAlternate)
		{
			if (!wps || wps.length < 2)
				return;

			// define styles
			var trackStyle;

			if (!isAlternate)
				trackStyle = new ol.style.Style({
					stroke : new ol.style.Stroke({
						color: '#FF00FF',
						width: 5
					})
				});
			else
				trackStyle = new ol.style.Style({
					stroke : new ol.style.Stroke({
						color: '#FF00FF',
						width: 4,
						lineDash: [10, 10]
					})
				});

			// get coordinate list
			var mapCoordList = [];
			for (var i = 0; i < wps.length; i++)
				mapCoordList.push(ol.proj.fromLonLat([wps[i].longitude, wps[i].latitude]));

			// add track line segment
			var trackFeature = new ol.Feature({
				geometry: new ol.geom.LineString(mapCoordList)
			});

			trackFeature.wps = wps;
			trackFeature.originalCoordList = mapCoordList;

			trackFeature.setStyle(trackStyle);
			trackSource.addFeature(trackFeature);

			if (!isAlternate)
				addModifyInteraction(trackFeature);
		}


		function addModifyInteraction(trackFeature)
		{
			var modInteraction = new ol.interaction.Modify({
			    deleteCondition : function(event) { return false; }, // no delete condition
				features: new ol.Collection([trackFeature])
			});

			modInteraction.on('modifyend', onTrackModifyEnd);
			modifySnapInteractions.push(modInteraction);

			map.addInteraction(modInteraction);
		}


		function addSnapInteraction(layer)
		{
			var snapInteraction = new ol.interaction.Snap({
				source: layer.getSource(),
				edge: false
			});

			modifySnapInteractions.push(snapInteraction);

			map.addInteraction(snapInteraction);
		}


		function onTrackModifyEnd(event)
		{
		    if (!event || !event.mapBrowserEvent)
		        return;

			var lineFeature = event.features.getArray()[0];
			var oldPoints = lineFeature.originalCoordList;
			var newPoints = lineFeature.getGeometry().getCoordinates();

			for (var i = 0; i < newPoints.length; i++)
			{
				if ((newPoints[i][0] === oldPoints[i][0] && newPoints[i][1] === oldPoints[i][1]) || (newPoints[i][0] === oldPoints[i][0] && newPoints[i][1] === oldPoints[i][1]))
					continue;

				var latLon = getLatLonCoordinates(newPoints[i]);
				var feature = findSnapFeature(newPoints[i]);
				var isInsert = !(oldPoints.length === newPoints.length);

				onTrackModifyEndCallback(feature, latLon, i, isInsert);
				break;
			}
		}


		function findSnapFeature(mapCoord)
		{
			var snapLayers = [ airportLayer, navaidLayer, reportingpointLayer, userWpLayer ];

			for (var i = 0; i < snapLayers.length; i++)
			{
				var features = snapLayers[i].getSource().getFeaturesInExtent([mapCoord[0], mapCoord[1], mapCoord[0], mapCoord[1]]);
				if (features.length > 0)
					return features[0];
			}

			// use geopoint as default feature
			var latLon = getLatLonCoordinates(mapCoord);
			var geoPointFeature = new ol.Feature({
				geometry: new ol.geom.Point(mapCoord)
			});

			geoPointFeature.geopoint = getCoordinateGeopoint([latLon.longitude, latLon.latitude]);

			return geoPointFeature;
		}


		function createWaypointStyle(wp1, wp2)
		{
			var rotDeg, rotRad, align;
			var maprotRad = map.getView().getRotation();
			var maprotDeg = rad2deg(maprotRad);
			var rotateWithView = true;

			if (wp1.mt && wp2) // en route point
			{
				if (wp2.mt > wp1.mt)
					rotDeg = (wp1.mt + 270 + (wp2.mt - wp1.mt) / 2) % 360;
				else
					rotDeg = (wp1.mt + 270 + (wp2.mt + 360 - wp1.mt) / 2) % 360;
			}
			else if (!wp1.mt && wp2) // start point
			{
				rotDeg = (wp2.mt + 180) % 360;
			}
			else if (wp1.mt && !wp2) // end point
			{
				rotDeg = wp1.mt;
			}
			else if (!wp1.mt && !wp2) // single point
			{
				rotDeg = 45; // 45°
				rotateWithView = false;
			}
			else
				throw "invalid waypoints";

			if (!rotateWithView || (rotDeg + maprotDeg) % 360 < 180)
				align = "end";
			else
				align = "start";

			if (rotateWithView)
				rotRad = deg2rad(rotDeg + maprotDeg);
			else
				rotRad = deg2rad(rotDeg);

			return  new ol.style.Style({
				image: new ol.style.Circle({
					radius: 6,
					fill: new ol.style.Fill({
						color: '#FF00FF',
						rotateWithView: true
					})
				}),
				text: new ol.style.Text({
					font: 'bold 16px Calibri,sans-serif',
					text: wp1.checkpoint,
					fill: new ol.style.Fill( { color: '#660066' } ),
					stroke: new ol.style.Stroke( {color: '#FFFFFF', width: 10 } ),
					textAlign: align,
					offsetX: 15 * Math.sin(rotRad),
					offsetY: -15 * Math.cos(rotRad)
				})
			});
		}


		function createDirBearStyle(wp, variation)
		{
			var varRad = Number(variation) ? deg2rad(Number(variation)) : 0;
			var maprotRad = map.getView().getRotation();
			var maprotDeg = rad2deg(maprotRad);
			var rotRad, align, text;

			if (!wp)
			{
				rotRad = 0;
				align = "end";
				text = '';
			}
			else if ((wp.mt + maprotDeg + 360) % 360 < 180)
			{
				rotRad = deg2rad(wp.mt - 90);
				align = "end";
				text = '   ' + wp.mt + '° ' + wp.dist + 'NM >';
			}
			else
			{
				rotRad = deg2rad(wp.mt - 270);
				align = "start";
				text = '< ' + wp.mt + '° ' + wp.dist + 'NM   ';
			}

			return  new ol.style.Style({
				text: new ol.style.Text({
					font: '14px Calibri,sans-serif',
					text: text,
					fill: new ol.style.Fill( { color: '#000000' } ),
					stroke: new ol.style.Stroke( {color: '#FFFFFF', width: 10 } ),
					rotation: rotRad + varRad + maprotRad,
					textAlign: align
				})
			});
		}
	}


	//endregion


    //region TRACK

	function drawFlightTrack(positions)
	{
		if (typeof flightTrackLayer === "undefined")
			return;

		var flightTrackSource = flightTrackLayer.getSource();
		flightTrackSource.clear();

		var flightTrackStyle = new ol.style.Style({
			stroke : new ol.style.Stroke({
				color: '#0000FF',
				width: 3
			})
		});


        for (var i = 0; i < positions.length - 1; i++)
		{
			var pos1 = positions[i];
			var pos2 = positions[i + 1];

			// get wp coordinates
			var mapCoord1 = ol.proj.fromLonLat([pos1.longitude, pos1.latitude]);
			var mapCoord2 = ol.proj.fromLonLat([pos2.longitude, pos2.latitude]);

			var flightTrackFeature = new ol.Feature({
				geometry: new ol.geom.LineString([mapCoord1, mapCoord2])
			});

			flightTrackFeature.setStyle(flightTrackStyle);
			flightTrackSource.addFeature(flightTrackFeature);
		}
	}

	//endregion


	//region CHARTS
	
	function displayChart(chartId)
	{
		// load chart data
        var url = adChartBaseUrl + '&id=' + chartId;

		$http.get(url)
			.then(
				function(response)
                { // success
                    if (!response.data || !response.data.chart)
                    {
						logResponseError("ERROR reading chart", response);
					}
					else
                    {
						var extent = [response.data.chart.mercator_w, response.data.chart.mercator_s, response.data.chart.mercator_e, response.data.chart.mercator_n];

						var projection = new ol.proj.Projection({
							code: 'chart',
							units: 'm',
							extent: extent
						});

						var chartLayer = new ol.layer.Image({
							source: new ol.source.ImageStatic({
								url: 'charts/' + response.data.chart.filename + '?v=' + navplanVersion,
								projection: projection,
								imageExtent: extent
							}),
							extent: extent,
							opacity: 0.9
						});

                        chartLayer.chartId = chartId;
                        chartLayerCache.chartLayers.push(chartLayer);

						map.getLayers().insertAt(chartLayerCache.chartLayers.length, chartLayer);

						addChartCloseFeature(chartId, extent);

						fitViewMercator(extent);
					}
				},
				function(response) { // error
                    logResponseError("ERROR reading chart", response);
				}
			);


		function addChartCloseFeature(chartId, extent)
		{
			var closerFeature = new ol.Feature({
				geometry: new ol.geom.Point([extent[2], extent[3]])
			});

			var closerStyle = new ol.style.Style({
				image: new ol.style.Icon(({
					anchor: [0.5, 0.5],
					anchorXUnits: 'fraction',
					anchorYUnits: 'fraction',
					scale: 1,
					opacity: 0.90,
					src: 'icon/closerbutton.png'
				}))
			});

			closerFeature.setStyle(closerStyle);
			closerFeature.closeChartId = chartId;

			closeIconLayer.getSource().addFeature(closerFeature);
		}
	}


	function removeChart(closerFeature)
    {
        for (var i = 0; i < chartLayerCache.chartLayers.length; i++)
        {
            if (chartLayerCache.chartLayers[i].chartId === closerFeature.closeChartId)
            {
                var closingChartLayer = chartLayerCache.chartLayers[i];

                map.removeLayer(closingChartLayer);
                closeIconLayer.getSource().removeFeature(closerFeature);
                removeFromArray(chartLayerCache.chartLayers, closingChartLayer);

                break;
            }
        }
    }


	function clearAllCharts()
	{
		for (var i = 0; i < chartLayerCache.chartLayers.length; i++)
            map.removeLayer(chartLayerCache.chartLayers[i]);


		var iconFeatures = closeIconLayer.getSource().getFeatures();

		for (var j = 0; j < iconFeatures.length; j++)
		{
			if (iconFeatures[j].closeChartId)
				closeIconLayer.getSource().removeFeature(iconFeatures[j]);
		}

        chartLayerCache.chartLayers = [];
	}

	//endregion


	//region TRAFFIC / OWN PLANE

	function drawOwnPlane(lastPositions)
	{
		var layerSource = locationLayer.getSource();
		layerSource.clear();

		if (lastPositions)
			drawTrafficTrack({ actype: "OWN", positions: lastPositions }, layerSource, false, Date.now());
	}


	function drawTraffic(acList, maxTrafficAltitudeFt, currentTimestamp)
	{
		var layerSource = trafficLayer.getSource();
		layerSource.clear();

		if (acList)
		{
			var extent = getViewExtentLatLon();
			var acListVisible = [];

			// filter by visibility
			for (var acAddress in acList)
			{
				var ac = acList[acAddress];
				var lastPos = ac.positions[ac.positions.length - 1];
				ac.receiver = lastPos.receiver;

				// hide traffic higher than max alt
				if (lastPos.altitude && m2ft(lastPos.altitude) > maxTrafficAltitudeFt)
				    continue;

				// hide traffic outside map extent
				if (lastPos.longitude < extent[0] || lastPos.latitude < extent[1] || lastPos.longitude > extent[2] || lastPos.latitude > extent[3])
				    continue;

				acListVisible.push(ac);
			}

			// hide trails if there's too much traffic on the screen
			var showTrails = acListVisible.length <= maxTrafficForTrails;

			for (var i = 0; i < acListVisible.length; i++)
                drawTrafficTrack(acListVisible[i], layerSource, showTrails, currentTimestamp);
        }
	}


	function drawTrafficTrack(ac, layerSource, showTrails, currentTimestamp)
	{
		if (!ac || !ac.positions)
			return;

		var maxIdx = ac.positions.length - 1;

		// draw track dots
		if (showTrails) {
			for (var i = maxIdx; i >= 0; i--) {
				if (currentTimestamp - ac.positions[i].timestamp < maxAgeSecTrackDots * 1000) {
					var trackDotFeature = createTrackDotFeature(ac.positions[i], ac.actype);
					layerSource.addFeature(trackDotFeature);
				}
				else
					break;
			}
		}

		// draw plane
		if (maxIdx >= 0) {
			var rotation = 0;

			if (maxIdx > 0) {
				rotation = getBearing(
                    ac.positions[maxIdx - 1].latitude,
                    ac.positions[maxIdx - 1].longitude,
                    ac.positions[maxIdx].latitude,
                    ac.positions[maxIdx].longitude,
					0);
			}

			// plane icon
			var planeFeature = createTrafficFeature(
                ac.positions[maxIdx],
				rotation,
				ac,
                currentTimestamp);

			layerSource.addFeature(planeFeature);

			// registration or callsign text
			if (ac.registration || ac.callsign)
			{
				var csFeature = createRegistrationCallsignFeature(ac);

				layerSource.addFeature(csFeature);
			}
		}



		function createTrackDotFeature(position, trafficType)
		{
			var color;

			if (trafficType === "OWN")
				color = "#0000FF";
			else
				color = "#FF0000";

			var trackPoint = new ol.Feature({
				geometry: new ol.geom.Point(ol.proj.fromLonLat([position.longitude, position.latitude]))
			});

			trackPoint.setStyle(
				new ol.style.Style({
					image: new ol.style.Circle({
						radius: 2,
						fill: new ol.style.Fill({
							color: color
						})
					})
				})
			);

			return trackPoint;
		}


		function createTrafficFeature(position, rotation, ac, currentTimestamp)
		{
			var icon = "icon/";
			var color = "#FF0000";
			var heighttext = "";
			var typetext = "";

			if (!ac.registration)
				ac.registration = "";

			if (position.altitude > 0)
				heighttext = Math.round(m2ft(position.altitude)).toString() + " ft"; // TODO: einstellbar

			var iconSuffix = "";
			if (position.timestamp && (currentTimestamp - position.timestamp > maxAgeSecInactive * 1000))
				iconSuffix = "_inactive";

			var rotWithView = true;

			switch (ac.actype)
			{
				case "OWN":
					icon += "own_plane.png";
					color = "#0000FF";
					break;
				case "HELICOPTER_ROTORCRAFT":
					icon += "traffic_heli" + iconSuffix + ".png";
					break;
				case "GLIDER":
					icon += "traffic_glider" + iconSuffix + ".png";
					break;
				case "PARACHUTE":
				case "HANG_GLIDER":
				case "PARA_GLIDER":
					icon += "traffic_parachute" + iconSuffix + ".png";
					rotation = 0;
					rotWithView = false;
					break;
				case "BALLOON":
				case "AIRSHIP":
					icon += "traffic_balloon" + iconSuffix + ".png";
					rotation = 0;
					rotWithView = false;
					break;
				case "UNKNOWN":
					icon += "traffic_unknown" + iconSuffix + ".svg";
					rotation = 0;
					rotWithView = false;
					break;
				case "STATIC_OBJECT":
					icon += "traffic_static" + iconSuffix + ".png";
					rotation = 0;
					rotWithView = false;
					break;
				case "DROP_PLANE":
					typetext = " - Drop Plane";
					icon += "traffic_plane" + iconSuffix + ".png";
					break;
				case "UFO":
					typetext = " - UFO";
					icon += "traffic_plane" + iconSuffix + ".png";
					break;
				case "UAV":
					icon += "traffic_uav" + iconSuffix + ".png";
					break;
                case "JET_AIRCRAFT":
                    icon += "traffic_jetplane" + iconSuffix + ".png";
                    break;
				case "POWERED_AIRCRAFT":
				case "TOW_PLANE":
				default:
					icon += "traffic_plane" + iconSuffix + ".png";
					break;
			}

			var planeFeature = new ol.Feature({
				geometry: new ol.geom.Point(ol.proj.fromLonLat([position.longitude, position.latitude]))
			});

			planeFeature.setStyle(
				new ol.style.Style({
					image: new ol.style.Icon({
						anchor: [0.5, 0.5],
						anchorXUnits: 'fraction',
						anchorYUnits: 'fraction',
						scale: 1,
						opacity: 1.00,
						rotation: deg2rad(rotation),
						rotateWithView: rotWithView,
						src: icon
					}),
					text: new ol.style.Text({
						font: 'bold 14px Calibri,sans-serif',
						text: heighttext + typetext,
						fill: new ol.style.Fill({color: color}),
						stroke: new ol.style.Stroke({color: '#FFFFFF', width: 2}),
						offsetX: 0,
						offsetY: 35
					})
				})
			);

			planeFeature.acInfo = ac;

			return planeFeature;
		}


		function createRegistrationCallsignFeature(ac)
		{
			var icon = "icon/";
			var color = "#FF0000";
            var regCallText = "";

            if (ac.opCallsign)
                regCallText = ac.opCallsign;
            else if (ac.callsign && !equalsRegCall(ac.registration, ac.callsign))
                regCallText = ac.callsign;
            else if (ac.registration)
                regCallText = ac.registration;

            var position = ac.positions[ac.positions.length - 1];

			var csFeature = new ol.Feature({
				geometry: new ol.geom.Point(ol.proj.fromLonLat([position.longitude, position.latitude]))
			});

			csFeature.setStyle(
				new ol.style.Style({
					text: new ol.style.Text({
						font: 'bold 14px Calibri,sans-serif',
						text: regCallText,
						fill: new ol.style.Fill({color: color}),
						stroke: new ol.style.Stroke({color: '#FFFFFF', width: 2}),
						offsetX: 0,
						offsetY: -35
					})
				})
			);

			csFeature.acInfo = ac;

			return csFeature;
		}


		function equalsRegCall(registration, callsign)
        {
            regStripped = registration.toUpperCase().replace(/[^A-Z0-9]/g, '');
            callStripped = callsign.toUpperCase().replace(/[^A-Z0-9]/g, '');

            return regStripped === callStripped;
        }
	}

	//endregion


	//region UTILS
	
	function getMercatorCoordinates(lat, lon)
	{
		return ol.proj.fromLonLat([lon, lat]);
	}


	function getLatLonCoordinates(mercatorPosition)
	{
		var latLon = ol.proj.toLonLat(mercatorPosition);
		return { latitude: latLon[1], longitude: latLon[0] };
	}


	function getMercatorFromPixel(x, y)
	{
		return map.getCoordinateFromPixel([x, y]);
	}


    function getLatLonFromPixel(x, y)
    {
        return getLatLonCoordinates((map.getCoordinateFromPixel([x, y])));
    }


    function getDistance(lat1, lon1, lat2, lon2)
	{
		return (wgs84Sphere.haversineDistance([lon1,lat1],[lon2,lat2]) * 0.000539957);
	}


	function getBearing(lat1, lon1, lat2, lon2, magvar)
	{
		var toRad = (Math.PI / 180);
		var toDeg = (180 / Math.PI);

		var f1 = lat1 * toRad;
		var f2 = lat2 * toRad;
		var dl = (lon2 - lon1) * toRad;
		var y = Math.sin(dl) * Math.cos(f2);
		var x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
		var t = Math.atan2(y, x);

		return ((t * toDeg + 360) % 360 - magvar);
	}


	function getAirport(icao)
	{
		return mapFeatureService.getAirportByIcao(icao);
	}


	function getCoordinateGeopoint(lonLat)
	{
		var clickPoint = {
			type: 'user',
			longitude: lonLat[0],
			latitude: lonLat[1],
			name: Math.round(lonLat[1] * 10000) / 10000 + " " + Math.round(lonLat[0] * 10000) / 10000,
			//wpname: ol.coordinate.toStringHDMS(lonLat)
			wpname: Math.round(lonLat[1] * 10000) / 10000 + " " + Math.round(lonLat[0] * 10000) / 10000
		};


		return clickPoint;
	}


    function convertPolygonToMercator(latLonPolygon)
    {
        var merCoords, lonLat;
        var merPoly = [];

        for (var i = 0; i < latLonPolygon.length; i++)
        {
            lonLat = latLonPolygon[i];
            merCoords = ol.proj.fromLonLat(lonLat);
            merPoly.push(merCoords);
        }

        return merPoly;
    }


    //endregion
}
