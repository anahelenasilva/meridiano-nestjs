import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

interface S3StackProps extends cdk.StackProps {
  environment: string;
}

export class S3Stack extends cdk.Stack {
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: S3StackProps) {
    super(scope, id, props);

    const { environment } = props;

    const bucketName = `meridiano-api-articles-${environment}`;

    this.bucket = new s3.Bucket(this, 'ArticlesBucket', {
      bucketName,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      cors: [
        {
          allowedOrigins: [
            'http://100.127.158.111:3000',
            'http://192.168.1.18:3000',
            'http://localhost:3000',
          ],
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
          ],
          allowedHeaders: [
            '*',
          ],
          exposedHeaders: [
            'ETag',
            'x-amz-server-side-encryption',
            'x-amz-request-id',
            'x-amz-id-2',
          ],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(90),
        },
      ],
    });

    const readWritePolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:ListBucket',
      ],
      resources: [
        this.bucket.bucketArn,
        `${this.bucket.bucketArn}/*`,
      ],
    });

    const managedPolicy = new iam.ManagedPolicy(this, 'ArticlesBucketReadPolicy', {
      description: `Read and write access to Meridiano articles S3 bucket for ${environment} environment`,
      statements: [readWritePolicy],
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'S3 bucket name for articles',
      exportName: `${environment}-ArticlesBucketName`,
    });

    new cdk.CfnOutput(this, 'BucketArn', {
      value: this.bucket.bucketArn,
      description: 'S3 bucket ARN for articles',
      exportName: `${environment}-ArticlesBucketArn`,
    });

    new cdk.CfnOutput(this, 'ReadPolicyArn', {
      value: managedPolicy.managedPolicyArn,
      description: 'IAM policy ARN for reading from articles bucket',
      exportName: `${environment}-ArticlesReadPolicyArn`,
    });
  }
}
