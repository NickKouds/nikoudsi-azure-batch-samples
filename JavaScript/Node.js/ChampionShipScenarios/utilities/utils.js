

async function waitForTasksToComplete(batchServiceClient, taskList, targetState) {
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