var LASERTRACKER = (function () {
	var exports = {};
	var firebase;

	exports.init = function init() {
		firebase = new Firebase("http://lazzzor.firebaseio.com/");
	}

	exports.login = function login(token) {
		firebase.authWithOAuthPopup(token, function(error, authData) {
	  		if (error) {
    			console.log("Login Failed!", error);
	  		} 
  			else {
    			console.log("Authenticated successfully with payload:", authData);
  			}
		});
	}

	return exports;
}());

$(document).ready(LASERTRACKER.init);