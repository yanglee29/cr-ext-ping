angular.module('pingApp', ['ngRoute'])
	.constant("CONST", {
		quality: {
			good: 'good',
			avg: 'avg',
			bad: 'bad',
			none: 'none'
		}
	})
	.factory("probeFactory", function($http) {
		var ls = localStorage || {},
			probeData,

			getProbeData = function() {
				if (ls.probeData) {
					probeData = JSON.parse(ls.probeData);
				}
				return probeData || [];
			},
			saveProbeData = function() {
				if (angular.isArray(probeData)) {
					ls.probeData = JSON.stringify(probeData)
				}
			},
			generateNewId = function() {
				var maxId = probeData
					.map(function(probe) { return probe.id })
					.reduce(function(max, probeId) {
						return Math.max(max, probeId);
					}, 0);
				return maxId + 1;
			},
			// First-run initialization.
			initialize = function(defaultProbes) {
				if (ls.probeData) {
					probeData = getProbeData();
				} else {
					var id = 1;
					probeData = defaultProbes.map(function(probe) {
						probe.id = id++;
						return probe;
					});
					saveProbeData();
				}
			};

		initialize(PROBES);

		return {
			getProbes: function() {
				return angular.copy(probeData);
			},
			getProbe: function(id) {
				var probe = probeData.filter(function(probe) { return probe.id === id; })[0];
				return angular.copy(probe);
			},
			createProbe: function(newProbe) {
				newProbe.id = generateNewId();
				probeData.push(newProbe);

				saveProbeData();
			},
			editProbe: function(id, data) {
				this.removeProbe(id);
				this.createProbe(data);

				saveProbeData();
			},
			removeProbe: function(id) {
				var probe = this.getProbe(id),
					probeIx = probeData.indexOf(probe);
				probeData.splice(probeIx, 1);

				saveProbeData();
			}
		};
	})
	.controller('ConfigCtrl', function($scope, probeFactory) {
		$scope.probes = probeFactory.getProbes();
		$scope.remove = function(id) {
			probeFactory.removeProbe(id);
			$scope.probes = probeFactory.getProbes();
		}
	})
	////////////////////////////////////////////////////////////////////
	// Ping List Controller
	////////////////////////////////////////////////////////////////////
	.controller('PingListCtrl', function($scope, $http, CONST, probeFactory) {
		var probeArr = probeFactory.getProbes();
		$scope.probes = probeArr.map(function(probe) {
			return {
				data: probe,
				inProgress: false,
				quality: CONST.quality.none,
				ms: 0,
				setMs: function(value) {
					this.ms = value;
					if (this.ms > 0 && this.ms < 500) {
						this.quality = CONST.quality.good;
					} else if ( this.ms < 1000) {
						this.quality = CONST.quality.avg;
					} else {
						this.quality = CONST.quality.bad;
					}
				},
				ping: function() {
					var self = this,
						startTime = new Date().getTime();
					this.inProgress = true;
					$http.get(this.data.url)
						.success(function(data, status) {
							//console.log("SUCCESS: ", self.data.url, " - ", status);
							self.setMs(new Date().getTime() - startTime);
							self.inProgress = false;

						}).error(function(data, status) {
							//console.warn("FAIL: ", self.data.url, " - ", status);
							self.setMs(new Date().getTime() - startTime);
							self.inProgress = false;
						});
				}
			}
		});

		$scope.pingNow = function() {
			$scope.probes.forEach(function(probe){
				probe.ping();
			}, this);
		};
	})
	////////////////////////////////////////////////////////////////////
	// Create/Edit Ping Controller
	////////////////////////////////////////////////////////////////////
	.controller('EditPingCtrl', function($scope, $http, probeFactory, $location, $routeParams) {
		var id = Number($routeParams.pingId);
		if (id) {
			var probe = probeFactory.getProbe(id);
			$scope.isNew = false;
			$scope.title = probe.title;
			$scope.url = probe.url;
		} else {
			$scope.isNew = true;
		}

		$scope.saveProbe = function() {
			if (id) {
				probeFactory.editProbe(id, {
			      title: $scope.title,
			      url: $scope.url
				});
			} else {
				// TODO: Add real validation!
				if ($scope.title && $scope.url) {
					probeFactory.createProbe({
				        title: $scope.title,
				        url: $scope.url
					});
				}
			}
			$location.path("/config");
		};
	})
	////////////////////////////////////////////////////////////////////
	// App Configuration
	////////////////////////////////////////////////////////////////////
	.config(function($routeProvider, $compileProvider) {
		// Fix a.href links for chrome extension
		$compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|mailto|chrome-extension):/);
		// Set up routes
		$routeProvider
			.when('/', {
				templateUrl: 'views/main.html',
				controller: 'PingListCtrl'
			})
			.when('/config', {
				templateUrl: 'views/config.html',
				controller: 'ConfigCtrl'
			})
			.when('/ping/new', {
				templateUrl: 'views/editPing.html',
				controller: 'EditPingCtrl'
			})
			.when('/ping/:pingId/edit', {
				templateUrl: 'views/editPing.html',
				controller: 'EditPingCtrl'
			})
			.otherwise({
				redirectTo: '/'
			});
	});
