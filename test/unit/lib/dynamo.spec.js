/* eslint id-length: "off" */
'use strict';

const chai = require('chai');
const expect = chai.expect;
const http = require('http');
const https = require('https');
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');

chai.use(require('sinon-chai'));

describe('DynamoDB', function() {
  let DynamoDB, documentClientStub;

  beforeEach(function() {
    documentClientStub = sinon.stub();
    DynamoDB = proxyquire('../../../lib/dynamo', {
      'aws-sdk': {
        DynamoDB: {
          DocumentClient: documentClientStub
        }
      },
      '../client-config': {}
    });
  });

  describe('setupHTTPAgent', function() {
    it('should use https.Agent by default (no endpoint)', function() {
      new DynamoDB({});
      const config = documentClientStub.firstCall.args[0];
      expect(config.httpOptions.agent).to.be.an.instanceOf(https.Agent);
      expect(config.httpOptions.agent.options.rejectUnauthorized).to.equal(
        true
      );
    });

    it('should use https.Agent when endpoint is https://', function() {
      new DynamoDB({ endpoint: 'https://dynamodb.us-west-2.amazonaws.com' });
      const config = documentClientStub.firstCall.args[0];
      expect(config.httpOptions.agent).to.be.an.instanceOf(https.Agent);
    });

    it('should use http.Agent when endpoint is http://', function() {
      new DynamoDB({ endpoint: 'http://localhost:8000' });
      const config = documentClientStub.firstCall.args[0];
      const agent = config.httpOptions.agent;
      expect(agent).to.be.an.instanceOf(http.Agent);
      expect(agent).to.not.be.an.instanceOf(https.Agent);
      expect(agent.keepAlive).to.equal(true);
      expect(agent.maxSockets).to.equal(50);
    });

    it('should use http.Agent when endpoint is an object with http: protocol', function() {
      new DynamoDB({ endpoint: { protocol: 'http:' } });
      const config = documentClientStub.firstCall.args[0];
      expect(config.httpOptions.agent).to.be.an.instanceOf(http.Agent);
      expect(config.httpOptions.agent).to.not.be.an.instanceOf(https.Agent);
    });

    it('should not set rejectUnauthorized for http.Agent', function() {
      new DynamoDB({ endpoint: 'http://localhost:8000' });
      const config = documentClientStub.firstCall.args[0];
      expect(config.httpOptions.agent.options.rejectUnauthorized).to.be
        .undefined;
    });

    it('should not create an agent when bypassProxy=false and useKeepalives=false', function() {
      new DynamoDB({ bypassProxy: false, useKeepalives: false });
      const config = documentClientStub.firstCall.args[0];
      expect(config.httpOptions.agent).to.be.undefined;
    });

    it('should strip bypassProxy and useKeepalives from config passed to DocumentClient', function() {
      new DynamoDB({
        bypassProxy: true,
        useKeepalives: true,
        endpoint: 'http://localhost:8000'
      });
      const config = documentClientStub.firstCall.args[0];
      expect(config).to.not.have.property('bypassProxy');
      expect(config).to.not.have.property('useKeepalives');
    });
  });
});
