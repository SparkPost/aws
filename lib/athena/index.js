'use strict';

const aws = require('aws-sdk');
const Promise = require('bluebird');
const _ = require('lodash');
const clientConfig = require('../client-config');

class AthenaQueryClient {
  constructor({ database, s3Bucket }) {
    this.database = database;
    this.s3Bucket = s3Bucket;
    const config = _.cloneDeep(clientConfig);
    this.athena = new aws.Athena(config);
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

  /**
   * Recursively retrieves results from Athena once they are ready
   *
   * @param {object} queryInfo
   * @param {array}  accumulatedResults
   * @return {Promise.<object>}
   */
  getResults(queryInfo, accumulatedResults = []) {
    return this.athena
      .getQueryResults(queryInfo)
      .promise()
      .then((results) => {
        accumulatedResults = accumulatedResults.concat(results.ResultSet.Rows);

        if (results.NextToken) {
          // promise to retrieve next page
          return this.getResults(
            { ...queryInfo, NextToken: results.NextToken },
            accumulatedResults
          );
        } else {
          // return results
          results.ResultSet.Rows = accumulatedResults;
          return results;
        }
      });
  }

  /**
   * Formats an Athena result set into an array of objects. Keys are column names, values are the query values. Tries to coerce the Athena datatypes to native JS types.
   *
   * @param {Object} results
   */
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
      if (type === 'integer' || type === 'bigint') {
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

/**
 * Returns a new Athena client.
 *
 * @param {String} opts.database The Athena database to query.
 * @param {String} opts.s3Bucket The S3 bucket in which to store results.
 * @return {Object} An Athena client.
 */
module.exports = function getClient(opts) {
  const client = new AthenaQueryClient(opts);

  return {
    /**
     * Runs a query against Athena a returns a promise resolved with the results.
     *
     * @param {String} sql
     * @return {Promise} A promise resolved with the results or rejected with an error.
     * Results will be a map of column name to value, with values coerced to the native javascript datatype.
     */
    query(sql, queryOpts) {
      return client
        .startQuery(sql)
        .then((res) => client.pollForResults(res))
        .then((res) => client.getResults({ ...res, ...queryOpts }))
        .then((res) => client.formatResults(res));
    }
  };
};
