/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express = require('express'); // app server
const watson = require('watson-developer-cloud');
var bodyParser = require('body-parser'); // parser for post requests
require('dotenv').config(); // reads environment variables from .env

const conversation = new watson.ConversationV1({version_date: watson.ConversationV1.VERSION_DATE_2017_04_21});
const ActionsSdkApp = require('actions-on-google').ActionsSdkApp;
const googlepApp = new ActionsSdkApp();
var app = express();

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());

let context = null;

let googleContext = null;
const watsonConversation = (req, res) => {
  const googleApp = new ActionsSdkApp({request: req, response: res});

  function mainIntent (app) {
    console.log('reached function');
    const input = googleApp.getRawInput();
    message(input, googleContext).then(response => {
      console.log('Reached Watson');
      googleContext = response.context;
      const output = response.output.text[0];
      googleApp.ask(output);
    }).catch(err => {
      googleApp.tell('Error Found. Could not connect to Watson');
    });

  }

  const actionMap = new Map();
  // actionMap.set(app.StandardIntents.TEXT, mainIntent);
  googleApp.handleRequest(mainIntent);

}

const message = function(input, context) {
  const payload = {
    workspace_id: process.env.WORKSPACE_ID || '<workspace_id>',
    input: {
      text: input
    },
    context: context,
    alternate_intents: true
  };
  return new Promise((resolve, reject) => conversation.message(payload, function(err, data) {
    if (err) {
      reject(err);
    } else {
      resolve(data);
    }
  }));
};

app.post('/', (req, res) => {
  const input = req.body.request.intent.slots.EveryThingSlot.value;
  message(input).then(response => {
    context = response.context;
    const output = response.output.text[0];
    res.json({
      'version': '1.0',
      'response': {
          'shouldEndSession': false,
          'outputSpeech': {
              'type': 'PlainText',
              'text': output
          }
        }
    });
    res.end();
  }).catch(err => {
    res.json({
      "version": "1.0",
      "response": {
          "shouldEndSession": true,
          "outputSpeech": {
              "type": "PlainText",
              "text": err.message
          }
      }
    });
    res.end();
  });
});

app.post('/google', (req, res) => {
  watsonConversation(req, res);
  console.log('Google home has reached the POST /google endpoint');
  // res.json({
  //   "response": "Hello Brian!"
  // });
  // res.end();
});

app.get('/google', (req, res) => {
  console.log('Google home has reached the GET /google endpoint');
});

// Endpoint to be call from the client side
app.post('/api/message', function(req, res) {
  var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  if (!workspace || workspace === '<workspace-id>') {
    return res.json({
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    });
  }
  var payload = {
    workspace_id: workspace,
    context: req.body.context || {},
    input: req.body.input || {}
  };

  // Send the input to the conversation service
  conversation.message(payload, function(err, data) {
    if (err) {
      return res.status(err.code || 500).json(err);
    }
    return res.json(updateMessage(payload, data));
  });
});

/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Conversation service
 * @param  {Object} response The response from the Conversation service
 * @return {Object}          The response with the updated message
 */
function updateMessage(input, response) {
  var responseText = null;
  if (!response.output) {
    response.output = {};
  } else {
    return response;
  }
  if (response.intents && response.intents[0]) {
    var intent = response.intents[0];
    // Depending on the confidence of the response the app can return different messages.
    // The confidence will vary depending on how well the system is trained. The service will always try to assign
    // a class/intent to the input. If the confidence is low, then it suggests the service is unsure of the
    // user's intent . In these cases it is usually best to return a disambiguation message
    // ('I did not understand your intent, please rephrase your question', etc..)
    if (intent.confidence >= 0.75) {
      responseText = 'I understood your intent was ' + intent.intent;
    } else if (intent.confidence >= 0.5) {
      responseText = 'I think your intent was ' + intent.intent;
    } else {
      responseText = 'I did not understand your intent';
    }
  }
  response.output.text = responseText;
  return response;
}

var listener = app.listen(8888, function(){
    console.log('Listening on port ' + listener.address().port); //Listening on port 8888
});


module.exports = app;
