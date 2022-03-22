import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";

// Enter your storage account name
const account = "";
const defaultAzureCredential = new DefaultAzureCredential();


export function getBlobServiceClient() {
    return new BlobServiceClient(
        `https://${account}.blob.core.windows.net`,
        defaultAzureCredential
      );
}

async function main() {
    const blobServiceClient = getBlobServiceClient();
    let containerList = blobServiceClient.listContainers();
    let containerItem = await containerList.next();

    while (!containerItem.done)
    {
        var containerName = containerItem.value.name;
        console.log(`Listing blobs in ${containerName}`);
        const containerClient = blobServiceClient.getContainerClient(containerName);

        let i = 1;
        let blobs = containerClient.listBlobsFlat();
        for await (const blob of blobs) {
            console.log(`Blob ${i++}: ${blob.name}`);

            if (blob.name.startsWith("json/"))
            {
                const blobClient = containerClient.getBlobClient(blob.name);

                // Get blob content from position 0 to the end
                // In Node.js, get downloaded data by accessing downloadBlockBlobResponse.readableStreamBody
                const downloadBlockBlobResponse = await blobClient.download();
                const downloaded = (
                    await streamToBuffer(downloadBlockBlobResponse.readableStreamBody)
                ).toString();
                console.log("Downloaded blob content:", downloaded);
            }
        }

        containerItem = await containerList.next();
    }
    
  }


  // [Node.js only] A helper method used to read a Node.js readable stream into a Buffer
  async function streamToBuffer(readableStream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      readableStream.on("data", (data) => {
        chunks.push(data instanceof Buffer ? data : Buffer.from(data));
      });
      readableStream.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      readableStream.on("error", reject);
    });
  }


  
main();


