// Setup a LASERTRACKER object using the Javascript Module Pattern
//
// http://www.adequatelygood.com/JavaScript-Module-Pattern-In-Depth.html
//
// If you have never worked with Firebase before see FIREBASE-README.md
//
var LASERTRACKER = (function () {
	//
	// PRIVATE VARIABLES
	//

	var currentUser = null;
	var exports = {};
	var firebase;

	//
	// PRIVATE METHODS
	//

	// Takes a time in [H:[MM:]]SS form and returns time in seconds 
	function parseTime(t) {
		if (!t) return 0;

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

		return seconds;
	}

	// Takes time in seconds and returns H:MM:SS
	function formatTime(t) {
		if (!t) return "0:00:00";
		var hours = Math.floor(t/3600);
		t = t % 3600;
		var minutes = Math.floor(t/60);
		var seconds = t % 60;

		return hours + ':' + (minutes<10 ? '0' : '') + 
			minutes + ':' + (seconds<10 ? '0' : '') + seconds;
	}

	// Takes a number and returns $#.##
	function formatCurrency(n) {
		if (!n) return '$0.00';
		return '$' + parseFloat(n).toFixed(2);
	}

	// Takes a Firebase snapshot (query result) and appends a row to the 
	// #ledger table.  Called when the child_added event is fired by the 
	// ledger firebase object.
	function appendLedger(snapshot) {
		var row = snapshot.val();
		var firstCol;


		// Use jquery to create elements and then use text method to prevent
		// XSS issues.
		$('#ledger .header').after($('<tr>').append(
			// Create the date column and hold onto it so we can prepend it for admins
			// row.date is in ms since epoch as provided by Firebase server time
			firstCol = $('<td>').text((new Date(row.date)).toString("MMM d, yyyy h:mm tt")),
			$('<td>').text(row.name),
			$('<td>').text(row.project),
			$('<td>').text(row.time),
			$('<td>').text(formatCurrency(row.price)),
			$('<td>').text(formatCurrency(row.total)),
			$('<td>').text(formatCurrency(row.tendered)),
			$('<td>').text(row.method)
		));

		// If user is an admin prepend a undo button
		if (currentUser && currentUser.isAdmin) {
			firstCol.prepend($('<span>')
				.addClass('glyphicon glyphicon-remove-circle')
				.click(function () { undoLedger(row); }));
		}
	}

	// Adds a reverse charge to the ledger (the ledger is append only)
	function undoLedger(row) {
		// Double check that the user is an admin, not strictly necessary
		if (currentUser && currentUser.isAdmin) {
			if (confirm("Do you want to reverse charges for \"" + 
				row.project + "\" for " + formatCurrency(-row.tendered) + "?")
			) {

				// Push the negative of the row being undone
				firebase.child('ledger').push({
					'name': currentUser.name,
					'project': "Undo of " + row.project,
					'date': Firebase.ServerValue.TIMESTAMP,
					'time': row.time,
					'price': row.price,
					'method': row.method,
					'total': -row.total,
					'tendered': -row.tendered
				});

				// Adjust totals
				firebase.child('totals').child('paid').transaction(function (oldValue) {
					return oldValue + -row.tendered;
				});
			}
		}
	}

	// Callback when firebase authentication happens.  User data from OAuth provider
	// is only argument.  Works for unauth too.
	function setUser(user) {
		// Massage data so display name is always at the same place
		var name = (user && user[user.provider].displayName) || "";
		if (user) user.name = name;

		// Set current user
		exports.currentUser = currentUser = user;

		// Adjust display to show user is logged in/out
		$('#loginButton').toggleClass('hidden', user || false);
		$('#logoutButton').toggleClass('hidden', !user);
		$('#displayName').text(name);
		$('#name').val(name);

		if (user) {
			// Reset the price to the last one set by the user
			firebase.child('users').child(user.uid).child('price').once('value',function(snapshot) {
				$('#price').val(snapshot.val());
			});

			// Show the pay my tab button
			$('#tabButton').removeClass('hidden');

			// If this uid is in the admins table then turn on administrative functions
			firebase.child('admins').child(user.uid).once('value', function(snapshot) {
				currentUser.isAdmin = snapshot.val();
				$('#adminButton').toggleClass('hidden', !snapshot.val());
			});
		}
	}

	// Called whenever the totals.paid firebase object is changed
	// Updates the progress meter and dollars display
	function updateTotalPaid(snapshot) {
		var paid = snapshot.val();

		$('#total-paid').text(formatCurrency(paid));
		$('#total-progress').css('width', (paid/25000*100) + "%");
	}

	// Called whenever the totals.time firebase object is changed
	// Updates the total time display
	function updateTotalTime(snapshot) {
		var time = snapshot.val();
		$('#total-time').text(time);
	}

	// Validates the data on the track time form.  Called by the Save button.
	function validateTrack() {
		var result = true;

		['#name','#project','#time'].forEach(function(id) {
			$(id).parent().toggleClass('has-error',!$(id).val());

			if (!$(id).val()) 
				result = false;
		});

		return result;
	}

	//
	// PUBLIC METHODS
	//

	// Initializes firebase and events
	exports.init = function init() {
		// Instantiate firebase
		firebase = new Firebase("https://lazzzor.firebaseio.com/");

		// Attach event listsners
		firebase.onAuth(setUser);
		firebase.child('ledger').limitToLast(100).on('child_added', appendLedger);
		firebase.child('totals').child('paid').on('value', updateTotalPaid);
		firebase.child('totals').child('time').on('value', updateTotalTime);
	}

	// Called when one of the 3rd party auth buttons is clicked.  
	// Token is one of "facebook", "twitter", "google", "github".
	exports.login = function login(token) {
		// Trigger the firebase OAuth Popup which walks the users through
		// 3rd parth OAuth process
		firebase.authWithOAuthPopup(token, function(error, authData) {
	  		if (error) {
	  			// TODO Add some kind of indicator that the auth attempt failed
    			console.log("Login Failed!", error);
	  		}
	  		else {
	  			// If no error is fired the onAuth event with fire which will
	  			// setup the user.  Just need to hide the login modal.
	  			$('#loginModal').modal('hide');
	  		}
		});
	}

	// Updates the total price on the track time form whenever the time is changed.
	exports.updateTotal = function updateTotal() {
		var t = $('#time').val();

		// Validate that the time looks like a time.
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

	// Triggered when the price drop-down in the track time form is changed.
	// Saves the price as a preference for logged in users.
	exports.rememberPrice = function rememberPrice() {
		if (currentUser) {
			firebase.child('users').child(currentUser.uid).child('price').set($('#price').val());
		}
	}

	// Triggered when the user clicks Save on the track time form.
	exports.saveTrack = function saveTrack() {
		// Validate the data looks good
		if (!validateTrack()) 
			return;

		// Massage the data 
		var total = parseFloat($('#total').val().replace('$',''));
		var paidvia;
		['cash','paypal','bitcoin','tab'].forEach(function(id) { 
			if ($('#'+id).hasClass('active')) paidvia=id; 
		});
		var tendered = paidvia == 'tab' ? 0 : total;
		
		// If the user is trying to pay by tab but isn't logged in
		// warn them and stop
		if (!currentUser && paidvia == 'tab') {
			$('#tab .alert').addClass('alert-danger');
			return;
		}

		// Add a new row to the ledger firebase object
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

		// If paying by tab add a new row to the users tab object
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

		// Update the totals using transactions
		firebase.child('totals').child('paid').transaction(function (oldValue) {
			return oldValue + tendered;
		});

		firebase.child('totals').child('time').transaction(function (oldValue) {
			return formatTime(parseTime(oldValue) + parseTime($('#time').val()));
		});

		// Hide the track time form modal
		$('#trackModal').modal('hide');
	}

	// Called when the user clicks logout, unauthenticates them
	exports.logout = function logout() {
		$('#adminButton').addClass('hidden');
		$('#tabButton').addClass('hidden');
		firebase.unauth();
	}

	// Setup and show the pay my tab form modal 
	exports.payTab = function payTab() {
		var jobs = 0;
		var time = 0;
		var total = 0;

		// This probbably isn't the best way to do this.  For each row in the users 
		// tab object we sum up jobs, time and total and then update the form.  
		firebase.child('tabs').child(currentUser.uid).on('child_added', function(snapshot) {
			var row = snapshot.val();
			jobs++;
			time += parseTime(row.time);
			total += row.total;

			$('#tab-jobs').val(jobs);
			$('#tab-time').val(formatTime(time));
			$('#tab-total').val('$' + total.toFixed(2));
		});

		// We call show modal last, but the previous event handler is async so you'll see the
		// numbers update.
		$('#tabModal').modal('show');
	}

	// Called when the user clicks the save button on the pay my tab form.
	exports.savePayTab = function savePayTab() {
		// Massage the data
		var total = parseFloat($('#tab-total').val().replace('$',''));
		var paidvia;
		['cash','paypal','bitcoin'].forEach(function(id) { 
			if ($('#tab-'+id).hasClass('active')) paidvia=id; 
		});

		// Append the ledger
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

		// Clear the users tab
		firebase.child('tabs').child(currentUser.uid).remove();

		// Update the total with a transaction
		firebase.child('totals').child('paid').transaction(function (oldValue) {
			return oldValue + total;
		});

		// Hide the modal
		$('#tabModal').modal('hide');

	}

	// Administrative function to rebuild the totals by replaying the ledger.
	// Used if someone mucks up the total or changes/deletes a ledger row in 
	// Firebase directly.
	exports.rebuildTotals = function rebuildTotals() {
		var time = 0;
		var paid = 0;
		var timer = null;

		// Commits the summed up data to the totals object
		var commit = function() {
			// Update totals
			firebase.child('totals').child('paid').set(paid);
			firebase.child('totals').child('time').set(formatTime(time));

			// Pull the summarize event listener off
			firebase.child('ledger').off('child_added', summarize);

			// Notify the admin we're done
			$('#adminButton').popover({content:'Done!', placement:'bottom'}).popover('show');
		}

		// Called for each child row of the ledger firebase object.  Sums up the times and
		// tenderered.  There's not a great way to tell when we're done so we set and clear
		// another timer with each pass.
		var summarize = function(snapshot) {
			// Clear any previously set timeout
			if (timer) clearTimeout(timer); 
		
			// Sum things up
			var row = snapshot.val();
			time += parseTime(row.time);
			paid += row.tendered;
		
			// Set a new timeout so that if we go a second without a summarize call
			// we'll call commit
			timer = setTimeout(commit, 1000);
		}

		// Setup summarize event listener.  Will be called for all children of ledger.
		firebase.child('ledger').on('child_added', summarize);
	}

	return exports;
}());

// Call init when document is ready.
$(document).ready(LASERTRACKER.init);

