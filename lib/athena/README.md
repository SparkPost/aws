# Athena

A simplified, promise-based library for querying [Athena](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Athena.html). This removes the need write custom polling logic.

## Get a client

```
const athenaClient = new require('@sparkpost/aws').Athena( opts )
```

### Configuration Options

| Property | Description                                                                                             |
|----------|---------------------------------------------------------------------------------------------------------|
| database | The Athena database to query. Used for `QueryExecutionContext.Database` in the AWS SDK.                 |
| s3Bucket | The S3 bucket in which to store results. Used for  `ResultConfiguration.OutputLocation` in the AWS SDK. |

## Run a Query

Use the `query` method to run a query against Athena. It takes a single string of SQL and returns a promise that will be resolved with the result set or rejected with an error. The wrapper will attempt to coerce the values to native javascript types.


```
return athenaClient.query('select some, cool, columns from my_favorite_table')
  .then((results) => {
    console.log(results);
  }).catch((err) => {
    console.log('something went wrong', err);
  });
```