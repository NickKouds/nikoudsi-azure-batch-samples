import { BatchServiceClient} from "@azure/batch";
import { ClientSecretCredential} from "@azure/identity";
import {BatchManagementClient} from "@azure/arm-batch";
import { deleteJob, deleteDataPlanePool } from "./utilities/utils.js";


const AZURE_CLIENT_SECRET = "HWF7Q~WBTl62N36iR0S4EGmfadrwlXgHLAnNo";
const AZURE_CLIENT_ID = "effcc413-3c01-4f1d-983f-55166bd727c9";
const AZURE_TENANT_ID= "72f988bf-86f1-41af-91ab-2d7cd011db47";
const BATCH_ENDPOINT = "https://sdktest.westus.batch.azure.com";


/**
 * Create the Batch Service Client, this will be used to interface with jobs and tasks
 */

const credential = new ClientSecretCredential(
    AZURE_TENANT_ID,
    AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET
  );


const batchClient = new BatchServiceClient(credential, BATCH_ENDPOINT);

/**
 * Create the Batch Management Client, this will be used to interface with pools
 */
 const resourceGroup = "nikoudsiSDKTest";
 const accountName = "sdktest";
 const subscriptionId = "65634139-3762-476b-946d-e221f4cdc2bf";
 const batchManagement = new BatchManagementClient(credential, subscriptionId);


// Replace values with SAS URIs of the shell script file
const sh_url = "https://batchsdktest.blob.core.windows.net/scripts/startup_prereq.sh?sv=2020-10-02&st=2022-03-21T20%3A20%3A20Z&se=2022-03-25T20%3A20%3A00Z&sr=b&sp=r&sig=kzFI22pTIrGGLHh14pAroY%2BD9rVJVETu%2FeRMVzxmJBI%3D";

// Replace values with SAS URIs of the Python script file
const scriptURI = "https://batchsdktest.blob.core.windows.net/scripts/processcsv.py?sv=2020-10-02&st=2022-03-21T20%3A19%3A14Z&se=2022-03-25T20%3A19%3A00Z&sr=b&sp=r&sig=ABeDvVPVSVaIzyeSwm5svCJKl%2FG9SD1P5LbZVgbZW%2FU%3D";


// Pool ID 
const now = new Date();
const poolId = `processcsv_${now.getFullYear()}${now.getMonth()}${now.getDay()}${now.getHours()}${now.getSeconds()}`;

// Job ID 
const jobId = "processcsvjob";
const taskIds = [];


async function provisionStorage() {
    //Link Storage account to Batch account
    const autoStorageProperties = {
        storageAccountId: "/subscriptions/65634139-3762-476b-946d-e221f4cdc2bf/resourceGroups/nikoudsiSDKTest/providers/Microsoft.Storage/storageAccounts/batchsdktest"
    };

    const batchAccountUpdateParams = {
        autoStorage: autoStorageProperties
    }

    const result = await batchManagement.batchAccountOperations.update(resourceGroup, accountName, batchAccountUpdateParams);
    console.log(result.autoStorage.storageAccountId);
    console.log(result.autoStorage.storageAccountId == autoStorageProperties.storageAccountId);
}

function createPool()
{
    // Pool VM Image Reference
    const imgRef = {
        publisher: "Canonical",
        offer: "UbuntuServer",
        sku: "18.04-LTS",
        version: "latest"
    }
    // Pool VM configuraion object
    const vmConfig = {
        imageReference: imgRef,
        nodeAgentSKUId: "batch.node.ubuntu 18.04"
    };
    // Number of VMs to create in a pool
    const numVms = 4;
    const vmSize = "STANDARD_D1_V2";
    // Pool configuration object
    const poolConfig = {
        id: poolId,
        displayName: "Processing csv files",
        vmSize: vmSize,
        virtualMachineConfiguration: vmConfig,
        targetDedicatedNodes: numVms,
        enableAutoScale: false
    };

    // Creating Batch Pool
    console.log("Creating pool with ID : " + poolId);
    try {
        const pool = batchClient.pool.add(poolConfig);
    }
    catch (error) {
        console.log(error);
        throw error;
      }
    
}


async function createJob() {
    console.log("Creating job with ID : " + jobId);
    // Preparation Task configuraion object    
    const jobPrepTaskConfig = {
        id: "installprereq",
        commandLine: "sudo sh startup_prereq.sh > startup.log",
        resourceFiles: [{ 'httpUrl': sh_url, 'filePath': 'startup_prereq.sh' }],
        waitForSuccess: true, runElevated: true,
        userIdentity: {
            autoUser: {
                elevationLevel: "admin",
                scope: "pool"
            }
          }
    };

    // Setting Batch Pool ID
    const poolInfo = { poolId: poolId };
    // Batch job configuration object
    const jobConfig = {
        id: jobId,
        displayName: "process csv files",
        jobPreparationTask: jobPrepTaskConfig,
        poolInfo: poolInfo
    };

    // Submitting Batch Job
    try {
        const job =  await batchClient.job.add(jobConfig);
        createTasks();
    }
    catch (error) {
        console.log(error);
    }
    

}

async function createTasks() {
    console.log("Creating tasks....");
    const containerList = ["con1", "con2", "con3", "con4"];      //Replace with list of blob containers within storage account

    for (let index = 0; index < containerList.length; index++)
    {
        const containerName = containerList[index];
        console.log("Submitting task for container : " + containerName);
        const taskID = containerName + "_process";
        // Task configuration object
        const taskConfig = {
            id: taskID,
            displayName: 'process csv in ' + containerName,
            commandLine: 'python processcsv.py --container ' + containerName,
            resourceFiles: [{ 'httpUrl': scriptURI, 'filePath': 'processcsv.py' }]
        };

        const task = await batchClient.task.add(jobId, taskConfig);
        taskIds.push(taskID);
    }

    waitForTasksToComplete();

}

async function waitForTasksToComplete() {
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

    cleanupResources();

}

function deleteTasks()
{
    taskIds.forEach(function(val, index) {
        console.log("Deleting Task: " + val);
        const result = batchClient.task.delete(jobId, val);
    })
    
}

function initiateResources()
{
    provisionStorage();
    // createPool();
    // createJob();
}

function cleanupResources()
{
    deleteTasks();
    deleteJob(batchClient, jobId);
    deleteDataPlanePool(batchClient, poolId);
}

function sleep(milliseconds) {
    console.log("Sleeping for: " + milliseconds);
    var start = new Date().getTime();
    while (true)
    {
        if ((new Date().getTime() - start) > milliseconds){
            break;
        }
    }
  }
  

initiateResources();


