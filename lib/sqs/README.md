# SQS

To get an instance of the SQS wrapper:

```js
const sqs = require('@sparkpost/aws').SQS({ 
  account: 'abc123', 
  queuePrefix: 'sqs-', 
  queueSuffix: '-prd',
  defaultVisibilityTimeout: 301,
});
```

Localstack configuration example

```js
const sqs = require('@sparkpost/aws').SQS({ 
  account: '000000000000',
  bypassProxy: false,
  sqsEndpoint: 'localhost:4566',
  sqsProtocol: 'http',
  s3Endpoint: 'localhost:4566',
  s3Protocol: 'http',
  s3ForcePathStyle: true
});
```

`account` is required and is the AWS account ID.

`queuePrefix` and `queueSuffix` are optional and default to the empty string. They are used in constructing the SQS queue URL.

`defaultVisibilityTimeout` is optional and defaults to 300s. It sets the VisibilityTimeout value when retrieving messgaes from a queue.

`sqsEndpoint` is optional default to null. It sets the SQS endpoint used in all SQS requests.

`sqsProtocol` is optional and defaults to https. It sets the protocol used
in SQS URL.

`s3Endpoint` is optional default to null. It sets the S3 endpoint used in all S3 requests.

`s3Protocol` is optional and defaults to https. It sets the protocol used
in S3 URL.

`s3ForcePathStyle` is optional and default to null. It sets whether to force path style URLs for S3 objects. It's useful when running Localstack.

## getQueueURL

Returns the queue url used by this instance.

```js
const url = sqs.getQueueUrl(queueName);
```

## purge

Purges the queue of messages.

```js
sqs.purge(queueName)
  .then(() => console.log('purged!'))
  .catch((err) => console.log(err)));
```

## remove

Removes a batch of messages from the queue

```js
sqs.remove({ queueName, entries })
  .then(() => console.log('removed!'))
  .catch((err) => console.log(err)));
```

## retrieve

Retrieves a batch of messages from the queue.

`max` defaults to 10, `messageAttributeNames` defaults to an empty array.

```js
sqs.retrieve({ queueName, max, messageAttributeNames, visibilityTimeout })
  .then(() => console.log('retrieved!'))
  .catch((err) => console.log(err)));
```

## send

Sends a message to the queue.

```js
sqs.send({ queueName, payload, attrs })
  .then(() => console.log('sent!'))
  .catch((err) => console.log(err)));
```

## setVizTimeout

Changes the visibility timeout of a handle.

```js
sqs.setVizTimeout({ queueName, handle, timeout })
  .then(() => console.log('setVizTimeout-ed!'))
  .catch((err) => console.log(err)));
```
