'use strict';

angular.module('app').controller('MainController', ['$scope', 'ServerService', 'UiBasicService', '$timeout', '$mdDialog', '$q', '$sanitize',
    function($scope, $server, $uiBasic, $timeout, $mdDialog, $q, $sanitize) {
        function loadData() {
            return $q(function(resolve, reject) {
                $server.loadData()
                .then(function(tabletop) {
                    var groups = tabletop.sheets('Groups').all();
                    var activities = tabletop.sheets('Activities').all();

                    var tempGroups = [];
                    for (var i = 0; i < groups.length; i++) {
                        groups[i].arrayId = i;
                        groups[i].activities = [];
                        tempGroups[groups[i].type] = groups[i];
                    }
                    
                    for (var i = 0; i < activities.length; i++) {
                        tempGroups[activities[i].type].activities.push(activities[i]);
                    }
                    
                    $scope.activityGroups = groups;
                    $scope.resultInterpretation = tabletop.sheets('Result Interpretation').all();
                    $scope.baselines = tabletop.sheets('Baselines').all();
                    var settings = tabletop.sheets('Settings').all();
                    
                    $scope.settings = [];
                    for (var i = 0; i < settings.length; i++)
                        $scope.settings[settings[i]['setting']] = settings[i]['value'];
                    
                    resolve();
                }, function(tabletop) {
                    reject('Failed to load data.');
                });
            });
        }
        
        var dataPromise = loadData();
        
        dataPromise.then(function() {
            // do nothing for now
        }, function() {
            // do nothing for now
        });
        
        // initial values
        $scope.screenState = 'initializing'; // initializing, starting, calculating, results
        $scope.totalFootprint = 0;
        $scope.resultColumn = {};
        $scope.completedGroupsCount = 0;
        
        var calculateColumnPositions = function() {
            switch ($scope.screenState) {
                case 'initializing':
                case 'starting':
                case 'calculating':
                    var columnWidth = 280;
                    var columnCount = $scope.activityGroups.length;
                    $scope.resultColumn.width = columnWidth;
                    $scope.resultColumn.left = window.innerWidth - $scope.resultColumn.width;
                    var remainingWidth = $scope.resultColumn.left;
                    var collapsedColumnWidth = Math.round((remainingWidth - columnWidth) / (columnCount - 1));
                    $scope.activityGroups[0].left = 0;
                    for (var i = 0; i < $scope.activityGroups.length - 1; i++) {
                        if (!$scope.activityGroups[i].selected)
                            $scope.activityGroups[i + 1].left = $scope.activityGroups[i].left + collapsedColumnWidth;
                        else
                            $scope.activityGroups[i + 1].left = $scope.activityGroups[i].left + columnWidth;
                    }
                    break;
                case 'results':
                    $scope.resultColumn.left = 0;
                    $scope.resultColumn.width = window.innerWidth;
                    for (var i = 0; i < $scope.activityGroups.length; i++) {
                        $scope.activityGroups[i].left = 0;
                    }
                    break;
            }
            
            // calculate background image size
            
            var fullResultsEl = document.getElementById('fullResults');

            if (window.innerWidth / window.innerHeight > 4896 / 3264) {
                fullResultsEl.classList.remove('portrait');
                fullResultsEl.classList.add('landscape');
            } else {
                fullResultsEl.classList.remove('landscape');
                fullResultsEl.classList.add('portrait');
            }
        }
        
        if (window.innerWidth < 568) {
            $mdDialog.show(
              $mdDialog.alert()
                .parent(angular.element(document.querySelector('#popupContainer')))
                .clickOutsideToClose(true)
                .title('')
                .content('Your device screen is too small; please turn to landscape mode or try the app on a computer or tablet for a better user experience.')
                .ok('Got it!')
            );
        } else {
            var isOpera = !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
                // Opera 8.0+ (UA detection to detect Blink/v8-powered Opera)
            var isFirefox = typeof InstallTrigger !== 'undefined';   // Firefox 1.0+
            var isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
                // At least Safari 3+: "[object HTMLElementConstructor]"
            var isChrome = !!window.chrome && !isOpera;              // Chrome 1+
            var isIE = /*@cc_on!@*/false || !!document.documentMode; // At least IE6
            
            if (!isSafari && !isChrome && !isFirefox) {
                $mdDialog.show(
                  $mdDialog.alert()
                    .parent(angular.element(document.querySelector('#popupContainer')))
                    .clickOutsideToClose(true)
                    .title('')
                    .content('We try to provide you the best experience.\n\nThis website currently works well in Chrome, Safari or Firefox. We recommend you viewing it in Chrome, Safari or Firefox.\n\nThey are great browsers! :)')
                    .ok('Got it!')
                );
            }
        }
        
        $(window).resize(function() {
            calculateColumnPositions();
            $scope.$digest();
        });
        
        $timeout(function() {
            $scope.screenState = 'starting';
        }, 500);

        $scope.selectedActivities = [];
        
        $scope.selectActivityGroup = function(activityGroup) {
            $scope.selectedActivityGroup = activityGroup;
            for (var i = 0; i < $scope.activityGroups.length; i++) {
                $scope.activityGroups[i].selected = false;
            }
            activityGroup.selected = true;
            calculateColumnPositions();
        };
        
        $scope.selectActivity = function(activity, activityGroup) {
            // do not allow selecting twice
            if (activity.selected)
                return;
            
            activity.selected = true;
            
            // if the same type of activity has been selected, remove it first
            for (var i = 0; i < $scope.selectedActivities.length; i++) {
                if ($scope.selectedActivities[i].type == activity.type) {
                    $scope.selectedActivities[i].selected = false;
                    $scope.totalFootprint -= $scope.selectedActivities[i].footprint;
                    $scope.selectedActivities.splice(i, 1);
                    
                    break;
                }
            }

            $scope.selectedActivities.push(activity);
            $scope.totalFootprint += activity.footprint;
            
            if (!activityGroup.completed) {
                activityGroup.completed = true;
                $scope.completedGroupsCount++;
                
                if ($scope.completedGroupsCount == $scope.activityGroups.length) {
                    $mdDialog.show(
                      $mdDialog.confirm()
                        .parent(angular.element(document.querySelector('#popupContainer')))
                        .clickOutsideToClose(true)
                        .title('Done!')
                        .content('Take me to see results now, and see how I compare to other people.')
                        .cancel('Cancel')
                        .ok('See Results')
                    ).then(function() {
                        $scope.seeFullResults();
                    });
                }
            }

            if (activityGroup.arrayId < ($scope.activityGroups.length - 1) && !$scope.activityGroups[activityGroup.arrayId + 1].completed)
                doNextStep();
        };
        
        var doNextStep = function() {
            var id = findSelectedActivityGroupId();
            if (id != null) {
                if (id < $scope.activityGroups.length) {
                    $scope.selectActivityGroup($scope.activityGroups[id + 1]);
                }
            }
        };
        
        var findSelectedActivityGroupId = function() {
            for (var i = 0; i < $scope.activityGroups.length; i++) {
                if ($scope.activityGroups[i].selected)
                    return i;
            }
            
            return null;
        };
        
        $scope.deselectActivity = function(activity) {
            for (var i = 0; i < $scope.selectedActivities.length; i++) {
                if ($scope.selectedActivities[i] === activity) {
                    $scope.selectedActivities.splice(i, 1);
                    break;
                }
            }
            
            activity.selected = false;
            
            $scope.totalFootprint -= activity.footprint;
        };
        
        $scope.start = function() {
            $scope.screenState = "calculating";
            
            dataPromise.then(function() {
                calculateColumnPositions();
            });
        };
        
        $scope.seeFullResults = function() {
            $scope.screenState = "results";
            calculateColumnPositions();
        }
        
        $scope.backToCalculation = function() {
            $scope.screenState = "calculating";
            calculateColumnPositions();
        }
        
        $scope.shareResults = function(ev) {
            var element = angular.element(document.getElementById("fullResults"));
            
            FB.login(function(response) {
                checkLoginState(function(response) {
                    // get name
                    FB.api('/me', function(response) {
                        if (response.name) {
                            $scope.userFullName = response.name;
                            $scope.takingScreenshot = true;
                            $scope.$digest();
                        } else
                            console.error(response.error.message);

                        /*$mdDialog.show({
                            controller: ProgressDialogController,
                            templateUrl: 'app/partials/progressDialog.tmpl.html',
                            parent: angular.element(document.body),
                            targetEvent: ev,
                            locals: { title: 'Share To Facebook', message: 'Preparing to share...' }
                        });*/
            
                        html2canvas(element, {
                            onrendered: function(canvas) {
                                $scope.takingScreenshot = false;
                                $scope.$digest();
                                
                                var imgData = canvas.toDataURL();
            
                                $mdDialog.show({
                                    controller: ShareDialogController,
                                    templateUrl: 'app/partials/shareDialog.tmpl.html',
                                    parent: angular.element(document.body),
                                    targetEvent: ev,
                                    clickOutsideToClose: true,
                                    locals: { fbImage: imgData }
                                })
                                .then(function(fbStatusMessage) {
                                    // login
            
                                    imgData = imgData.replace(/^data:image\/(png|jpe?g);base64,/, '');
                                    // convert the base64 string to string containing the binary data
                                    imgData = conversions.base64ToString(imgData);
                                    
                                    $mdDialog.show({
                                        controller: ProgressDialogController,
                                        templateUrl: 'app/partials/progressDialog.tmpl.html',
                                        parent: angular.element(document.body),
                                        /*targetEvent: ev,*/
                                        locals: { title: 'Sharing Image To Facebook...', message: 'Please do not close the window; it may takes a few seconds to a few minutes depending on your network connection.' }
                                    });
									
                                    postImage({
                                        fb: { // data to be sent to FB
                                            caption: fbStatusMessage,
                                            // place any other API params you wish to send. Ex: place / tags etc.
                                            accessToken: FB_ACCESS_TOKEN,
                                            file: {
                                              name: 'File Name.jpg',
                                              type: 'image/jpeg', // or png
                                              dataString: imgData
                                            }
                                        },
                                        call: { // options of the $.ajax call
                                            url: 'https://graph.facebook.com/me/photos', // or replace *me* with albumid
                                            success: function() {
                                                $mdDialog.show(
                                                  $mdDialog.alert()
                                                    .parent(angular.element(document.querySelector('#popupContainer')))
                                                    .clickOutsideToClose(true)
                                                    .title('Share successully.')
                                                    .content('The result has been shared to your facebook wall.')
                                                    .ok('Got it!')
                                                    .targetEvent(ev)
                                                );
                                            },
                                            error: function() {
                                                console.error('failed');
                                            }
                                        }
                                    });
                                });
                            }
                        });
                    });
                }, function() {
                    // login failed
                });
            }, {scope: 'public_profile,email,user_friends,publish_actions'});
            
            function ShareDialogController($scope, $mdDialog, fbImage) {
                $scope.fbMessage = 'Check out my carbon footprint.\nCalculated via http://bit.ly/carbonsgsh';
                $scope.fbImage = fbImage;
                $scope.hide = function() {
                    $mdDialog.hide();
                };
                $scope.cancel = function() {
                    $mdDialog.cancel();
                };
                $scope.answer = function(answer) {
                    $mdDialog.hide(answer);
                };
            }
            
            function ProgressDialogController($scope, $mdDialog, title, message) {
                $scope.title = title;
                $scope.message = message;
            }
        }
        
        $scope.showCredits = function() {
            $mdDialog.show(
              $mdDialog.alert()
                .parent(angular.element(document.querySelector('#popupContainer')))
                .clickOutsideToClose(true)
                .content('<div>'
                         + $sanitize($scope.settings.credits) +
                         '</div>'
                        )
                .ok('Cool!')
            );
        };
    }
]);