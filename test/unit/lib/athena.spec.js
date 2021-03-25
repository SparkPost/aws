'use strict';

const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;
const proxyquire = require('proxyquire');
const _ = require('lodash');

chai.use(require('sinon-chai'));
chai.use(require('chai-as-promised'));

describe('Athena', function() {
  let client, mockAthena, mockAthenaConstructor, mockAws, athenaResults;

  beforeEach(function() {
    athenaResults = require('./athena-results');
    mockAthenaConstructor = sinon.stub();

    mockAthena = {
      startQueryExecution: sinon.stub().returns({
        promise: sinon.stub().resolves({ QueryExecutionId: 'some query id' })
      }),
      getQueryExecution: sinon.stub().returns({
        promise: sinon.stub().resolves({
          QueryExecution: {
            Status: { State: 'SUCCEEDED' }
          }
        })
      }),
      getQueryResults: sinon.stub().returns({
        promise: sinon.stub().resolves(_.cloneDeep(athenaResults))
      })
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
      expect(mockAthenaConstructor).to.have.been.calledWith({
        httpOptions: { agent: 'my-proxy-server' }
      });
      expect(mockAthena.startQueryExecution).to.have.callCount(1);
      expect(mockAthena.startQueryExecution).to.have.been.calledWith({
        QueryExecutionContext: {
          Database: 'awsAthenaDatabase'
        },
        QueryString: 'some real SQL',
        ResultConfiguration: {
          OutputLocation: 's3://awsS3Bucket'
        },
        WorkGroup: 'primary'
      });
      expect(mockAthena.getQueryExecution).to.have.callCount(1);
      expect(mockAthena.getQueryExecution).to.have.been.calledWith({
        QueryExecutionId: 'some query id'
      });
      expect(mockAthena.getQueryResults).to.have.callCount(1);
      expect(mockAthena.getQueryResults).to.have.been.calledWith({
        QueryExecutionId: 'some query id'
      });
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

  it('should pass through query options ', function() {
    return client
      .query('some real SQL', { NextToken: 'hello' })
      .then((result) => {
        expect(mockAthenaConstructor).to.have.been.calledWith({
          httpOptions: { agent: 'my-proxy-server' }
        });
        expect(mockAthena.startQueryExecution).to.have.callCount(1);
        expect(mockAthena.startQueryExecution).to.have.been.calledWith({
          QueryExecutionContext: {
            Database: 'awsAthenaDatabase'
          },
          QueryString: 'some real SQL',
          ResultConfiguration: {
            OutputLocation: 's3://awsS3Bucket'
          },
          WorkGroup: 'primary'
        });
        expect(mockAthena.getQueryExecution).to.have.callCount(1);
        expect(mockAthena.getQueryExecution).to.have.been.calledWith({
          QueryExecutionId: 'some query id'
        });
        expect(mockAthena.getQueryResults).to.have.callCount(1);
        expect(mockAthena.getQueryResults).to.have.been.calledWith({
          QueryExecutionId: 'some query id',
          NextToken: 'hello'
        });
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

  it('should recursively pull query results until all results retrieved', function() {
    const athenaResultsFirstPage = _.cloneDeep(athenaResults);
    const athenaResultsNthPage = _.cloneDeep(athenaResults);
    athenaResultsNthPage.ResultSet.Rows.shift();

    mockAthena.getQueryResults.onCall(0).returns({
      promise: sinon
        .stub()
        .resolves({ ...athenaResultsFirstPage, NextToken: 'hello' })
    });
    mockAthena.getQueryResults.onCall(1).returns({
      promise: sinon
        .stub()
        .resolves({ ...athenaResultsNthPage, NextToken: 'hi' })
    });
    mockAthena.getQueryResults.onCall(2).returns({
      promise: sinon.stub().resolves(athenaResultsNthPage)
    });

    return client.query('some real SQL').then((result) => {
      expect(mockAthenaConstructor).to.have.been.calledWith({
        httpOptions: { agent: 'my-proxy-server' }
      });
      expect(mockAthena.startQueryExecution).to.have.callCount(1);
      expect(mockAthena.getQueryExecution).to.have.callCount(1);
      expect(mockAthena.getQueryResults).to.have.callCount(3);
      expect(mockAthena.getQueryResults).to.have.been.calledWith({
        QueryExecutionId: 'some query id',
        NextToken: 'hello'
      });
      expect(mockAthena.getQueryResults).to.have.been.calledWith({
        QueryExecutionId: 'some query id',
        NextToken: 'hi'
      });
      expect(mockAthena.getQueryResults).to.have.been.calledWith({
        QueryExecutionId: 'some query id'
      });
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
        },
        {
          aBoolean: true,
          aVarchar: 'giraffe',
          anInteger: 400
        },
        {
          aBoolean: false,
          aVarchar: null,
          anInteger: 603
        },
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
