'use strict';

const aws = require('aws-sdk');
const Promise = require('bluebird');
const _ = require('lodash');

class AthenaQueryClient {
  constructor({ database, s3Bucket }) {
    this.database = database;
    this.s3Bucket = s3Bucket;
    this.athena = new aws.Athena({});
  }

  /**
   * Starts an Athena query execution
   *
   * @param {String} sql
   */
  startQuery(sql) {
    return this.athena
      .startQueryExecution({
        QueryExecutionContext: {
          Database: this.database
        },
        QueryString: sql,
        ResultConfiguration: {
          OutputLocation: `s3://${this.s3Bucket}`
        }
      })
      .promise();
  }

  /**
   * Recursively polls Athena for results based on the query execution object. Will Resolve when query has succeeded, will reject if query fails.
   *
   * @param {} queryInfo
   * @returns {Promise}
   */
  pollForResults(queryInfo) {
    return this.athena
      .getQueryExecution(queryInfo)
      .promise()
      .then(({ QueryExecution: { Status: { State, StateChangeReason } } }) => {
        if (State === 'FAILED') {
          return Promise.reject(
            new Error(`Query failed: ${StateChangeReason}`)
          );
        }
        if (State === 'SUCCEEDED') {
          return queryInfo;
        }
        return new Promise((resolve) =>
          setTimeout(() => resolve(this.pollForResults(queryInfo)), 3000)
        );
      });
  }

  getResults(queryInfo) {
    return this.athena.getQueryResults(queryInfo).promise();
  }

  formatResults(results) {
    const {
      ResultSet: {
        Rows,
        ResultSetMetadata: { ColumnInfo }
      }
    } = results;

    function convertToType(value, type) {
      if (value === null) {
        return null;
      }
      if (type === 'boolean') {
        return value === 'true';
      }
      if (type === 'varchar') {
        return value;
      }
      if (type === 'integer') {
        return parseInt(value);
      }
      throw new Error(`Type '${type}' is not supported!`);
    }

    function formatRow(row) {
      return _.reduce(
        row.Data,
        (formattedRow, value, column) => ({
          ...formattedRow,
          //todo: what is the difference between Name and Label?
          [ColumnInfo[column].Name]: convertToType(
            value.VarCharValue || null,
            ColumnInfo[column].Type
          )
        }),
        {}
      );
    }

    //the first row that comes back is the column names, so don't include that
    return _.map(_.tail(Rows), formatRow);
  }
}

module.exports = function getClient(opts) {
  const client = new AthenaQueryClient(opts);

  return {
    query(sql) {
      return client
        .startQuery(sql)
        .then((res) => client.pollForResults(res))
        .then((res) => client.getResults(res))
        .then((res) => client.formatResults(res));
    }
  };
};
