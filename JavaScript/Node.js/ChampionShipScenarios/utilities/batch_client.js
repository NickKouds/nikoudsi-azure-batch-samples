import { ClientSecretCredential} from "@azure/identity";
import { BatchServiceClient, BatchSharedKeyCredentials } from "@azure/batch";


export function createClient(authMethod, options = null) {
  let credential;
  switch (authMethod) {
    case "APIKey": {
      credential = new BatchSharedKeyCredentials(
        process.env.AZURE_BATCH_ACCOUNT,
        process.env.AZURE_BATCH_ACCESS_KEY
      );
      break;
    }
    case "AAD": {
      credential = new ClientSecretCredential(
        process.env.AZURE_TENANT_ID,
        process.env.AZURE_CLIENT_ID,
        process.env.AZURE_CLIENT_SECRET
      );
      break;
    }
    default: {
      throw Error(`Unsupported authentication method: ${authMethod}`);
    }
  }
  console.log("Instantiating Batch Service Client with " + authMethod);
  return new BatchServiceClient(
    credential,
    process.env.AZURE_BATCH_ENDPOINT,
    options
  );
}