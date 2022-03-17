import { BatchServiceClient} from "@azure/batch";
import { ClientSecretCredential } from "@azure/identity";


const AZURE_CLIENT_SECRET = "<>";
const AZURE_CLIENT_ID = "<>";
const AZURE_TENANT_ID= "<>";
const BATCH_ENDPOINT = "<>";


const credential = new ClientSecretCredential(
    AZURE_TENANT_ID,
    AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET
  );

const batchClient = new BatchServiceClient(credential, BATCH_ENDPOINT);

// Replace values with SAS URIs of the shell script file
const sh_url = "";

// Replace values with SAS URIs of the Python script file
const scriptURI = "";


// Pool ID 
const now = new Date();
const poolId = `processcsv_${now.getFullYear()}${now.getMonth()}${now.getDay()}${now.getHours()}${now.getSeconds()}`;

// Job ID 
const jobId = "processcsvjob";

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
const test = batchClient
const pool = batchClient.pool.add(poolConfig);
createJob();
createTasks();

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
    const job = batchClient.job.add(jobConfig);
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

        const task = batchClient.task.add(jobId, taskConfig);
    });
}