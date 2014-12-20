var LASERTRACKER = (function () {
	var currentUser = null;
	var exports = {};
	var firebase;

	function formatDate(d) {
		return (d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate() + " " +
			d.getHours() + ":" + d.getMinutes());
	}

	function appendLedger(snapshot) {
		var row = snapshot.val();

		$('#ledger .header').after($('<tr>').append(
			$('<td>').text((new Date(row.date)).toLocaleString()),
			$('<td>').text(row.name),
			$('<td>').text(row.project),
			$('<td>').text(row.time),
			$('<td>').text(row.price),
			$('<td>').text(row.total)
		).toggleClass('payment',row.total>0));
	}

	function setUser(user) {
		var name = (user && user[user.provider].displayName) || "";
		if (user) user.name = name;
		exports.currentUser = currentUser = user;

		$('#loginButton').toggleClass('hidden', user || false);
		$('#logoutButton').toggleClass('hidden', !user);
		$('#displayName').text(name);
		$('#name').val(name);

		if (user) {
			firebase.child('users').child(user.uid).child('price').once('value',function(snapshot) {
				$('#price').val(snapshot.val());
			})
		}
	}

	exports.init = function init() {
		firebase = new Firebase("http://lazzzor.firebaseio.com/");

		firebase.onAuth(function(authData) { setUser(authData); });
		firebase.child('ledger').limitToLast(100).on('child_added', appendLedger);
	}

	exports.login = function login(token) {
		firebase.authWithOAuthPopup(token, function(error, authData) {
	  		if (error) {
    			console.log("Login Failed!", error);
	  		}
	  		else {
	  			$('#loginModal').modal('hide');
	  		}
		});
	}

	exports.updateTotal = function updateTotal() {
		var t = $('#time').val();

		if (!/^\s*(\d+:)?(\d+:)?\d+\s*$/.test(t)) {
			$('#time').parent().addClass('has-error');
		}
		else {
			$('#time').parent().removeClass('has-error');
			// Split the string on : and then reduce multiplying by n^60 (1,60,3600)
			// reduceRight will start with seconds as previous and minutes as
			// current so we start with 60
			var multiplier = 60;
			var seconds = t.split(":").reduceRight(
				function (prev,cur) {
					var r = parseInt(prev)+parseInt(cur)*multiplier;
					multiplier *= 60;
					return r;
				}
			);
			// Convert to minutes, multiply by price and format
			$('#total').val('$'+((seconds/60) * $('#price').val()).toFixed(2));
		}
	}

	exports.rememberPrice = function rememberPrice() {
		if (currentUser) {
			firebase.child('users').child(currentUser.uid).child('price').set($('#price').val());
		}
	}

	function validateTrack() {
		var result = true;

		['#name','#project','#time'].forEach(function(id) {
			$(id).parent().toggleClass('has-error',!$(id).val());

			if (!$(id).val()) 
				result = false;
		});

		return result;
	}

	exports.saveTrack = function saveTrack() {
		if (!validateTrack()) 
			return;

		var total = parseFloat($('#total').val().replace('$',''));
		var paidvia;
		['cash','paypal','bitcoin','tab'].forEach(function(id) { 
			if ($('#'+id).hasClass('active')) paidvia=id; 
		});

		if (!currentUser && paidvia == 'tab') {
			$('#tab .alert').addClass('alert-danger');
			return;
		}

		firebase.child('ledger').push({
			'name': $('#name').val(),
			'project': $('#project').val(),
			'date': Firebase.ServerValue.TIMESTAMP,
			'time': $('#time').val(),
			'price': $('#price').val(),
			'total': -total
		});

		if (paidvia != 'tab') {
			firebase.child('ledger').push({
				'name': $('#name').val(),
				'project': 'Payment via ' + paidvia + '. Thank you!',
				'date': Firebase.ServerValue.TIMESTAMP,
				'total': total
			});
		}

		$('#trackModal').modal('hide');
	}

	exports.logout = function logout() {
		console.log("Logout");
		firebase.unauth();
	}

	return exports;
}());

$(document).ready(LASERTRACKER.init);