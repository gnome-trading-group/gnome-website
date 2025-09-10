import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as certificatemanager from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as cloudfrontOrigins from "aws-cdk-lib/aws-cloudfront-origins";
import { Construct } from "constructs";
import { execSync } from "child_process";
import * as path from "path";
import { Stage } from "@gnome-trading-group/gnome-shared-cdk";

interface FrontendStackProps extends cdk.StackProps {
  stage: Stage;
  domainName: string;
  subdomain: string | undefined;
  certificateArn: string;
}

export class FrontendStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const domainName = props.subdomain ? `${props.subdomain}.${props.domainName}` : props.domainName;

    const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      bucketName: domainName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const certificate = certificatemanager.Certificate.fromCertificateArn(this, "WebsiteCertificate", props.certificateArn);

    const distribution = new cloudfront.Distribution(this, "WebsiteDistribution", {
      domainNames: [domainName],
      certificate,
      defaultBehavior: {
        origin: new cloudfrontOrigins.S3Origin(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: "index.html",
    });

    const uiPath = path.join(__dirname, "..", "..", "..");

    const asset = new cdk.AssetStaging(this, "WebsiteAsset", {
      sourcePath: uiPath,
      bundling: {
        image: cdk.DockerImage.fromRegistry('public.ecr.aws/docker/library/node:18'),
        local: {
          tryBundle(outputDir: string): boolean {
            return false;
            // try {
            //   // If you're running locally, make sure to run `npm run build` in the UI beforehand
            //   execSync(`cp -r ${uiPath}/dist/* ${path.join(outputDir)}`)
            // } catch {
            //   return false
            // }
            // return true
          },
        },
        command: [
          'bash', '-c',
          [
            // `cp .env.${props.stage} .env`,
            'npm ci',
            'npm run build',
            'cp -r dist/* /asset-output',
          ].join(' && ')
        ],
      },
    });

    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [s3deploy.Source.asset(asset.absoluteStagedPath)],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    new cdk.CfnOutput(this, "WebsiteDistributionDomainName", {
      value: `https://${distribution.distributionDomainName}`,
      description: "Website URL",
    });
  }
}
