# SNS

To get an instance of the SNS wrapper:

```js
const sns = require('@sparkpost/aws').SNS({ 
  account: 'abc123', 
  arnSuffix: '-prd', 
  defaultSubject: 'some message subject'
});
```

`account` is required. `arnSuffix` and `defaultSubject` default to the empty string.

The SNS topic ARN will be contructed as `arn:aws:sns:${AWS.config.region}:${account}:sns-${topicName}${arnSuffix}`

## Publishing a Message

You can publish a messge to an SNS topic using the promisified `publish` method:

```js
sns.publish({message, topicName, subject})
  .then(() => console.log('published!'))
  .catch((err) => console.log(err)));
```

`message` will be stringified if it is not already a String. `subject` is optional and will default to `defaultSubject` set in the constructor.

