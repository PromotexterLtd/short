/**
 * @list dependencies
 */

var ID = require('short-id')
  , mongoose = require('mongoose')
  , Promise = require('node-promise').Promise
    , Bluebird = require('bluebird')
  , ShortURL = require('../models/ShortURL').ShortURL;
const shortid = require('shortid');

/**
 * @configure short-id
 */

ID.configure({
  length: 1, // for testing only
  algorithm: 'sha1',
  salt: Math.random
});

/**
 * @method connect
 * @param {String} mongdb Mongo DB String to connect to
 */

exports.connect = function(mongodb) {
  if (mongoose.connection.readyState === 0)
    mongoose.connect(mongodb);

  exports.connection = mongoose.connection;
};

/**
 * @method generate
 * @param {Object} options Must at least include a `URL` attribute
 */
var maxRetry = 100;
exports.generate = function(document, numberOfRetries) {
    // console.log('numberOfRetries', numberOfRetries);
    if (numberOfRetries === undefined) numberOfRetries = 0;
  var generatePromise;

  document['data'] = document.data || null;

  // hash was specified, so we should always honor it
  if (document.hasOwnProperty('hash') && numberOfRetries === 0) {
    generatePromise = ShortURL.create(document);
  } else {
    document['hash'] = shortid.generate().substring(0, 6);
    generatePromise = ShortURL.findOrCreate({URL : document.URL}, document, {});
  }

  return new Bluebird(function(resolve, reject) {
      generatePromise.then(function(ShortURLObject) {
          resolve(ShortURLObject);
      }, function(error) {
          if(numberOfRetries > maxRetry){
              console.log('MAX RETRY......');
              reject(error, true);

          }else{
              console.log('Duplicate Key: Generate New.....', document['hash']);

              resolve(exports.generate(document, numberOfRetries+1));
          }
      });
  });
};

/**
 * @method retrieve
 * @param {Object} options Must at least include a `hash` attribute
 */

exports.retrieve = function(hash) {
  var promise = new Promise();
  var query = { hash : hash }
    , update = { $inc: { hits: 1 } }
    , options = { multi: true };
  var retrievePromise = ShortURL.findOne(query);
  ShortURL.update( query, update , options , function (){ } );
  retrievePromise.then(function(ShortURLObject) {
    if (ShortURLObject && ShortURLObject !== null) {
      promise.resolve(ShortURLObject);
    } else {
      promise.reject(new Error('MongoDB - Cannot find Document'), true);
    };
  }, function(error) {
    promise.reject(error, true);
  });
  return promise;
};

/**
 * @method update
 * @param {String} hash - must include a `hash` attribute
 * @param {Object} updates - must include either a `URL` or `data` attribute
 */

exports.update = function(hash, updates) {
  var promise = new Promise();
  ShortURL.findOne({hash: hash}, function(err, doc) {
    if (updates.URL) {
      doc.URL = updates.URL;
    }
    if (updates.data) {
      doc.data = extend(doc.data, updates.data);
      doc.markModified('data'); //Required by mongoose, as data is of Mixed type
    }
    doc.save(function(err, updatedObj, numAffected) {
      if (err) {
        promise.reject(new Error('MongoDB - Cannot save updates'), true);
      } else {
        promise.resolve(updatedObj);
      }
    });
  });
  return promise;
};

/**
 * @method hits
 * @param {Object} options Must at least include a `hash` attribute
 */

exports.hits = function(hash) {
  var promise = new Promise();
  var query = { hash : hash }
    , options = { multi: true };
  var retrievePromise = ShortURL.findOne(query);
  retrievePromise.then(function(ShortURLObject) {
    if (ShortURLObject && ShortURLObject !== null) {
      promise.resolve(ShortURLObject.hits);
    } else {
      promise.reject(new Error('MongoDB - Cannot find Document'), true);
    };
  }, function(error) {
    promise.reject(error, true);
  });
  return promise;
};

/**
 * @method list
 * @description List all Shortened URLs
 */

exports.list = function() {
  return ShortURL.find({});
};

/**
 * @method extend
 * @description Private function to extend objects
 * @param {Object} original The original object to extend
 * @param {Object} updated The updates; new keys are added, existing updated
 */

var extend = function(original, updates) {
  Object.keys(updates).forEach(function(key) {
    original[key] = updates[key];
  });
  return original;
};
