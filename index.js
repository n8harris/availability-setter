var Botkit = require('botkit');
var firebase = require('firebase');

if (!process.env.CLIENT_ID ||
  !process.env.CLIENT_SECRET ||
  !process.env.PORT ||
  !process.env.VERIFICATION_TOKEN ||
  !process.env.FIREBASE_KEY ||
  !process.env.FIREBASE_AUTH_DOMAIN ||
  !process.env.FIREBASE_DB_URL ||
  !process.env.FIREBASE_STORAGE_BUCKET ||
  !process.env.COMMAND_TITLE) {
    console.log('Error: Specify CLIENT_ID, CLIENT_SECRET, VERIFICATION_TOKEN, PORT, FIREBASE_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_DB_URL, FIREBASE_STORAGE_BUCKET, and COMMAND_TITLE in environment');
    process.exit(1);
}

var config = {}
if (process.env.MONGOLAB_URI) {
    var BotkitStorage = require('botkit-storage-mongo');
    config = {
        storage: BotkitStorage({mongoUri: process.env.MONGOLAB_URI}),
    };
} else {
    config = {
        json_file_store: './db_slackbutton_slash_command/',
    };
}

// Initialize Firebase

var config = {
	apiKey: process.env.FIREBASE_KEY,
	authDomain: process.env.FIREBASE_AUTH_DOMAIN,
	databaseURL: process.env.FIREBASE_DB_URL,
	storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
};
firebase.initializeApp(config);

var controller = Botkit.slackbot(config).configureSlackApp(
    {
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        scopes: ['commands'],
    }
);

controller.setupWebserver(process.env.PORT, function (err, webserver) {
    controller.createWebhookEndpoints(controller.webserver);

    controller.createOauthEndpoints(controller.webserver, function (err, req, res) {
        if (err) {
            res.status(500).send('ERROR: ' + err);
        } else {
            res.send('Success!');
        }
    });
});

controller.on('slash_command', function (slashCommand, message) {
    if (message.token !== process.env.VERIFICATION_TOKEN) return;
    switch (message.command) {
        case process.env.COMMAND_TITLE:
            if (message.text === "true" || message.text === "false") {
                addEditAvailability(message.text, message.user_id, message.user_name).then(slashCommand.replyPublicDelayed(message, "Success"));
            } else {
              slashCommand.replyPublic(message, "I'm sorry. I don't understand your command");
            }

            break;
        default:
            slashCommand.replyPublic(message, "I'm afraid I don't know how to " + message.command + " yet.");

    }

})
;

var addEditAvailability = function(availability, userId, name){
  var defered = $q.defer();
  var data = {};
  data[userId] = {
    availability: availability,
    name: name
  };
  firebase.database().ref('slack-users').set(data).then(function(result){
    defered.resolve(result);
  }, function(error) {
    // The Promise was rejected.
    slashCommand.replyPublic(message, "Failure");
  });
  return defered.promise;
};

