import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import {
  DeleteHostedConfigurationVersionCommand,
  AppConfigClient,
  ListHostedConfigurationVersionsCommand,
} from "@aws-sdk/client-appconfig";

// Create an AppConfig Application
const appConfigApplication = new aws.appconfig.Application(
  "elisabethAppConfigApplication",
  {
    name: "elisabethAppConfigApplication",
    description: "An application for configuration management",
    tags: {
      Environment: "Fake",
    },
  }
);

// Create an AppConfig Environment
const appConfigEnvironment = new aws.appconfig.Environment(
  "elisabethAppConfigEnvironment",
  {
    name: "elisabethAppConfigEnvironment",
    description: "Environment for elisabeth application",
    applicationId: appConfigApplication.id,
    tags: {
      Environment: "Fake",
    },
    monitors: [
      {
        alarmArn: "", // Optional: Add CloudWatch alarm ARN if needed
        alarmRoleArn: "", // Optional: Add role ARN for alarm monitoring
      },
    ].filter((monitor) => monitor.alarmArn), // Remove empty monitors
  }
);

const beforeCreateHook = new pulumi.ResourceHook(
  "beforeCreateConfigProfile",
  async (args) => {
    console.log("Finding related versions", args);
  }
);

const beforeDeleteHook = new pulumi.ResourceHook(
  "beforeDeleteConfigProfile",
  async (args) => {
    console.log("Finding related versions", args);
    const client = new AppConfigClient({ region: "us-east-1" });
    // Get all versions for the profile
    const listCommand = new ListHostedConfigurationVersionsCommand({
      ApplicationId: args.oldOutputs?.applicationId,
      ConfigurationProfileId: args.oldOutputs?.configurationProfileId,
    });
    const response = await client.send(listCommand);
    if (!response.Items?.length) {
      console.log("No versions found to delete");
      return;
    }
    // Delete all versions
    await Promise.all(
      response.Items.map((version) =>
        client.send(
          new DeleteHostedConfigurationVersionCommand({
            ApplicationId: args.oldOutputs?.applicationId,
            ConfigurationProfileId: args.oldOutputs?.configurationProfileId,
            VersionNumber: version.VersionNumber!,
          })
        )
      )
    );
    console.log(`Deleted ${response.Items.length} versions`);
  }
);

// Create an AppConfig Configuration Profile
const configProfile = new aws.appconfig.ConfigurationProfile(
  "elisabethConfigProfile",
  {
    applicationId: appConfigApplication.id,
    name: "elisabethConfigProfile",
    locationUri: "hosted",
    type: "AWS.AppConfig.FeatureFlags",
    description: "Configuration profile for elisabeths application",
    tags: {
      Environment: "Fake",
    },
    validators: [
      {
        type: "JSON_SCHEMA",
        content: JSON.stringify({
          type: "object",
          properties: {
            featureFlag: { type: "boolean" },
          },
          required: ["featureFlag"],
        }),
      },
    ],
  },
  {
    hooks: {
      beforeDelete: [beforeDeleteHook],
      beforeCreate: [beforeCreateHook],
      beforeUpdate: [beforeCreateHook],
    },
  }
);

// Export useful values
export const applicationId = appConfigApplication.id;
export const configurationProfileId = configProfile.id;
export const environmentId = appConfigEnvironment.id;
