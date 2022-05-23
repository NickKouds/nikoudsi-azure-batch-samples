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

export function deletePool(batchClient, poolId) {
  console.log("Deleting Pool: " + poolId);
  const result = batchClient.pool.delete(poolId);
}

export function deleteJob(batchClient, jobId) {
  console.log("Deleting Job: " + jobId);
  const result = batchClient.job.delete(jobId);
}

export async function waitForTasksToComplete(batchClient, jobId, taskIds) {
  while (true)
  {
      var incomplete_tasks = [];
      console.log("Checking if all tasks are complete...");

      for (let index = 0; index < taskIds.length; index++) {
          var taskId = taskIds[index];
          var taskResult = await batchClient.task.get(jobId, taskId);

          if (taskResult.state != "completed") {
              console.log("Task " + taskId + " is not complete yet!");
              incomplete_tasks.push(taskId);
          }

      }

      if (incomplete_tasks.length == 0) {
          console.log("All tasks have been completed!");
          break;
      }

      sleep(30000);
  }

}

export function sleep(milliseconds) {
  console.log("Sleeping for: " + milliseconds);
  var start = new Date().getTime();
  while (true)
  {
      if ((new Date().getTime() - start) > milliseconds){
          break;
      }
  }
}