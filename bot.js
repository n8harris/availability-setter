'use strict';

const aws = require('aws-sdk');
const lambda = new aws.Lambda();
const botBuilder = require('claudia-bot-builder');
const slackDelayedReply = botBuilder.slackDelayedReply;
const firebase = require('firebase');
const Slack = require('slack-api').promisify();
var firebaseConfig = {
  apiKey: '',
  authDomain: '',
  databaseURL: '',
  storageBucket: '',
};
firebase.initializeApp(firebaseConfig);
var slackToken = '';

const api = botBuilder((message, apiRequest) => {
  var eventText = message.text ? message.text.trim() : null;
  if(eventText === "true" || eventText === "false") {

	  // Invoke the same Lambda function asynchronously, and do not wait for the response
	  // this allows the initial request to end within three seconds, as requiured by Slack

    return Slack.users.info({token: slackToken, user: message.sender})
      .then((response) => {
        return new Promise((resolve, reject) => {
          lambda.invoke({
      			FunctionName: apiRequest.lambdaContext.functionName,
      			InvocationType: 'Event',
      			Payload: JSON.stringify({
              slackEvent: message,
              image: response.user.profile.image_192,
              name: response.user.profile.real_name
            }),
      			Qualifier: apiRequest.lambdaContext.functionVersion
      		}, (err, done) => {
            if (err) return reject(err);

            resolve();
          });
        })
        .then(() => {
          return { // the initial response
            text: "Changing Availability",
            response_type: 'in_channel'
          }
         })
        .catch(() => {
          return "Could not change availability"
        });
    });
  } else {
    return "I'm sorry. I don't understand your command"
  }
});

// this will be executed before the normal routing.
// we detect if the event has a flag set by line 21,
// and if so, avoid normal procesing, running a delayed response instead

api.intercept((event) => {
  if (!event.slackEvent) // if this is a normal web request, let it run
    return event;

  const message = event.slackEvent;
  const profileName = event.name;
  const profileImage = event.image;
  const originalRequest = event.slackEvent.originalRequest;
  var data = {};
  data = {
    availability: originalRequest.text,
    name: originalRequest.user_name,
    real_name: profileName,
    image: profileImage
  };
  return firebase.database().ref('slack-users/' + originalRequest.user_id).set(data)
    .then(() => {
      return slackDelayedReply(message, {
        text: `Successfully changed availability for ${originalRequest.user_name}`,
        response_type: 'in_channel'
      })
    }, function(error) {
      return slackDelayedReply(message, {
        text: `Could not change availability for ${originalRequest.user_name}`,
        response_type: 'in_channel'
      })
    })
    .then(() => false); // prevent normal execution
});

module.exports = api;