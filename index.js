'use strict';

const AWS = require('aws-sdk');
const proxy = require('proxy-agent');
const clientConfig = require('./lib/client-config');

module.exports = {
  initialize: (conf) => {
    const awsConf = {};
    const configurationKeys = [
      'accessKeyId',
      'secretAccessKey',
      'region',
      'proxy',
      'maxRetries',
      'retryDelayOptions',
      'apiVersion'
    ];

    configurationKeys.forEach((key) => {
      if (key === 'proxy' && conf.proxy) {
        clientConfig.httpOptions = { agent: proxy(conf.proxy) };
      } else if (key in conf) {
        awsConf[key] = conf[key];
      }
    });

    AWS.config.update(awsConf);
  },
  Athena: require('./lib/athena'),
  DynamoDB: require('./lib/dynamo'),
  CloudSearch: require('./lib/cloudsearch'),
  SDK: AWS,
  SNS: require('./lib/sns'),
  SQS: require('./lib/sqs'),
  SSM: require('./lib/ssm')
};
