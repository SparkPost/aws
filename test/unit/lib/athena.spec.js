'use strict';

const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;
const proxyquire = require('proxyquire');

chai.use(require('sinon-chai'));
chai.use(require('chai-as-promised'));

describe('Athena', function() {
  let client, mockAthena, mockAthenaConstructor, mockAws;

  beforeEach(function() {
    const athenaResults = require('./athena-results');

    mockAthenaConstructor = sinon.stub();

    mockAthena = {
      startQueryExecution: sinon
        .stub()
        .returns({ promise: sinon.stub().resolves('some query info') }),

      getQueryExecution: sinon.stub().returns({
        promise: sinon.stub().resolves({
          QueryExecution: {
            Status: { State: 'SUCCEEDED' }
          }
        })
      }),

      getQueryResults: sinon
        .stub()
        .returns({ promise: sinon.stub().resolves(athenaResults) })
    };

    mockAws = {
      Athena: class {
        constructor(args) {
          mockAthenaConstructor(args);
          return mockAthena;
        }
      }
    };

    const athena = proxyquire('../../../lib/athena', {
      'aws-sdk': mockAws
    });

    client = athena({
      database: 'awsAthenaDatabase',
      s3Bucket: 'awsS3Bucket'
    });
  });

  it('should query athena and make the results into JSON', function() {
    return client.query('some real SQL').then((result) => {
      expect(mockAthenaConstructor).to.have.been.calledWith({});
      expect(mockAthena.startQueryExecution).to.have.callCount(1);
      expect(mockAthena.startQueryExecution).to.have.been.calledWith({
        QueryExecutionContext: {
          Database: 'awsAthenaDatabase'
        },
        QueryString: 'some real SQL',
        ResultConfiguration: {
          OutputLocation: 's3://awsS3Bucket'
        }
      });
      expect(mockAthena.getQueryExecution).to.have.callCount(1);
      expect(mockAthena.getQueryExecution).to.have.been.calledWith(
        'some query info'
      );
      expect(mockAthena.getQueryResults).to.have.callCount(1);
      expect(mockAthena.getQueryResults).to.have.been.calledWith(
        'some query info'
      );
      expect(result).to.deep.equal([
        {
          aBoolean: true,
          aVarchar: 'giraffe',
          anInteger: 400
        },
        {
          aBoolean: false,
          aVarchar: null,
          anInteger: 603
        }
      ]);
    });
  });

  it('should reject with an error if the query fails', function() {
    mockAthena.getQueryExecution.returns({
      promise: sinon.stub().resolves({
        QueryExecution: {
          Status: { State: 'FAILED', StateChangeReason: 'just no' }
        }
      })
    });

    return expect(client.query('some real bad SQL')).to.be.rejected.then(
      (error) => {
        expect(error.message).to.equal('Query failed: just no');
      }
    );
  });

  it('should keep checking to see if the query is done', function() {
    this.timeout(5 * 1000);
    mockAthena.getQueryExecution.onCall(0).returns({
      promise: sinon.stub().resolves({
        QueryExecution: {
          Status: { State: 'QUEUED' }
        }
      })
    });
    mockAthena.getQueryExecution.onCall(1).returns({
      promise: sinon.stub().resolves({
        QueryExecution: {
          Status: { State: 'SUCCEEDED' }
        }
      })
    });

    return client.query('some real sql').then((result) => {
      expect(mockAthena.getQueryExecution).to.have.callCount(2);
      expect(result).to.deep.equal([
        {
          aBoolean: true,
          aVarchar: 'giraffe',
          anInteger: 400
        },
        {
          aBoolean: false,
          aVarchar: null,
          anInteger: 603
        }
      ]);
    });
  });

  it('should throw an error if a data type is not supported', function() {
    const athenaResults = require('./athena-results');
    athenaResults.ResultSet.ResultSetMetadata.ColumnInfo[0].Type = 'pyramid';
    mockAthena.getQueryResults.returns({
      promise: sinon.stub().resolves(athenaResults)
    });

    return expect(client.query('some sql')).to.be.rejected.then((error) => {
      expect(error.message).to.equal('Type \'pyramid\' is not supported!');
    });
  });
});
