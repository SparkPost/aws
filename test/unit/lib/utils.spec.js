/* eslint id-length: "off" */
'use strict';

const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;
const http = require('http');
const https = require('https');
const utils = require('../../../lib/utils');

chai.use(require('sinon-chai'));
chai.use(require('chai-as-promised'));

describe('AWS Library utilities', function() {
  const testCases = [
    [
      'should compute string value byte length',
      'abcde',
      { a: { StringValue: 'c' } },
      10
    ],
    [
      'should compute string list value byte length',
      'abcde',
      { a: { StringListValues: ['a', 'b', 'c', 'd'] } },
      13
    ],
    [
      'should compute binary value byte length',
      'abcde',
      { a: { BinaryValue: '\u0010\u00a0' } },
      11
    ],
    [
      'should compute binary list value byte length',
      'abcde',
      { a: { BinaryListValues: ['\u0010\u00a0', '\u0010\u00a0'] } },
      13
    ]
  ];

  testCases.forEach(function([testCase, body, attrs, expectedValue]) {
    it(testCase, function() {
      return expect(utils.computeMessageSize(body, attrs)).to.equal(
        expectedValue
      );
    });
  });

  it('should allow for promisifying an object with async methods', function() {
    const badAmazon = {
      onAsyncWhyAmazon: sinon.stub().resolves(true),
      callbackExample(cb) {
        return cb(null, true);
      }
    };

    utils.promisify(badAmazon);
    return badAmazon
      .onAsyncWhyAmazon()
      .then((ret) => expect(ret).to.be.true)
      .then(() => badAmazon.callbackExampleAsync())
      .then((ret) => expect(ret).to.be.true);
  });

  it('should support setting up a keepalive agent through config', function() {
    const awsMock = sinon.stub();

    utils.setHttpAgent({}, true, awsMock);
    expect(awsMock).to.have.been.calledWithMatch({
      httpOptions: { agent: sinon.match.any }
    });
  });

  it('should default to not setting up http keepalives', function() {
    const awsMock = sinon.stub();

    utils.setHttpAgent(undefined, undefined, awsMock);
    expect(awsMock).to.have.been.calledWithMatch({});
  });

  it('should use https.Agent when bypassProxy is true and no endpoint is set', function() {
    const awsMock = sinon.stub();

    utils.setHttpAgent({}, true, awsMock);
    const config = awsMock.firstCall.args[0];
    expect(config.httpOptions.agent).to.be.an.instanceOf(https.Agent);
  });

  it('should use https.Agent when bypassProxy is true and endpoint is https', function() {
    const awsMock = sinon.stub();

    utils.setHttpAgent({ endpoint: { protocol: 'https:' } }, true, awsMock);
    const config = awsMock.firstCall.args[0];
    expect(config.httpOptions.agent).to.be.an.instanceOf(https.Agent);
  });

  it('should use http.Agent when bypassProxy is true and endpoint is http', function() {
    const awsMock = sinon.stub();

    utils.setHttpAgent({ endpoint: { protocol: 'http:' } }, true, awsMock);
    const config = awsMock.firstCall.args[0];
    const agent = config.httpOptions.agent;
    expect(agent).to.be.an.instanceOf(http.Agent);
    expect(agent).to.not.be.an.instanceOf(https.Agent);
    expect(agent.keepAlive).to.equal(true);
    expect(agent.maxSockets).to.equal(50);
  });
});
