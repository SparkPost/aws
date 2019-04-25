# CloudSearch (CloudSearch Domain)

Get an instance of [the CloudSearch Domain API](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudSearchDomain.html), stored as `client` on a `CloudSearch` instance. All methods described in the docs are available as Bluebird promisified versions (search becomes searchAsync, for example).

To set up the lib:

```javascript
const aws = require('@sparkpost/aws');
const cs = new aws.CloudSearch({endpoint: "https://search-my-cs-domain-url.com"}).client;
```

Note that for some strange reason, it is _required_ that you pass the CloudSearch endpoint parameter in as part of the instantiation of a new client (which is documented [here](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudSearchDomain.html#constructor-property))
