var express = require('express');
var querystring = require('querystring');
var request = require('request');
var cors = require('cors');
var cookieParser = require('cookie-parser');
var axios = require('axios');
var math = require('mathjs');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Express' });
});

router.get('/data', function (req, res) {
  var features;
  var access_token = req.query.access_token;
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
    var medium_term = JSON.parse(body);
    var idMedium = [medium_term.items[0].id];
    var idString = medium_term.items[0].id;
    for(var i = 1; i<medium_term.items.length; i++){
      idMedium.push(medium_term.items[i].id);
      idString += (',' + medium_term.items[i].id);
    }
    var idShort = [];
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
      var short_term = JSON.parse(body);
      for(var i = 0; i<short_term.items.length; i++){
        idShort.push(short_term.items[i].id);
        idString += (',' + short_term.items[i].id);
      }
      var options = {
        method: 'GET',
        url: 'https://api.spotify.com/v1/audio-features',
        qs: {
          ids: idString//JSON.stringify(idMedium.concat(idShort))
        },
        headers: {
          authorization: 'Bearer ' + access_token,
          'content-type': 'application/json',
          accept: 'application/json'
        }
      };
      request(options, function (error, response, body) {
        var features = JSON.parse(body);
        var mediumFeatures = features.audio_features.slice(0,medium_term.items.length);
        var shortFeatures = features.audio_features.slice(medium_term.items.length);
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
        var shortBoringnessAvg = math.mean(shortBoringness);
        var mediumBoringnessAvg = math.mean(mediumBoringness);
        var diffBoringness = ((shortBoringnessAvg - mediumBoringnessAvg)/Math.abs(mediumBoringnessAvg))*100;

        var shortStd = math.std(shortVals.slice(0,7),1);
        var mediumStd = math.std(mediumVals.slice(0,7),1);
        var shortStdAvg = math.mean(shortStd);
        var mediumStdAvg = math.mean(mediumStd);
        var diffStd = ((shortStdAvg - mediumStdAvg)/Math.abs(mediumStdAvg))*100;

        var shortAvg = new Array(5);
        for (var i = 0; i<5; i++) {
          shortAvg[i] = math.mean(shortVals[i]);
        }
        var mediumAvg = new Array(5);
        for (var i = 0; i<5; i++) {
          mediumAvg[i] = math.mean(mediumVals[i]);
        }

        var diffAvg = mediumAvg.map(function (item, index){return ((shortAvg[index]-item)/Math.abs(item))*100});
        diffAvg.push(diffBoringness,diffStd);

        res.send(diffAvg);

        /*var mediumFeatures = features.audio_features.slice(0,medium_term.items.length);
        var shortFeatures = features.audio_features.slice(medium_term.items.length);
        var shortAvg = [0,0,0,0,0,0,0,0];
        var shortVals = [0,0,0,0,0,0,0,0];
        var shortTempo = 0;
        //shortDance,shortEnergy,shortLoud,shortSpeech,shortAcoustic,shortInstrumental,shortLive,shortValence
        for(var i = 0; i<shortFeatures.length; i++) {
          shortAvg[0] += shortFeatures[i].danceability;
          shortAvg[1] += shortFeatures[i].energy;
          shortAvg[2] += shortFeatures[i].loudness;
          shortAvg[3] += shortFeatures[i].speechiness;
          shortAvg[4] += shortFeatures[i].acousticness;
          shortAvg[5] += shortFeatures[i].instrumentalness;
          shortAvg[6] += shortFeatures[i].liveness;
          shortAvg[7] += shortFeatures[i].valence;
          shortVals[0][i] = shortFeatures[i].danceability;
          shortVals[1][i] = shortFeatures[i].energy;
          shortVals[2][i] = shortFeatures[i].loudness;
          shortVals[3][i] = shortFeatures[i].speechiness;
          shortVals[4][i] = shortFeatures[i].acousticness;
          shortVals[5][i] = shortFeatures[i].instrumentalness;
          shortVals[6][i] = shortFeatures[i].liveness;
          shortVals[7][i] = shortFeatures[i].valence;
          shortTempo =
        }
        var mediumAvg = [0,0,0,0,0,0,0,0];
        var mediumVals = [0,0,0,0,0,0,0,0];
        //shortDance,shortEnergy,shortLoud,shortSpeech,shortAcoustic,shortInstrumental,shortLive,shortValence
        for(var i = 0; i<mediumFeatures.length; i++){
          mediumAvg[0] += mediumFeatures[i].danceability;
          mediumAvg[1] += mediumFeatures[i].energy;
          mediumAvg[2] += mediumFeatures[i].loudness;
          mediumAvg[3] += mediumFeatures[i].speechiness;
          mediumAvg[4] += mediumFeatures[i].acousticness;
          mediumAvg[5] += mediumFeatures[i].instrumentalness;
          mediumAvg[6] += mediumFeatures[i].liveness;
          mediumAvg[7] += mediumFeatures[i].valence;
          mediumVals[0][i] = mediumFeatures[i].danceability;
          mediumVals[1][i] = mediumFeatures[i].energy;
          mediumVals[2][i] = mediumFeatures[i].loudness;
          mediumVals[3][i] = mediumFeatures[i].speechiness;
          mediumVals[4][i] = mediumFeatures[i].acousticness;
          mediumVals[5][i] = mediumFeatures[i].instrumentalness;
          mediumVals[6][i] = mediumFeatures[i].liveness;
          mediumVals[7][i] = mediumFeatures[i].valence;
        }
        shortAvg = shortAvg.map(function(item){return item/shortFeatures.length});
        mediumAvg = mediumAvg.map(function(item){return item/mediumFeatures.length});
        var diffAvg = mediumAvg.map(function (item, index){return ((shortAvg[index]-item)/Math.abs(item))*100});

        var shortStd = math.std(shortVals,1);
        var shortVariety = math.mean(shortStd);
        var mediumStd = math.std(mediumVals,1);
        var mediumVariety = math.mean(mediumStd);
        var diffVariety = (shortVariety-mediumVariety)/Math.abs(mediumVariety);
        var shortBoringness = diffAvg[2] +
        console.error(shortAvg);
        console.error(mediumAvg);
        console.error(diffAvg);*/
      });
    });
  });
});

module.exports = router;
