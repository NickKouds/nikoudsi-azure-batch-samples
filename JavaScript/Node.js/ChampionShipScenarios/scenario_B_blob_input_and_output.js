import { BatchServiceClient} from "@azure/batch";
import { ClientSecretCredential} from "@azure/identity";
import {BatchManagementClient} from "@azure/arm-batch";
import {StorageClient} from "./utilities/storage_client.js"


const AZURE_CLIENT_SECRET = process.env["AZURE_CLIENT_SECRET"];
const AZURE_CLIENT_ID = process.env["AZURE_CLIENT_ID"];
const AZURE_TENANT_ID= process.env["AZURE_TENANT_ID"];
const BATCH_ENDPOINT = process.env["AZURE_BATCH_ENDPOINT"];


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
//  const resourceGroup = "";
//  const accountName = "";
//  const subscriptionId = "";
//  const batchManagement = new BatchManagementClient(credential, subscriptionId);


// Replace values with SAS URIs of the shell script file
const sh_url = "";

// Replace values with SAS URIs of the Python script file
const scriptURI = "";


// Pool ID 
const now = new Date();
const poolId = `processcsv_${now.getFullYear()}${now.getMonth()}${now.getDay()}${now.getHours()}${now.getSeconds()}`;

// Job ID 
const jobId = "processcsvjob";

//Task IDS
const taskIds = [];

//Storage Client
const storageClient = new StorageClient("batchsdktest", credential);
const containerList = ["con1", "con2", "con3", "con4"];      //Replace with list of blob containers within storage account


async function provisionStorage() {
    //Link Storage account to Batch account
    const autoStorageProperties = {
        storageAccountId: ""
    };

    const batchAccountUpdateParams = {
        autoStorage: autoStorageProperties
    }

    const result = await batchManagement.batchAccountOperations.update(resourceGroup, accountName, batchAccountUpdateParams);
    console.log(result.autoStorage.storageAccountId);
    console.log(result.autoStorage.storageAccountId == autoStorageProperties.storageAccountId);
}

async function createPool()
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
        const pool = await batchClient.pool.add(poolConfig, {onResponse: function (rawResponse, flatResponse, error) {
            if (error != null)
            {
                console.log("An error occured while creating the pool...");
                console.log(error);
            }
            else
            {
                console.log("Pool was successfully created!");
            }
        }});
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
        const job =  await batchClient.job.add(jobConfig, {onResponse: function (rawResponse, flatResponse, error) {
            if (error != null)
            {
                console.log("An error occured while creating the job...");
                console.log(error);
            }
            else
            {
                console.log("Job was successfully created!");
            }
        }});
        
    }
    catch (error) {
        console.log(error);
    }
    

}

async function createTasks() {
    console.log("Creating tasks....");
    let tasksPromises = [];
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

        const task = batchClient.task.add(jobId, taskConfig);
        tasksPromises.push(task);
        taskIds.push(taskID);
    }
    await Promise.all(tasksPromises);

}

async function waitForTasksToComplete() {
    while (true)
    {
        var incomplete_tasks = [];
        console.log("Checking if all tasks are complete...");

        for (let index = 0; index < taskIds.length; index++) {
            var taskId = taskIds[index];
            var taskResult = batchClient.task.get(jobId, taskId);

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


function deleteTasks() {
    taskIds.forEach(function(val, index) {
        console.log("Deleting Task: " + val);
        const result = batchClient.task.delete(jobId, val);
    })
    
}

async function initiateResources() {
    //provisionStorage();
     await createPool();
     await createJob();
     await createTasks();
     await waitForTasksToComplete();
     await storageClient.printBlobOutput(containerList);
}

function cleanupResources() {
    deleteTasks();
    deleteJob(jobId);
    deletePool(poolId);
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

function deletePool(poolId) {
    console.log("Deleting Pool: " + poolId);
    const result = batchClient.pool.delete(poolId);
}

function deleteJob(jobId) {
    console.log("Deleting Job: " + jobId);
    const result = batchClient.job.delete(jobId);
}
  

await initiateResources();
cleanupResources();



