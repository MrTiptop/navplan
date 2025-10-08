<?php
	require_once "config.php";
	require_once "helper.php";

	header('Content-Type: application/json');

	if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
		die(json_encode(['success' => 0, 'error' => 'Invalid request method']));
	}

	if (!isset($_FILES['waypointFile']) || $_FILES['waypointFile']['error'] !== UPLOAD_ERR_OK) {
		die(json_encode(['success' => 0, 'error' => 'File upload failed']));
	}

	$file = $_FILES['waypointFile'];
	$fileName = $file['name'];
	$fileTmpPath = $file['tmp_name'];
	$fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

	// Read file content
	$fileContent = file_get_contents($fileTmpPath);

	if ($fileContent === false) {
		die(json_encode(['success' => 0, 'error' => 'Failed to read file']));
	}

	$waypoints = [];

	try {
		switch ($fileExtension) {
			case 'gpx':
				$waypoints = parseGPX($fileContent);
				break;
			case 'kml':
				$waypoints = parseKML($fileContent);
				break;
			case 'fpl':
				$waypoints = parseFPL($fileContent);
				break;
			default:
				die(json_encode(['success' => 0, 'error' => 'Unsupported file format']));
		}

		echo json_encode([
			'success' => 1,
			'waypoints' => $waypoints,
			'count' => count($waypoints)
		]);
	} catch (Exception $e) {
		die(json_encode(['success' => 0, 'error' => $e->getMessage()]));
	}


	function parseGPX($content) {
		$waypoints = [];
		
		try {
			$xml = new SimpleXMLElement($content);
			$namespaces = $xml->getNamespaces(true);
			
			// Parse waypoints
			foreach ($xml->wpt as $wpt) {
				$lat = (float) $wpt['lat'];
				$lon = (float) $wpt['lon'];
				$name = (string) $wpt->name;
				$desc = (string) $wpt->desc;
				$ele = isset($wpt->ele) ? (float) $wpt->ele : null;
				
				$waypoints[] = [
					'type' => 'waypoint',
					'checkpoint' => $name ? $name : 'WP' . (count($waypoints) + 1),
					'latitude' => $lat,
					'longitude' => $lon,
					'elevation' => $ele,
					'remark' => $desc,
					'freq' => '',
					'callsign' => '',
					'alt' => '',
					'isminalt' => 0,
					'ismaxalt' => 0,
					'isaltatlegstart' => 0,
					'supp_info' => ''
				];
			}
			
			// Parse route points
			foreach ($xml->rte as $rte) {
				foreach ($rte->rtept as $rtept) {
					$lat = (float) $rtept['lat'];
					$lon = (float) $rtept['lon'];
					$name = (string) $rtept->name;
					$desc = (string) $rtept->desc;
					$ele = isset($rtept->ele) ? (float) $rtept->ele : null;
					
					$waypoints[] = [
						'type' => 'waypoint',
						'checkpoint' => $name ? $name : 'WP' . (count($waypoints) + 1),
						'latitude' => $lat,
						'longitude' => $lon,
						'elevation' => $ele,
						'remark' => $desc,
						'freq' => '',
						'callsign' => '',
						'alt' => '',
						'isminalt' => 0,
						'ismaxalt' => 0,
						'isaltatlegstart' => 0,
						'supp_info' => ''
					];
				}
			}
			
			// Parse track points (if no waypoints or routes found)
			if (empty($waypoints)) {
				foreach ($xml->trk as $trk) {
					foreach ($trk->trkseg as $seg) {
						$pointCount = 0;
						foreach ($seg->trkpt as $trkpt) {
							$pointCount++;
							// Only take every 10th point to avoid too many waypoints
							if ($pointCount % 10 === 0) {
								$lat = (float) $trkpt['lat'];
								$lon = (float) $trkpt['lon'];
								$ele = isset($trkpt->ele) ? (float) $trkpt->ele : null;
								
								$waypoints[] = [
									'type' => 'waypoint',
									'checkpoint' => 'TRK' . count($waypoints),
									'latitude' => $lat,
									'longitude' => $lon,
									'elevation' => $ele,
									'remark' => 'Track point',
									'freq' => '',
									'callsign' => '',
									'alt' => '',
									'isminalt' => 0,
									'ismaxalt' => 0,
									'isaltatlegstart' => 0,
									'supp_info' => ''
								];
							}
						}
					}
				}
			}
			
		} catch (Exception $e) {
			throw new Exception('Failed to parse GPX file: ' . $e->getMessage());
		}
		
		return $waypoints;
	}


	function parseKML($content) {
		$waypoints = [];
		
		try {
			$xml = new SimpleXMLElement($content);
			$namespaces = $xml->getNamespaces(true);
			$xml->registerXPathNamespace('kml', 'http://www.opengis.net/kml/2.2');
			
			// Parse Placemarks
			$placemarks = $xml->xpath('//kml:Placemark');
			
			foreach ($placemarks as $placemark) {
				$name = (string) $placemark->name;
				$desc = (string) $placemark->description;
				
				// Parse Point
				if (isset($placemark->Point)) {
					$coordinates = (string) $placemark->Point->coordinates;
					$coords = explode(',', trim($coordinates));
					
					if (count($coords) >= 2) {
						$lon = (float) $coords[0];
						$lat = (float) $coords[1];
						$ele = isset($coords[2]) ? (float) $coords[2] : null;
						
						$waypoints[] = [
							'type' => 'waypoint',
							'checkpoint' => $name ? $name : 'WP' . (count($waypoints) + 1),
							'latitude' => $lat,
							'longitude' => $lon,
							'elevation' => $ele,
							'remark' => $desc,
							'freq' => '',
							'callsign' => '',
							'alt' => '',
							'isminalt' => 0,
							'ismaxalt' => 0,
							'isaltatlegstart' => 0,
							'supp_info' => ''
						];
					}
				}
				
				// Parse LineString (route)
				if (isset($placemark->LineString)) {
					$coordinates = (string) $placemark->LineString->coordinates;
					$coordLines = explode("\n", trim($coordinates));
					
					foreach ($coordLines as $line) {
						$coords = explode(',', trim($line));
						
						if (count($coords) >= 2) {
							$lon = (float) $coords[0];
							$lat = (float) $coords[1];
							$ele = isset($coords[2]) ? (float) $coords[2] : null;
							
							$waypoints[] = [
								'type' => 'waypoint',
								'checkpoint' => $name ? $name . '-' . (count($waypoints) + 1) : 'WP' . (count($waypoints) + 1),
								'latitude' => $lat,
								'longitude' => $lon,
								'elevation' => $ele,
								'remark' => $desc,
								'freq' => '',
								'callsign' => '',
								'alt' => '',
								'isminalt' => 0,
								'ismaxalt' => 0,
								'isaltatlegstart' => 0,
								'supp_info' => ''
							];
						}
					}
				}
			}
			
		} catch (Exception $e) {
			throw new Exception('Failed to parse KML file: ' . $e->getMessage());
		}
		
		return $waypoints;
	}


	function parseFPL($content) {
		$waypoints = [];
		
		try {
			$xml = new SimpleXMLElement($content);
			
			// Garmin FPL format
			if (isset($xml->{'flight-plan'})) {
				$fp = $xml->{'flight-plan'};
				
				// Parse route points
				if (isset($fp->{'route'})) {
					foreach ($fp->{'route'}->{'route-point'} as $rp) {
						$type = (string) $rp['type'];
						
						if ($type === 'airport') {
							$waypoints[] = [
								'type' => 'airport',
								'checkpoint' => (string) $rp->{'airport-id'},
								'airport_icao' => (string) $rp->{'airport-id'},
								'latitude' => (float) $rp->{'lat'},
								'longitude' => (float) $rp->{'lon'},
								'remark' => (string) $rp->{'identifier'},
								'freq' => '',
								'callsign' => '',
								'alt' => '',
								'isminalt' => 0,
								'ismaxalt' => 0,
								'isaltatlegstart' => 0,
								'supp_info' => ''
							];
						} elseif ($type === 'waypoint') {
							$waypoints[] = [
								'type' => 'waypoint',
								'checkpoint' => (string) $rp->{'identifier'},
								'latitude' => (float) $rp->{'lat'},
								'longitude' => (float) $rp->{'lon'},
								'remark' => (string) $rp->{'comment'},
								'freq' => '',
								'callsign' => '',
								'alt' => '',
								'isminalt' => 0,
								'ismaxalt' => 0,
								'isaltatlegstart' => 0,
								'supp_info' => ''
							];
						} elseif ($type === 'user-waypoint') {
							$waypoints[] = [
								'type' => 'waypoint',
								'checkpoint' => (string) $rp->{'identifier'},
								'latitude' => (float) $rp->{'lat'},
								'longitude' => (float) $rp->{'lon'},
								'remark' => (string) $rp->{'comment'},
								'freq' => '',
								'callsign' => '',
								'alt' => '',
								'isminalt' => 0,
								'ismaxalt' => 0,
								'isaltatlegstart' => 0,
								'supp_info' => ''
							];
						}
					}
				}
			}
			
		} catch (Exception $e) {
			throw new Exception('Failed to parse FPL file: ' . $e->getMessage());
		}
		
		return $waypoints;
	}
?>

