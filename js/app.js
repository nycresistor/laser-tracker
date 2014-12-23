var LASERTRACKER = (function () {
	var currentUser = null;
	var exports = {};
	var firebase;

	function formatDate(d) {
		return (d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate() + " " +
			d.getHours() + ":" + d.getMinutes());
	}

	// Split the string on : and then reduce multiplying by n^60 (1,60,3600)
	// reduceRight will start with seconds as previous and minutes as
	// current so we start with 60

	function parseTime(t) {
		if (!t) return 0;
		var multiplier = 60;
		var seconds = t.split(":").reduceRight(
			function (prev,cur) {
				var r = parseInt(prev)+parseInt(cur)*multiplier;
				multiplier *= 60;
				return r;
			}
		);

		return seconds;
	}

	function formatTime(t) {
		if (!t) return "0:00:00";
		var hours = Math.floor(t/3600);
		t = t % 3600;
		var minutes = Math.floor(t/60);
		var seconds = t % 60;

		return hours + ':' + (minutes<10 ? '0' : '') + 
			minutes + ':' + (seconds<10 ? '0' : '') + seconds;
	}

	function formatCurrency(n) {
		if (!n) return '$0.00';
		return '$' + parseFloat(n).toFixed(2);
	}

	function appendLedger(snapshot) {
		var row = snapshot.val();

		console.log(row);
		$('#ledger .header').after($('<tr>').append(
			$('<td>').text((new Date(row.date)).toLocaleString()),
			$('<td>').text(row.name),
			$('<td>').text(row.project),
			$('<td>').text(row.time),
			$('<td>').text(formatCurrency(row.price)),
			$('<td>').text(formatCurrency(row.total)),
			$('<td>').text(formatCurrency(row.tendered)),
			$('<td>').text(row.method)
		));
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
			});

			$('#tabButton').removeClass('hidden');

			firebase.child('admins').child(user.uid).once('value', function(snapshot) {
				currentUser.isAdmin = snapshot.val();
				$('#adminButton').toggleClass('hidden', !snapshot.val());
			});
		}
	}

	function updateTotalPaid(snapshot) {
		var paid = snapshot.val();

		$('#total-paid').text(formatCurrency(paid));
		$('#total-progress').css('width', (paid/25000*100) + "%");
	}

	function updateTotalTime(snapshot) {
		var time = snapshot.val();
		$('#total-time').text(time);
	}

	exports.init = function init() {
		firebase = new Firebase("http://lazzzor.firebaseio.com/");

		firebase.onAuth(setUser);
		firebase.child('ledger').limitToLast(100).on('child_added', appendLedger);
		firebase.child('totals').child('paid').on('value', updateTotalPaid);
		firebase.child('totals').child('time').on('value', updateTotalTime);
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
			var seconds = parseTime(t);

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
		var tendered = paidvia == 'tab' ? 0 : total;
		
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
			'method': paidvia,
			'total': total,
			'tendered': tendered
		});

		if (currentUser && paidvia == 'tab') {
			firebase.child('tabs').child(currentUser.uid).push({
				'name': $('#name').val(),
				'project': $('#project').val(),
				'date': Firebase.ServerValue.TIMESTAMP,
				'time': $('#time').val(),
				'price': $('#price').val(),
				'method': paidvia,
				'total': total,
				'tendered': tendered
			});
		}

		firebase.child('totals').child('paid').transaction(function (oldValue) {
			return oldValue + tendered;
		});

		firebase.child('totals').child('time').transaction(function (oldValue) {
			return formatTime(parseTime(oldValue) + parseTime($('#time').val()));
		});

		$('#trackModal').modal('hide');
	}

	exports.logout = function logout() {
		$('#adminButton').addClass('hidden');
		$('#tabButton').addClass('hidden');
		firebase.unauth();
	}

	exports.payTab = function payTab() {
		$('#tabModal').modal('show');
		var jobs = 0;
		var time = 0;
		var total = 0;

		firebase.child('tabs').child(currentUser.uid).on('child_added', function(snapshot) {
			var row = snapshot.val();
			jobs++;
			time += parseTime(row.time);
			total += row.total;

			$('#tab-jobs').val(jobs);
			$('#tab-time').val(formatTime(time));
			$('#tab-total').val('$' + total.toFixed(2));
		});
	}

	exports.savePayTab = function savePayTab() {
		var total = parseFloat($('#tab-total').val().replace('$',''));
		var paidvia;
		['cash','paypal','bitcoin'].forEach(function(id) { 
			if ($('#tab-'+id).hasClass('active')) paidvia=id; 
		});

		firebase.child('ledger').push({
			'name': currentUser.name,
			'project': "Paid off tab.  Thank you!",
			'date': Firebase.ServerValue.TIMESTAMP,
			'time': "0:00",
			'price': 0,
			'method': paidvia,
			'total': 0,
			'tendered': total
		});

		firebase.child('tabs').child(currentUser.uid).remove();

		firebase.child('totals').child('paid').transaction(function (oldValue) {
			return oldValue + total;
		});

		$('#tabModal').modal('hide');

	}

	exports.rebuildTotals = function rebuildTotals() {
		var time = 0;
		var paid = 0;
		var timer = null;

		var commit = function() {
			firebase.child('totals').child('paid').set(paid);
			firebase.child('totals').child('time').set(formatTime(time));
			firebase.child('ledger').off('child_added', summarize);
			$('#adminButton').popover({content:'Done!', placement:'bottom'}).popover('show');
		}

		var summarize = function(snapshot) {
			if (timer) clearTimeout(timer); 
		
			var row = snapshot.val();
			time += parseTime(row.time);
			paid += row.tendered;
		
			timer = setTimeout(commit, 1000);
		}

		firebase.child('ledger').on('child_added', summarize);
	}

	return exports;
}());

$(document).ready(LASERTRACKER.init);