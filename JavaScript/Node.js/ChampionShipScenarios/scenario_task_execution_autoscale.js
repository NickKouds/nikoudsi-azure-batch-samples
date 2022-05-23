import { BatchServiceClient} from "@azure/batch";
import { ClientSecretCredential} from "@azure/identity";
import {BatchManagementClient} from "@azure/arm-batch";
import {StorageClient} from "./utilities/storage_client.js"
import {createClient, sleep, waitForTasksToComplete, deleteJob, deletePool} from "./utilities/batch_client.js";

const batchClient = createClient("APIKey");

//Pool Id
const now = new Date();
const POOL_ID = `AutoScaleTestPool_${now.getFullYear()}${now.getMonth()}${now.getDay()}${now.getHours()}${now.getSeconds()}`;
const POOL_MAX_COUNT = 10
const JOB_ID = `AutoScaleTestJob_${now.getFullYear()}${now.getMonth()}${now.getDay()}${now.getHours()}${now.getSeconds()}`;
const TASK_COUNT = 10;
const TASK_ID_PREFIX = "ProcessBashCmd";

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

    const vmSize = "STANDARD_D1_V2";
    // Pool configuration object
    const poolConfig = {
        id: POOL_ID,
        displayName: "Testing Auto Scale",
        vmSize: vmSize,
        virtualMachineConfiguration: vmConfig,
        enableAutoScale: true,
        autoScaleFormula: `poolSize = max($CurrentDedicatedNodes + 1,2);\n $TargetDedicatedNodes = min(poolSize , ${POOL_MAX_COUNT});`,
        autoScaleEvaluationInterval: "PT5M"
    };

    // Creating Batch Pool
    console.log("Creating pool with ID : " + POOL_ID);
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
    console.log("Creating job with ID : " + JOB_ID);

    // Setting Batch Pool ID
    const poolInfo = { poolId: POOL_ID };
    // Batch job configuration object
    const jobConfig = {
        id: JOB_ID,
        displayName: "Testing AutoScale",
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
    let taskConfigs = [];

    for (let index = 1; index <= TASK_COUNT; index++)
    {
        const taskId = TASK_ID_PREFIX + index;
        // Task configuration object
        const taskConfig = {
            id: taskId,
            displayName: 'Process Bash Cmd',
            commandLine: `echo Task ${taskId} complete!`
        };
        taskConfigs.push(taskConfig);
    }

    console.log("Submitting Task Collection...");
    const addTaskCollectionResult = await batchClient.task.addCollection(JOB_ID, {value: taskConfigs})
    let taskIds = taskConfigs.map(taskConfig => taskConfig.id);

    return {taskIds: taskIds, result: addTaskCollectionResult};

}

/**
 * 
 * @param {number} poolCheckTimeout - Total elapsed time in milliseconds of checking if the pool has resized or not
 * @param {number} sleepInterval - Time in milliseconds to sleep in between calls
 */
 async function verifyPoolResize(poolCheckTimeout, sleepInterval) {
    const endTime = new Date().getTime() + poolCheckTimeout;
    var poolCurrentNodeCount = (await batchClient.pool.get(POOL_ID)).currentDedicatedNodes;
    var poolHasScaled = false;
    console.log(`Current Pool dedicated node count: ${poolCurrentNodeCount}`);

    while (new Date().getTime() <= endTime) {
        console.log("Checking if Pool has resized...");
        var updatedPoolCount = (await batchClient.pool.get(POOL_ID)).currentDedicatedNodes;
        if (updatedPoolCount > poolCurrentNodeCount) {
            poolHasScaled = true;
            break;
        }
        
        sleep(sleepInterval);
    }
    

    if (!poolHasScaled) {
        throw Error(`Pool ${POOL_ID} has not scaled within the elapsed time`);
    }

    console.log("Pool has successfully scaled!");
}

async function initiateResources() {
    await createPool();
    await createJob();
    let addTaskCollectionResultStruct = await createTasks();
    let taskErrors = addTaskCollectionResultStruct.result.value.filter(task => task.error != null);

    if (taskErrors.length > 0) {
        taskErrors.forEach(task => console.log(`Task Id ${task.taskId} Error: \n ${task.error}`))

        throw Error("Add Task Collection Call returned with error");
    }

    await waitForTasksToComplete(batchClient, JOB_ID, addTaskCollectionResultStruct.taskIds);
}

async function cleanupResources() {
    deleteJob(batchClient, JOB_ID);
    deletePool(batchClient, POOL_ID);
}

try {
    await initiateResources();
    await verifyPoolResize(600000, 60000);
}
catch (error) {
    console.log(error);
    throw error;
}
finally {
    cleanupResources();
}





