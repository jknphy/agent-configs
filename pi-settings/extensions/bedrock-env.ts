// Selects the sandbox `bedrock` AWS profile in the pi process env. Its
// credentials come from the host through bedrock-creds, see
// glaipnir/hooks/30-bedrock-env.sh.
// @ts-nocheck

export default function () {
  process.env.AWS_PROFILE = "bedrock";
  process.env.AWS_REGION = "eu-central-1";
}
