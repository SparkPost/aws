'use strict';

const chai = require('chai');
const expect = chai.expect;
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');

const _ = require('lodash');
const zlib = require('zlib');
const compress = zlib.gzipSync;
chai.use(require('chai-sinon'));
chai.use(require('chai-as-promised'));

describe('SQS Utilities', function() {
  let sqs
    ,sqsInstance
    ,sqsMock
    ,s3Mock
    ,s3Result
    ,result
    ,testConfig
    ,s3Config
    ,awsMock
    ,queueUrl;

  beforeEach(function() {
    result = 'result';

    testConfig = {
      account: 'Stark',
      queuePrefix: 'etl_',
      queueSuffix: '_ending'
    };

    sqsMock = {
      sendMessage: sinon.stub().yields(null, result),
      changeMessageVisibility: sinon.stub().yields(null, result),
      purgeQueue: sinon.stub().yields(null, result),
      deleteMessageBatch: sinon.stub().yields(null, result),
      receiveMessage: sinon.stub().yields(null, result),
      listQueues: sinon.stub().yields(null, result)
    };

    s3Mock = {
      upload: sinon.stub().yields(null, s3Result),
      getObject: sinon.stub().yields(null, s3Result)
    };

    s3Result = {
      Body: compress(JSON.stringify({ expect: 'a passing test!' }))
    };

    awsMock = {
      config: {
        region: 'Winterfel'
      },
      SQS: class {
        constructor() {
          return sqsMock;
        }
      },
      S3: class {
        constructor(config) {
          s3Config = config;
          return s3Mock;
        }
      },
      Endpoint: class {
        constructor() {
          return 'this is the endpoint';
        }
      }
    };

    // url for a queue named "queue"
    queueUrl = 'https://sqs.Winterfel.amazonaws.com/Stark/etl_queue_ending';

    sqs = proxyquire('../../../lib/sqs', {
      'aws-sdk': awsMock
    });

    sqsInstance = sqs(testConfig);
  });

  it('should return a queue name', function() {
    expect(sqsInstance.getQueueURL('webhooks')).to.equal(
      'https://sqs.Winterfel.amazonaws.com/Stark/etl_webhooks_ending'
    );
  });

  it('should use the specified endpoint in queue names', function() {
    const endpointInstance = sqs({
      ...testConfig,
      ...{ sqsEndpoint: 'some.other.endpoint' }
    });
    expect(endpointInstance.getQueueURL('webhooks')).to.equal(
      'https://some.other.endpoint/Stark/etl_webhooks_ending'
    );
    // S3 should not be using the endpoint
    expect(s3Config).to.not.have.keys(['endpoint']);
  });

  it('should default prefix and suffix to the empty string name', function() {
    delete testConfig.queuePrefix;
    delete testConfig.queueSuffix;
    sqsInstance = sqs(testConfig);

    expect(sqsInstance.getQueueURL('webhooks')).to.equal(
      'https://sqs.Winterfel.amazonaws.com/Stark/webhooks'
    );
  });

  describe('send', function() {
    afterEach(function() {
      if (JSON.stringify.restore) {
        JSON.stringify.restore();
      }
    });

    it('should send a message', function() {
      return sqsInstance
        .send({ queueName: 'queue', payload: 'payload', attrs: { foo: 'bar' } })
        .then((res) => {
          expect(res).to.equal(result);
          expect(sqsMock.sendMessage.callCount).to.equal(1);
          expect(sqsMock.sendMessage.args[0][0]).to.deep.equal({
            MessageBody: 'payload',
            QueueUrl: queueUrl,
            MessageAttributes: { foo: 'bar' }
          });
        });
    });

    it('should stringify payload', function() {
      return sqsInstance
        .send({
          queueName: 'queue',
          payload: { pay: 'load' },
          attrs: { foo: 'bar' }
        })
        .then((res) => {
          expect(res).to.equal(result);
          expect(sqsMock.sendMessage.callCount).to.equal(1);
          expect(sqsMock.sendMessage.args[0][0]).to.deep.equal({
            MessageBody: '{"pay":"load"}',
            QueueUrl: queueUrl,
            MessageAttributes: { foo: 'bar' }
          });
        });
    });

    it('should reject if there is an error parsing the payload', function() {
      const error = new Error('OH-NOS!');
      sinon.stub(JSON, 'stringify');
      JSON.stringify.throws(error);

      return expect(
        sqsInstance.send({
          queueName: 'queue',
          payload: { pay: 'load' },
          attrs: { foo: 'bar' }
        })
      ).to.be.rejectedWith(error);
    });
  });

  it('should purge a queue', function() {
    return sqsInstance.purge({ queueName: 'queue' }).then((res) => {
      expect(res).to.equal(result);
      expect(sqsMock.purgeQueue.callCount).to.equal(1);
      expect(sqsMock.purgeQueue.args[0][0]).to.deep.equal({
        QueueUrl: queueUrl
      });
    });
  });

  it('should change a message visibility timeout on an object', function() {
    return sqsInstance
      .setVizTimeout({
        queueName: 'queue',
        handle: 'handle',
        timeout: 'timeout'
      })
      .then((res) => {
        expect(res).to.equal(result);
        expect(sqsMock.changeMessageVisibility.callCount).to.equal(1);
        expect(sqsMock.changeMessageVisibility.args[0][0]).to.deep.equal({
          QueueUrl: queueUrl,
          ReceiptHandle: 'handle',
          VisibilityTimeout: 'timeout'
        });
      });
  });

  describe('extendedSend', function() {
    afterEach(function() {
      if (JSON.stringify.restore) {
        JSON.stringify.restore();
      }

      if (Math.random.restore) {
        Math.random.restore();
      }
    });

    it('should reject if s3 bucket is not provided', function() {
      return expect(
        sqsInstance.extendedSend({ queueName: 'queue' })
      ).to.be.rejected.then((err) => {
        expect(err.message).to.equal('S3 Bucket name required');
      });
    });

    it('should reject if invalid json data is sent in', function() {
      const error = new Error('OH-NOS!');
      sinon.stub(JSON, 'stringify');
      JSON.stringify.throws(error);

      return expect(
        sqsInstance.extendedSend({
          queueName: 'queue',
          s3Bucket: 'test',
          payload: { pay: 'load' },
          attrs: { foo: 'bar' }
        })
      ).to.be.rejectedWith(error);
    });

    it('should allow for setting message group ID & deduplication id', function() {
      const payload = { pay: 'load' };
      return sqsInstance
        .extendedSend({
          queueName: 'queue',
          s3Bucket: 'test',
          payload,
          attrs: { foo: 'bar' },
          messageGroupId: 'unittest',
          messageDeduplicationId: '123'
        })
        .then((res) => {
          expect(res).to.deep.equal({
            res: result,
            extended: false,
            key: false
          });
          expect(sqsMock.sendMessage.callCount).to.equal(1);
          expect(sqsMock.sendMessage.args[0][0]).to.deep.equal({
            MessageBody: compress(JSON.stringify(payload), {
              level: zlib.constants.Z_NO_COMPRESSION
            }).toString('base64'),
            QueueUrl: queueUrl,
            MessageAttributes: { foo: 'bar' },
            MessageGroupId: 'unittest',
            MessageDeduplicationId: '123'
          });
          expect(s3Mock.upload).to.not.have.been.called;
        });
    });

    it('should compress with default level when over 64KB', function() {
      const payload = _.repeat('abcd', 16500); //repeat to ~66kb

      return sqsInstance
        .extendedSend({
          queueName: 'queue',
          s3Bucket: 'test',
          payload,
          attrs: { foo: 'bar' }
        })
        .then((res) => {
          expect(res).to.deep.equal({
            res: result,
            extended: false,
            key: false
          });
          expect(sqsMock.sendMessage.callCount).to.equal(1);
          expect(sqsMock.sendMessage.args[0][0]).to.deep.equal({
            MessageBody: compress(payload).toString('base64'),
            QueueUrl: queueUrl,
            MessageAttributes: { foo: 'bar' }
          });
          expect(s3Mock.upload).to.not.have.been.called;
        });
    });

    it('should send sqs-only messages when payload size is <256kb', function() {
      const payload = { pay: 'load' };
      return sqsInstance
        .extendedSend({
          queueName: 'queue',
          s3Bucket: 'test',
          payload,
          attrs: { foo: 'bar' }
        })
        .then((res) => {
          expect(res).to.deep.equal({
            res: result,
            extended: false,
            key: false
          });
          expect(sqsMock.sendMessage.callCount).to.equal(1);
          expect(sqsMock.sendMessage.args[0][0]).to.deep.equal({
            MessageBody: compress(JSON.stringify(payload), {
              level: zlib.constants.Z_NO_COMPRESSION
            }).toString('base64'),
            QueueUrl: queueUrl,
            MessageAttributes: { foo: 'bar' }
          });
          expect(s3Mock.upload).to.not.have.been.called;
        });
    });

    it('should send sqs-only string messages when payload size is <256kb', function() {
      const payload = 'look-ma-its-a-string';
      return sqsInstance
        .extendedSend({
          queueName: 'queue',
          s3Bucket: 'test',
          payload,
          attrs: { foo: 'bar' }
        })
        .then((res) => {
          expect(res).to.deep.equal({
            res: result,
            extended: false,
            key: false
          });
          expect(sqsMock.sendMessage.callCount).to.equal(1);
          expect(sqsMock.sendMessage.args[0][0]).to.deep.equal({
            MessageBody: compress(payload, {
              level: zlib.constants.Z_NO_COMPRESSION
            }).toString('base64'),
            QueueUrl: queueUrl,
            MessageAttributes: { foo: 'bar' }
          });
        });
    });

    it('should strip S3 attributes when sending sqs-only messages and size is <256kb', function() {
      const payload = 'look-ma-its-a-string';
      return sqsInstance
        .extendedSend({
          queueName: 'queue',
          s3Bucket: 'test',
          payload,
          attrs: {
            foo: 'bar',
            EXTENDED_S3_KEY: 'imakey',
            EXTENDED_S3_BUCKET: 'imabucket'
          }
        })
        .then((res) => {
          expect(res).to.deep.equal({
            res: result,
            extended: false,
            key: false
          });
          expect(sqsMock.sendMessage.callCount).to.equal(1);
          expect(sqsMock.sendMessage.args[0][0]).to.deep.equal({
            MessageBody: compress(payload, {
              level: zlib.constants.Z_NO_COMPRESSION
            }).toString('base64'),
            QueueUrl: queueUrl,
            MessageAttributes: { foo: 'bar' }
          });
        });
    });

    it('should send s3-extended messages when payload size is >=256kb', function() {
      let payload;

      for (let index = 0; index < 300000; index++) {
        payload += Math.random()
          .toString(36)
          .substr(2, 1);
      }

      sinon.stub(Math, 'random');
      Math.random.returns(0.5);

      return sqsInstance
        .extendedSend({ queueName: 'queue', s3Bucket: 'test', payload })
        .then((res) => {
          expect(res.extended).to.equal(true);
          expect(res.key).to.match(
            /25\/[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}\.json\.gz/i
          );
          expect(s3Mock.upload).to.have.been.calledWithMatch({
            Bucket: 'test'
          });
          expect(s3Mock.upload.args[0][0].Key).to.match(
            /25\/[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}\.json\.gz/i
          );

          expect(sqsMock.sendMessage).to.have.been.calledWithMatch({
            MessageBody: 'true',
            QueueUrl: queueUrl,
            MessageAttributes: {
              EXTENDED_S3_BUCKET: {
                DataType: 'String',
                StringValue: 'test'
              },
              EXTENDED_S3_KEY: {
                DataType: 'String'
              }
            }
          });
          expect(
            sqsMock.sendMessage.args[0][0].MessageAttributes.EXTENDED_S3_KEY
              .StringValue
          ).to.match(
            /25\/[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}\.json\.gz/i
          );
        });
    });

    it('should send as sqs messages when payload size is >=256kb & compresses to <=256kb', function() {
      // Expecting payload size of 293348 bytes to compress down to ~198416 bytes
      const expected_compress_level = zlib.constants.Z_DEFAULT_COMPRESSION;
      let payload;

      for (let index = 0; index < 220000; index++) {
        payload += Math.random()
          .toString(36)
          .substr(2, 1);
      } // Payload size = 293348

      sinon.stub(Math, 'random');
      Math.random.returns(0.5);

      return sqsInstance
        .extendedSend({
          queueName: 'queue',
          s3Bucket: 'test',
          payload,
          attrs: {
            foo: 'bar',
            EXTENDED_S3_KEY: 'imakey',
            EXTENDED_S3_BUCKET: 'imabucket'
          }
        })
        .then((res) => {
          expect(res).to.deep.equal({
            res: result,
            extended: false,
            key: false
          }); // Expecting to send via SQS only
          expect(sqsMock.sendMessage.callCount).to.equal(1);
          expect(sqsMock.sendMessage.args[0][0]).to.deep.equal({
            MessageBody: compress(payload, {
              level: expected_compress_level
            }).toString('base64'),
            QueueUrl: queueUrl,
            MessageAttributes: { foo: 'bar' }
          }); // Expecting to be compressed (>64kb)
        });
    });

    it('should send as sqs messages and not compress if compressed payload <=64kb', function() {
      // Payload of ~65488 bytes should get compressed to ~112 bytes
      const expected_compress_level = zlib.constants.Z_DEFAULT_COMPRESSION;
      const payload = _.repeat('a', 49115); //repeat to ~65488 bytes ()> 65486 limit)

      sinon.stub(Math, 'random');
      Math.random.returns(0.5);

      return sqsInstance
        .extendedSend({
          queueName: 'queue',
          s3Bucket: 'test',
          payload,
          attrs: {
            foo: 'bar',
            EXTENDED_S3_KEY: 'imakey',
            EXTENDED_S3_BUCKET: 'imabucket'
          }
        })
        .then((res) => {
          expect(res).to.deep.equal({
            res: result,
            extended: false,
            key: false
          }); // Expecting to send via SQS only
          expect(sqsMock.sendMessage.callCount).to.equal(1);
          expect(sqsMock.sendMessage.args[0][0]).to.deep.equal({
            MessageBody: compress(payload, {
              level: expected_compress_level
            }).toString('base64'),
            QueueUrl: queueUrl,
            MessageAttributes: { foo: 'bar' }
          }); // Expecting to be compressed (>64kb - 50bytes)
        });
    });
  });

  describe('extendedRetrieve', function() {
    const messageBody = compress(JSON.stringify({ expect: 'a passing test!' }));

    afterEach(function() {
      if (JSON.parse.restore) {
        JSON.parse.restore();
      }
    });

    beforeEach(function() {
      sqsMock.receiveMessageAsync = sinon.stub().resolves({
        Messages: [
          {
            Body: messageBody
          }
        ]
      });
    });

    it('should handle empty receives', function() {
      sqsMock.receiveMessageAsync = sinon.stub().resolves({ Messages: [] });

      return sqsInstance
        .extendedRetrieve({ queueName: 'queue' })
        .then((res) => {
          expect(res.length).to.equal(0);
          expect(sqsMock.receiveMessageAsync.callCount).to.equal(1);
        });
    });

    it('should retrieve messages without s3', function() {
      return sqsInstance
        .extendedRetrieve({ queueName: 'queue' })
        .then((res) => {
          expect(res[0].body).to.deep.equal({ expect: 'a passing test!' });
          expect(sqsMock.receiveMessageAsync.callCount).to.equal(1);
          expect(sqsMock.receiveMessageAsync.args[0][0]).to.deep.equal({
            MaxNumberOfMessages: 10,
            QueueUrl: queueUrl,
            WaitTimeSeconds: 20,
            MessageAttributeNames: ['EXTENDED_S3_BUCKET', 'EXTENDED_S3_KEY'],
            VisibilityTimeout: 300 // default timeout
          });
          expect(s3Mock.getObject).not.to.have.been.called;
        });
    });

    it('should retrieve messages with s3', function() {
      sqsMock.receiveMessageAsync = sinon.stub().resolves({
        Messages: [
          {
            MessageAttributes: {
              EXTENDED_S3_BUCKET: {
                StringValue: 'test-bucket'
              },
              EXTENDED_S3_KEY: {
                StringValue: '/test/key'
              }
            },
            Body: compress(JSON.stringify(true))
          }
        ]
      });

      s3Mock.getObjectAsync = sinon
        .stub()
        .resolves({ Body: compress(JSON.stringify({ test: true })) });

      return sqsInstance
        .extendedRetrieve({ queueName: 'queue' })
        .then((res) => {
          expect(res[0].body).to.deep.equal({ test: true });
          expect(sqsMock.receiveMessageAsync.callCount).to.equal(1);
          expect(sqsMock.receiveMessageAsync.args[0][0]).to.deep.equal({
            MaxNumberOfMessages: 10,
            QueueUrl: queueUrl,
            WaitTimeSeconds: 20,
            MessageAttributeNames: ['EXTENDED_S3_BUCKET', 'EXTENDED_S3_KEY'],
            VisibilityTimeout: 300 // default timeout
          });
          expect(s3Mock.getObjectAsync).to.have.been.calledWithMatch({
            Key: '/test/key',
            Bucket: 'test-bucket'
          });
        });
    });

    it('should catch errors and return original message', function() {
      const err = new Error('a test error');
      s3Mock.getObjectAsync = sinon.stub().rejects(err);

      sqsMock.receiveMessageAsync = sinon.stub().resolves({
        Messages: [
          {
            MessageAttributes: {
              EXTENDED_S3_BUCKET: 'test-bucket',
              EXTENDED_S3_KEY: '/test/key'
            },
            Body: compress(JSON.stringify(true))
          }
        ]
      });

      return sqsInstance
        .extendedRetrieve({ queueName: 'queue' })
        .then((res) => {
          expect(res[0].error).to.equal(err);
          expect(sqsMock.receiveMessageAsync.callCount).to.equal(1);
          expect(sqsMock.receiveMessageAsync.args[0][0]).to.deep.equal({
            MaxNumberOfMessages: 10,
            QueueUrl: queueUrl,
            WaitTimeSeconds: 20,
            MessageAttributeNames: ['EXTENDED_S3_BUCKET', 'EXTENDED_S3_KEY'],
            VisibilityTimeout: 300 // default timeout
          });
        });
    });

    it('should catch errors with json formatting', function() {
      const err = new Error('OH-NOS!');
      sinon.stub(JSON, 'parse');
      JSON.parse.throws(err);

      return sqsInstance
        .extendedRetrieve({ queueName: 'queue' })
        .then((res) => {
          expect(res[0].error).to.equal(err);
          expect(res[0].message.Body).to.equal(messageBody);
        });
    });
  });

  describe('retrieve', function() {
    it('should retrieve messages with defaults', function() {
      return sqsInstance.retrieve({ queueName: 'queue' }).then((res) => {
        expect(res).to.equal('result');
        expect(sqsMock.receiveMessage.callCount).to.equal(1);
        expect(sqsMock.receiveMessage.args[0][0]).to.deep.equal({
          MaxNumberOfMessages: 10,
          QueueUrl: queueUrl,
          WaitTimeSeconds: 20,
          VisibilityTimeout: 300, // default timeout
          MessageAttributeNames: []
        });
      });
    });

    it('should allow for specifying long polling time', function() {
      testConfig.longPollingWaitTime = 2;
      sqsInstance = sqs(testConfig);

      return sqsInstance.retrieve({ queueName: 'queue' }).then((res) => {
        expect(res).to.equal('result');
        expect(sqsMock.receiveMessage.callCount).to.equal(1);
        expect(sqsMock.receiveMessage.args[0][0]).to.deep.equal({
          MaxNumberOfMessages: 10,
          QueueUrl: queueUrl,
          WaitTimeSeconds: 2,
          VisibilityTimeout: 300, // default timeout
          MessageAttributeNames: []
        });
      });
    });

    it('should retrieve messages with defaultVisibilityTimeout', function() {
      testConfig.defaultVisibilityTimeout = 42;
      sqsInstance = sqs(testConfig);

      return sqsInstance.retrieve({ queueName: 'queue' }).then((res) => {
        expect(res).to.equal('result');
        expect(sqsMock.receiveMessage.callCount).to.equal(1);
        expect(sqsMock.receiveMessage.args[0][0]).to.deep.equal({
          MaxNumberOfMessages: 10,
          QueueUrl: queueUrl,
          WaitTimeSeconds: 20,
          VisibilityTimeout: 42,
          MessageAttributeNames: []
        });
      });
    });

    it('should retrieve messages with defaultVisibilityTimeout override', function() {
      return sqsInstance
        .retrieve({ queueName: 'queue', visibilityTimeout: 42 })
        .then((res) => {
          expect(res).to.equal('result');
          expect(sqsMock.receiveMessage.callCount).to.equal(1);
          expect(sqsMock.receiveMessage.args[0][0]).to.deep.equal({
            MaxNumberOfMessages: 10,
            QueueUrl: queueUrl,
            WaitTimeSeconds: 20,
            VisibilityTimeout: 42,
            MessageAttributeNames: []
          });
        });
    });

    it('should retrieve messages with attributes', function() {
      return sqsInstance
        .retrieve({
          queueName: 'queue',
          messageAttributeNames: ['sp_batch_id']
        })
        .then((res) => {
          expect(res).to.equal('result');
          expect(sqsMock.receiveMessage.callCount).to.equal(1);
          expect(sqsMock.receiveMessage.args[0][0]).to.deep.equal({
            MaxNumberOfMessages: 10,
            QueueUrl: queueUrl,
            WaitTimeSeconds: 20,
            VisibilityTimeout: 300, // default timeout
            MessageAttributeNames: ['sp_batch_id']
          });
        });
    });

    it('should retrieve 1 message', function() {
      return sqsInstance
        .retrieve({ queueName: 'queue', max: 1 })
        .then((res) => {
          expect(res).to.equal('result');
          expect(sqsMock.receiveMessage.callCount).to.equal(1);
          expect(sqsMock.receiveMessage.args[0][0]).to.deep.equal({
            MaxNumberOfMessages: 1,
            QueueUrl: queueUrl,
            WaitTimeSeconds: 20,
            VisibilityTimeout: 300, // default timeout
            MessageAttributeNames: []
          });
        });
    });
  });

  it('should remove messages', function() {
    const entries = [
      { Id: 1, foo: 'bar' },
      { Id: 1, foo: 'baz' },
      { Id: 2, foo: 'bat' }
    ];

    return sqsInstance.remove({ queueName: 'queue', entries }).then((res) => {
      expect(res).to.equal('result');
      expect(sqsMock.deleteMessageBatch.callCount).to.equal(1);
      expect(sqsMock.deleteMessageBatch.args[0][0]).to.deep.equal({
        Entries: [{ Id: 1, foo: 'bar' }, { Id: 2, foo: 'bat' }],
        QueueUrl: queueUrl
      });
    });
  });

  describe('maybeRetrieveFromS3', function() {
    it('should fetch from s3 when an extended message', function() {
      s3Mock.getObjectAsync = sinon
        .stub()
        .resolves({ Body: compress(JSON.stringify({ test: true })) });

      const message = {
        body: 'should not be read',
        messageAttributes: {
          EXTENDED_S3_BUCKET: { stringValue: 'test_bucket' },
          EXTENDED_S3_KEY: { stringValue: '/test/bucket/object' }
        }
      };

      return sqsInstance.maybeRetrieveFromS3(message).then(({ body }) => {
        expect(body).to.deep.equal({ test: true });
        expect(s3Mock.getObjectAsync).to.have.been.called;
      });
    });

    it('should return decompressed from sqs when non-extended', function() {
      s3Mock.getObjectAsync = sinon.stub().rejects();

      const message = {
        body: compress(JSON.stringify({ test: true }))
      };

      return sqsInstance.maybeRetrieveFromS3(message).then(({ body }) => {
        expect(body).to.deep.equal({ test: true });
        expect(s3Mock.getObjectAsync).not.to.have.been.called;
      });
    });
  });

  describe('listQueues', function() {
    it('should call listQueues', function() {
      return sqsInstance.listQueues().then((result) => {
        expect(result).to.equal('result');
        expect(sqsMock.listQueues).to.have.been.called;
      });
    });
  });
});
