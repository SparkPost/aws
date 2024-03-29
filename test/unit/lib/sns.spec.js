'use strict';

const chai = require('chai');
const expect = chai.expect;
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');

chai.use(require('sinon-chai'));
chai.use(require('chai-as-promised'));

describe('SNS Utilities', function() {
  let sns, snsInstance, snsMock, result, testConfig, awsMock, arn;

  beforeEach(function() {
    result = 'result';

    testConfig = {
      account: 'Stark',
      arnSuffix: '-ending'
    };

    snsMock = {
      publish: sinon.stub().yields(null, result)
    };

    awsMock = {
      config: {
        region: 'Winterfel'
      },
      SNS: class {
        constructor() {
          return snsMock;
        }
      }
    };

    // arn for a topic named "topic"
    arn = 'arn:aws:sns:Winterfel:Stark:sns-topic-ending';

    sns = proxyquire('../../../lib/sns', {
      'aws-sdk': awsMock
    });

    snsInstance = sns(testConfig);
  });

  describe('publish', function() {
    let message;

    beforeEach(function() {
      message = 'message';
    });

    afterEach(function() {
      if (JSON.stringify.restore) {
        JSON.stringify.restore();
      }
    });

    it('should publish a message', function() {
      return snsInstance.publish({ message, topicName: 'topic' }).then(() => {
        expect(snsMock.publish).to.have.been.calledWith({
          Message: message,
          Subject: undefined,
          TopicArn: arn
        });
      });
    });

    it('should publish a message with attributes', function() {
      return snsInstance
        .publish({
          message,
          topicName: 'topic',
          messageAttributes: 'some attributes'
        })
        .then(() => {
          expect(snsMock.publish).to.have.been.calledWith({
            Message: message,
            Subject: undefined,
            TopicArn: arn,
            MessageAttributes: 'some attributes'
          });
        });
    });

    it('should use a default subject', function() {
      testConfig.defaultSubject = 'defaultSubject';
      snsInstance = sns(testConfig);

      return snsInstance.publish({ message, topicName: 'topic' }).then(() => {
        expect(snsMock.publish).to.have.been.calledWith({
          Message: message,
          Subject: 'defaultSubject',
          TopicArn: arn
        });
      });
    });

    it('should set a subject if passed', function() {
      snsInstance = sns(testConfig);

      return snsInstance
        .publish({ message, topicName: 'topic', subject: 'Arya' })
        .then(() => {
          expect(snsMock.publish).to.have.been.calledWith({
            Message: message,
            Subject: 'Arya',
            TopicArn: arn
          });
        });
    });

    it('should default the arnSuffix to the emptyString', function() {
      delete testConfig.arnSuffix;
      snsInstance = sns(testConfig);

      return snsInstance
        .publish({ message, topicName: 'topic', subject: 'Arya' })
        .then(() => {
          expect(snsMock.publish).to.have.been.calledWith({
            Message: message,
            Subject: 'Arya',
            TopicArn: 'arn:aws:sns:Winterfel:Stark:sns-topic'
          });
        });
    });

    it('should allow arnPrefix to be overriden', function() {
      testConfig.arnPrefix = 'sneeze-'; // the proper way to pronounce SNS. this is canon.
      snsInstance = sns(testConfig);

      return snsInstance
        .publish({ message, topicName: 'topic', subject: 'Arya' })
        .then(() => {
          expect(snsMock.publish).to.have.been.calledWith({
            Message: message,
            Subject: 'Arya',
            TopicArn: 'arn:aws:sns:Winterfel:Stark:sneeze-topic-ending'
          });
        });
    });

    it('should stringify non-string messages', function() {
      const message = { jon: 'snow' };

      return snsInstance
        .publish({ message, topicName: 'topic', subject: 'Arya' })
        .then(() => {
          expect(snsMock.publish).to.have.been.calledWith({
            Message: JSON.stringify(message),
            Subject: 'Arya',
            TopicArn: arn
          });
        });
    });

    it('should reject if there is an error parsing the payload', function() {
      const error = new Error('YOU KNOW NOTHING');
      sinon.stub(JSON, 'stringify');
      JSON.stringify.throws(error);

      return expect(
        snsInstance.publish({
          message: {},
          topicName: 'topic',
          subject: 'Arya'
        })
      ).to.be.rejectedWith(error);
    });

    it('should reject if the push fails', function() {
      const error = new Error('YOU KNOW NOTHING');

      snsMock.publish.yields(error);

      return expect(snsInstance.publish({ message, topicName: 'topic' })).to.be
        .rejected;
    });
  });
});
