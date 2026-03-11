'use strict';

const chai = require('chai');
const expect = chai.expect;
const http = require('http');
const https = require('https');

chai.use(require('sinon-chai'));

const DynamoDB = require('../../../lib/dynamo');

describe('DynamoDB', function() {
  it('should throw when useKeepalives is true and bypassProxy is false', function() {
    expect(
      () => new DynamoDB({ bypassProxy: false, useKeepalives: true })
    ).to.throw('Can\'t use keepalives while using a proxy!');
  });

  it('should not set an agent when bypassProxy is true and useKeepalives is false', function() {
    const dynamo = new DynamoDB({ bypassProxy: true, useKeepalives: false });
    expect(dynamo.client.service.config.httpOptions.agent).to.be.undefined;
  });

  it('should use https.Agent by default', function() {
    const dynamo = new DynamoDB({});
    expect(dynamo.client.service.config.httpOptions.agent).to.be.an.instanceOf(
      https.Agent
    );
  });

  it('should use http.Agent when endpoint is an http string', function() {
    const dynamo = new DynamoDB({ endpoint: 'http://localhost:8000' });
    const agent = dynamo.client.service.config.httpOptions.agent;
    expect(agent).to.be.an.instanceOf(http.Agent);
    expect(agent).to.not.be.an.instanceOf(https.Agent);
  });
});
