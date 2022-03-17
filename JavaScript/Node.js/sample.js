import { BatchServiceClient, BatchSharedKeyCredentials } from "@azure/batch";
import {BatchManagementClient} from "@azure/arm-batch";
import { DefaultAzureCredential } from "@azure/identity";

/*
 * Create the Batch Service Client, this will be used to interface with jobs and tasks
 */
const batchAccountName = '<batch-account-name>';
const batchAccountKey = '<batch-account-key>';
const batchEndpoint = '<batch-account-url>';

// Replace values with SAS URIs of the shell script file
const sh_url = "<startup prereq script SAS URI>";

// Replace values with SAS URIs of the Python script file
const scriptURI = "<python script SAS URI>";

const credentials = new BatchSharedKeyCredentials(batchAccountName, batchAccountKey);
const batchClient = new BatchServiceClient(credentials, batchEndpoint);


/**
 * Create the Batch Management Client, this will be used to interface with pools
 */
const resourceGroup = "<resource group name>";
const accountName = "<batch account name>";
const subscriptionId = "<subscription id>";
const batchManagement = new BatchManagementClient(new DefaultAzureCredential(), subscriptionId);


// Pool ID 
const now = new Date();
const poolId = `processcsv_${now.getFullYear()}${now.getMonth()}${now.getDay()}${now.getHours()}${now.getSeconds()}`;

// Job ID 
const jobId = "processcsvjob";

createPool();

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
        nodeAgentSkuId: "batch.node.ubuntu 18.04"
    };
    // Number of VMs to create in a pool
    const numVms = 4;
    const vmSize = "STANDARD_D1_V2";
    // Pool configuration object
    const poolConfig = {
        displayName: "Processing csv files",
        vmSize: vmSize,
        deploymentConfiguration: {
            virtualMachineConfiguration: vmConfig
        },
        scaleSettings: {
                    fixedScale: {
                        targetDedicatedNodes: numVms
                    }
        }
    };

    // Creating Batch Pool
    console.log("Creating pool with ID : " + poolId);
    const poolResult = await batchManagement.poolOperations.create(resourceGroup,accountName,poolId,poolConfig);
    createJob();
}


function createJob() {
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
    const job = batchClient.job.add(jobConfig, function (error, result) {
        if (error !== null) {
            console.log("An error occurred while creating the job...");
            console.log(error);
        }
        else {
            // Create tasks if the job submitted successfully                        
            createTasks();
        }
    });
}

function createTasks() {
    console.log("Creating tasks....");
    const containerList = ["con1", "con2", "con3", "con4"];      //Replace with list of blob containers within storage account
    containerList.forEach(function (val, index) {
        console.log("Submitting task for container : " + val);
        const containerName = val;
        const taskID = containerName + "_process";
        // Task configuration object
        const taskConfig = {
            id: taskID,
            displayName: 'process csv in ' + containerName,
            commandLine: 'python processcsv.py --container ' + containerName,
            resourceFiles: [{ 'httpUrl': scriptURI, 'filePath': 'processcsv.py' }]
        };

        const task = batchClient.task.add(jobId, taskConfig, function (error, result) {
            if (error !== null) {
                console.log("Error occured while creating task for container " + containerName + ". Details : " + error.response);
            }
            else {
                console.log("Task for container : " + containerName + " submitted successfully");
            }
        });
    });
}