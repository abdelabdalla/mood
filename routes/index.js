var express = require('express');
var request = require('request');
var math = require('mathjs');
var mongo = require('mongodb').MongoClient;
var fs = require('fs');
var router = express.Router();

/* TODO:
        * Bug where data doesn't always show up
        * Link social buttons on homepage to correct sites
        * Add section to explain parameters and how they're calculated
        * Finish design of results page
          * Update header text to make it sound better
          * Scale graph correctly
          * Disable 'popup' when hovering over bar
          * Sort out margins
          * Fix sharing button's design
          * Implement 'screenshotting'
          * Figure out if direct sharing to insta/snap stories is possible and integrate solution
        * Ads!
        * Proper error handling
        * General design improvements to make it cleaner and more responsive
        * Remove reliance on hashparams in callback redirect
 */

//Serve Homepage
router.get('/', function(req, res) {
  res.render('index', { title: 'Express' });
});

//Retrieve and serve data
router.get('/data', function (req, res) {

  var access_token = req.query.access_token;

  //console.log('Access Token: ' + access_token);

  //Fetch medium term top tracks
  var optionsmt = {
    method: 'GET',
    url: 'https://api.spotify.com/v1/me/top/tracks',
    qs: {
      offset: '0',
      limit: '50',
      time_range: 'medium_term'
    },
    headers: {
      authorization: 'Bearer ' + access_token,
      'content-type': 'application/json',
      accept: 'application/json'
    }
  };
  request(optionsmt, function (error, response, body) {
    if (error) {console.error(error)};
    var medium_term = JSON.parse(body);
    var idString = medium_term.items[0].id;
    //console.log('First medium ID: ' + idString);
    for(var i = 1; i<medium_term.items.length; i++){
      idString += (',' + medium_term.items[i].id);
    }
    //console.log('Number of medium tracks: ' + medium_term.items.length);
    //Fetch short term top tracks
    var optionsst = {
      method: 'GET',
      url: 'https://api.spotify.com/v1/me/top/tracks',
      qs: {
        offset: '0',
        limit: '50',
        time_range: 'short_term'
      },
      headers: {
        authorization: 'Bearer ' + access_token,
        'content-type': 'application/json',
        accept: 'application/json'
      }
    };
    request(optionsst, function (error, response, body) {
      if (error) {console.error(error)};
      var short_term = JSON.parse(body);
      //console.log('First short ID: ' + short_term.items[0].id);
      for(var i = 0; i<short_term.items.length; i++){
        idString += (',' + short_term.items[i].id);
      }
      //console.log('Number of short tracks: ' + short_term.items.length);
      //console.log(idString);
      //Fetch track features for both short and medium term tracks
      var options = {
        method: 'GET',
        url: 'https://api.spotify.com/v1/audio-features',
        qs: {
          ids: idString
        },
        headers: {
          authorization: 'Bearer ' + access_token,
          'content-type': 'application/json',
          accept: 'application/json'
        }
      };
      request(options, function (error, response, body) {
        if (error) {console.error(error)};
        var features = JSON.parse(body);

        //Split medium and short term features and filter any null returns
        var mediumFeatures = features.audio_features.slice(0,medium_term.items.length).filter(function (el) {
          return el != null;
        });
        var shortFeatures = features.audio_features.slice(medium_term.items.length).filter(function (el) {
          return el != null;
        });

        ////console.log(mediumFeatures.length + ' medium features fetched');
        ////console.log(shortFeatures.length + ' short features fetched');
        //Sort data for short term tracks
        var shortVals = Array(8).fill().map(() => Array(shortFeatures.length).fill(0));
        var shortBoringness = new Array(shortFeatures.length);

        for(var i = 0; i<shortFeatures.length; i++) {
          shortVals[0][i] = shortFeatures[i].valence;
          shortVals[1][i] = shortFeatures[i].danceability;
          shortVals[2][i] = shortFeatures[i].energy;
          shortVals[3][i] = shortFeatures[i].instrumentalness;
          shortVals[4][i] = shortFeatures[i].acousticness;
          shortVals[5][i] = shortFeatures[i].speechiness;
          shortVals[6][i] = shortFeatures[i].liveness;
          shortVals[7][i] = shortFeatures[i].tempo;
          shortBoringness[i] = shortVals[6][i] + shortVals[7][i] + (shortVals[2][i]*100) + (shortVals[1][i]*100);
        }
        //console.log('First short boringness: ' + shortBoringness[0]);
        //Sort data for medium term tracks
        var mediumVals = Array(8).fill().map(() => Array(mediumFeatures.length).fill(0));
        var mediumBoringness = new Array(mediumFeatures.length);

        for(var i = 0; i<mediumFeatures.length; i++) {
          mediumVals[0][i] = mediumFeatures[i].valence;
          mediumVals[1][i] = mediumFeatures[i].danceability;
          mediumVals[2][i] = mediumFeatures[i].energy;
          mediumVals[3][i] = mediumFeatures[i].instrumentalness;
          mediumVals[4][i] = mediumFeatures[i].acousticness;
          mediumVals[5][i] = mediumFeatures[i].speechiness;
          mediumVals[6][i] = mediumFeatures[i].liveness;
          mediumVals[7][i] = mediumFeatures[i].tempo;
          mediumBoringness[i] = mediumVals[6][i] + mediumVals[7][i] + (mediumVals[2][i]*100) + (mediumVals[1][i]*100);
        }
        //console.log('First medium boringness: ' + mediumBoringness[0]);
        //Calculate mean borigness then find differences
        var shortBoringnessAvg = math.mean(shortBoringness);
        var mediumBoringnessAvg = math.mean(mediumBoringness);
        var diffBoringness = ((shortBoringnessAvg - mediumBoringnessAvg)/Math.abs(mediumBoringnessAvg))*100;

        //Calculate mean variety then find differences
        var shortStd = math.std(shortVals.slice(0,7),1);
        var mediumStd = math.std(mediumVals.slice(0,7),1);
        var shortStdAvg = math.mean(shortStd);
        var mediumStdAvg = math.mean(mediumStd);
        var diffStd = ((shortStdAvg - mediumStdAvg)/Math.abs(mediumStdAvg))*100;

        //Calculate mean and difference in remaining 5 params
        var shortAvg = new Array(5);
        for (var i = 0; i<5; i++) {
          shortAvg[i] = math.mean(shortVals[i]);
        }
        var mediumAvg = new Array(5);
        for (var i = 0; i<5; i++) {
          mediumAvg[i] = math.mean(mediumVals[i]);
        }
        var diffAvg = mediumAvg.map(function (item, index){return ((shortAvg[index]-item)/Math.abs(item))*100});

        //Concatenate boringness and variety values to array of other params
        diffAvg.push(diffBoringness,diffStd);

        //Fetch user data
        var optionsUser = {
          method: 'GET',
          url: 'https://api.spotify.com/v1/me',
          headers: {
            authorization: 'Bearer ' + access_token,
            'content-type': 'application/json',
            accept: 'application/json'
          }
        };
        request(optionsUser, function (error, response, body) {
          if (error) {console.error(error)};
          var userData = JSON.parse(body);

          //Get user's first name then send with rest of data
          var firstName = userData.display_name.split(" ");
          diffAvg.push(firstName[0]);
          //console.log('Pre-sending');
          res.send(diffAvg);
          //console.log('Data sent');
          //Save user data to DB
          ///*
          mongo.connect(process.env.MONGOLAB_URI, {useNewUrlParser: true, useUnifiedTopology: true}, function (err, db) {
            if (err) throw err;
            var dbo = db.db('mood');
            var query = {id : userData.id};
            var obj = {$set : {
              id : userData.id,
              country : userData.country,
              display_name : userData.display_name,
              email : userData.email,
              external_urls : userData.external_urls,
              followers : userData.followers.total,
              product : userData.product
            }};
            dbo.collection('users').updateOne(query, obj,{upsert: true}, function (err, res) {
              if (err) throw err;
              //console.log(userData.id + ' added');
              db.close();
            });
          });
        //*/
        });
      });
    });
  });
});

module.exports = router;
