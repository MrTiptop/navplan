/**
 * Waypoint Controller
 */

navplanApp
	.controller('waypointCtrl', waypointCtrl);
	
waypointCtrl.$inject = ['$scope', '$http', 'geopointService', 'fuelService', 'userService', 'globalData'];

function waypointCtrl($scope, $http, geopointService, fuelService, userService, globalData) {
	$scope.globalData = globalData;
	$scope.newWp = undefined;
    $scope.sortableOptions = {
        //'ui-floating': true,
        axis: 'y',
        stop: function(e, ui) {
            $scope.updateWaypoints();
            $scope.discardCache();
            $scope.$apply();
        }
    };


	$scope.importWaypoints = function()
	{
		var fileInput = document.getElementById('waypoint_import');
		var file = fileInput.files[0];

		if (!file) {
			$scope.showErrorMessage('Please select a file to import');
			return;
		}

		// Check file extension
		var fileName = file.name;
		var fileExtension = fileName.split('.').pop().toLowerCase();
		
		if (!['gpx', 'kml', 'fpl'].includes(fileExtension)) {
			$scope.showErrorMessage('Unsupported file format. Please use GPX, KML, or FPL files.');
			return;
		}

		// Create FormData object
		var formData = new FormData();
		formData.append('waypointFile', file);

		// Upload file
		$http.post('php/waypointImport.php', formData, {
			transformRequest: angular.identity,
			headers: {'Content-Type': undefined}
		})
		.then(
			function(response) // success
			{
				if (response.data.success === 1 && response.data.waypoints) {
					// Clear current waypoints or ask user
					if ($scope.globalData.navplan.waypoints.length > 0) {
						$scope.showRuSureMessage(
							"Import Waypoints",
							"Do you want to append waypoints to the current route or replace it?",
							function() {
								// Replace
								$scope.globalData.navplan.waypoints = [];
								$scope.addImportedWaypoints(response.data.waypoints);
							},
							function() {
								// Append
								$scope.addImportedWaypoints(response.data.waypoints);
							}
						);
					} else {
						// No waypoints, just add them
						$scope.addImportedWaypoints(response.data.waypoints);
					}
					
					// Clear file input
					fileInput.value = '';
				} else {
					$scope.showErrorMessage('Failed to import waypoints: ' + (response.data.error || 'Unknown error'));
				}
			},
			function(response) // error
			{
				logResponseError("ERROR importing waypoints", response);
				$scope.showErrorMessage('Failed to import waypoints');
			}
		);
	};


	$scope.addImportedWaypoints = function(waypoints)
	{
		for (var i = 0; i < waypoints.length; i++) {
			var wp = waypoints[i];
			$scope.globalData.navplan.waypoints.push(wp);
		}
		
		$scope.updateWaypoints();
		$scope.discardCache();
		$scope.showSuccessMessage('Successfully imported ' + waypoints.length + ' waypoints!');
	};


    $scope.loadNavplan = function()
	{
		userService.readNavplan($scope.selectedNavplanId)
			.then(
			    function(response) // success
                {
                    if (response && response.data && response.data.navplan)
                        $scope.loadNavplanToGlobalData(response.data.navplan);
                    else
                        logResponseError("ERROR reading route", response);
                },
			    function(response) // error
                {
                    logResponseError("ERROR reading route", response);
                }
            );
	};
	
	
	$scope.saveNavplan = function()
	{
		if ($scope.globalData.navplan.id)
		{
			userService.updateNavplan($scope.globalData)
                .then(
                    function(response) // success
                    {
                        if (response && response.data && response.data.success === 1) {
                            $scope.readNavplanList();
                            $scope.showSuccessMessage("Route successfully updated!");
                        }
                        else
                            logResponseError("ERROR updating route", response);
                    },
                    function(response) // error
                    {
                        logResponseError("ERROR updating route", response);
		    		}
                );
		}
		else
		{
			userService.createNavplan($scope.globalData)
                .then(
                    function(response) // success
                    {
                        if (response && response.data && response.data.navplan_id >= 0)
                        {
                            $scope.globalData.navplan.id = response.data.navplan_id;
                            $scope.readNavplanList();
                            $scope.showSuccessMessage("Route successfully saved!");
                        }
                        else
                            logResponseError("ERROR creating route", response);
    				},
                    function(response) // error
                    {
                        logResponseError("ERROR creating route", response);
	    			}
                );
		}
	};

    $scope.saveNavplanCopy = function()
    {
        $scope.globalData.navplan.id = undefined;
        $scope.saveNavplan();
    };


	$scope.deleteNavplan = function()
	{
        $scope.showRuSureMessage(
            "Delete Route?",
            "Do you really want to delete this route?",
            function()
            {
                if ($scope.selectedNavplanId) {
                    userService.deleteNavplan($scope.selectedNavplanId)
                        .then(
                            function (response) // success
                            {
                                if (response && response.data && response.data.success === 1) {
                                    $scope.readNavplanList();
                                    $scope.showSuccessMessage("Route successfully deleted!");
                                }
                                else
                                    logResponseError("ERROR deleting route", response);
                            },
                            function (response) // error
                            {
                                logResponseError("ERROR deleting route", response);
                            }
                        );
                }
            }
        );
	};
	

	$scope.searchGeonamesByValue = function(val)
	{
		return geopointService.searchGeonamesByValue($http, val);
	};
	
	
	$scope.editWaypoint = function(wp)
	{
		$scope.globalData.selectedWp = wp;
		$scope.editSelectedWaypoint();
	};
	
	
	$scope.removeWaypoint = function(wp)
	{
		var idx = $scope.globalData.navplan.waypoints.indexOf(wp);
		$scope.globalData.navplan.waypoints.splice(idx, 1);
		$scope.updateWaypoints();
		$scope.discardCache();
	};
	
	
	$scope.removeAlternate = function()
	{
		$scope.globalData.navplan.alternate = undefined;
		$scope.updateWaypoints();
		$scope.discardCache();
	};


    $scope.onReverseWaypointsClicked = function ()
    {
        if ($scope.globalData.navplan.waypoints.length === 0)
            return;

        var wpTmp = [];

        for (var i = $scope.globalData.navplan.waypoints.length - 1; i >= 0; i--)
            wpTmp.push($scope.globalData.navplan.waypoints[i]);

        $scope.globalData.navplan.waypoints = [];

        for (i = 0; i < wpTmp.length; i++)
            $scope.globalData.navplan.waypoints.push(wpTmp[i]);

        $scope.updateWaypoints();
        $scope.discardCache();
    };


	$scope.onKmlClicked = function()
	{
		$scope.exportKml();
	};


    $scope.updateWaypointsAndFuelCalc = function()
    {
        $scope.updateWaypoints();
        $scope.discardCache();
    }
	
	
	$scope.fuelByTime = function(time)
	{
		return fuelService.getFuelByTime(time, $scope.globalData.aircraft.consumption);
	};


    $scope.tripDist = function()
    {
        const wps = $scope.globalData.navplan.waypoints;

        let tripDist = 0;
        for (let i = 0; i < wps.length; i++) {
            const wp = wps[i];

            if (wp.dist) {
                tripDist += wp.dist;
            }
        }

        return tripDist;
    }
	
	
	$scope.formatHourMin = function(minutes)
	{
		if (minutes > 0)
		{
			var h = Math.floor(minutes / 60);
			var m = minutes - h * 60;
			
			return $scope.padNumber(h) + ":" + $scope.padNumber(m);
		}
		else 
			return "";
	};
	
	
	$scope.padNumber = function(num)
	{
		if (num < 10)
			return "0" + num;
		else
			return "" + num;
	};
}
