![Build Status](https://codebuild.us-west-2.amazonaws.com/badges?uuid=eyJlbmNyeXB0ZWREYXRhIjoicHM2ajJNMnpwUDRGNno0YlpRWDZTL0FzaG84aHpqLytmcW4vbUdVS3lOVUhCUy9SNTJ4dUtpZkl5WEZZV1NtMnMyQ2xZMUhhcDRBeDAzVlR5V3pGclRjPSIsIml2UGFyYW1ldGVyU3BlYyI6IlNHSkxoenRCVUcxaTdOaisiLCJtYXRlcmlhbFNldFNlcmlhbCI6MX0%3D&branch=master)

# aws
Thin wrappers around the aws-sdk libraries we use.

### Initialization

Rather than having to assemble all the necessary connection config in every file that needs aws services, this wrapper provides a simple way to set up the AWS credentials in one place, one time for the whole service. This also allows the service to remove this initialization step later in favor of ENV_VAR or instance profile auth management, if possible.

For example, in app.js:

```javascript
'use strict';

const AWS = require('@sparkpost/aws');
// ... whatever else you need, besides the actual models etc. that use aws

/*
 * This needs to occur before the resources module tree is required
 * because the AWS module needs to be globally configured before any
 * usage / instantiation can occur.
 */
if (config.get('aws.enabled') && config.get('aws.enabled') === true) {
  AWS.initialize({
    accessKeyId: config.get('aws.accessKeyId'),
    secretAccessKey: passwords.maybeDecrypt(config.get('aws.secretAccessKey')),
    region: config.get('aws.region'),
    proxy: process.env.HTTPS_PROXY
  });
}

// the files that use aws are required *after* the setup (note: better auth strategies might avoid this order-dependencies in the future)
const resources = require('./resources');
```

### AWS SDK Client

If you want access to the raw `aws-sdk` client you can use the `SDK` property.

```js
const AWS = require('@sparkpost/aws');
const marketplaceMeteringService = new AWS.SDK.MarketplaceMetering({ apiVersion: '2016-01-14' });
marketplaceMeteringService.resolveCustomer({ RegistrationToken: token }, (err, data) => { ... });
```

### Supported Services

 * [Athena](lib/athena/README.md)
 * [CloudSearch](lib/cloudsearch/README.md)
 * [DynamoDB](lib/dynamo/README.md)
 * [SNS](lib/sns/README.md)
 * [SQS](lib/sqs/README.md)
 * SSM
