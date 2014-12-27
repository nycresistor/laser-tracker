A quick intro to Firebase
=========================

This laser tracker uses Firebase (firebase.com) as its backend.  Firebase
is a realtime database as a service application that allows developers to
build data driven applications without a custom server component.  All the
application specific code for the laser tracker is run in the browser and
is hosted as static files.

Security Model
==============

Because there is no custom server component with Firebase the security 
model is a little different than your typical database driven LAMP-style
application.

Firebase provides an authentication layer that can use usernames and
passwords, and/or third-party OAuth authentication.  Authorization rules
are set by application administrator(s) which restrict read/write access
to users authenticated through one of these mechanisms.

A typical database driven web application employs a general set of access
rules for the application-database connection and it is left as an exercise
to the application to restrict access to the database appopriately for the
application users.  In a Firebase application these rules are set directly
on the database and the users have direct access to the data for which
they are authorized.

Data Model
==========

Rather than tables with hard defined schema, Firebase data is stored as a 
nested object.  Anything that can be represented as a JSON object can be
stored in Firebase.  JSON is used as the import/export and backup mechanism
within Firebase.

Real-time Event Driven
======================

Firebase is designed to be real-time.  Rather than issuing queries and
iterating over result sets, Firebase apps attach event listeners to part
of the object store.  Once attached events immediately fire for everything
already stored there, and then again for anything that is added, changed,
or removed.  Most of the time nothing special has to be added to make 
Firebase applications work in a real-time.


