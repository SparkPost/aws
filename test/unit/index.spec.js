'use strict';

const chai = require('chai');
const expect = chai.expect;
const proxyquire = require('proxyquire');

describe('AWS wrapper', function() {
  let awsWrapper;

  beforeEach(function() {
    awsMock = {
      config: { update: sinon.stub() }
    };
    awsWrapper = proxyquire('../../index', {
      'aws-sdk': awsMock
    });
  });

  it('should return object with wrapper keys', function() {

  }):

  it('should set proxy option on client config when key is present', function() {

  });

  it('should set proxy option on aws config with sdkProxy key is present', function() {

  });

});
