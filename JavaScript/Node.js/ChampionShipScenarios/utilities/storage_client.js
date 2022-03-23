
import { BlobServiceClient } from "@azure/storage-blob";


export class StorageClient {
  constructor(storageAccountName, credential) {
    this.blobServiceClient = new BlobServiceClient(`https://${storageAccountName}.blob.core.windows.net`, credential);
  }

  async printBlobOutput(containerList) {
    for(let index = 0; index < containerList.length; index++) {
      var containerName = containerList[index];
      console.log(`Printing blobs in ${containerName}`);
      const containerClient = this.blobServiceClient.getContainerClient(containerName);

      let i = 1;
      let blobs = containerClient.listBlobsFlat();
      for await (const blob of blobs) {
          if (blob.name.startsWith("json/"))
          {
              console.log(`Blob ${i++}: ${blob.name}`);
              const blobClient = containerClient.getBlobClient(blob.name);

              // Get blob content from position 0 to the end
              // In Node.js, get downloaded data by accessing downloadBlockBlobResponse.readableStreamBody
              const downloadBlockBlobResponse = await blobClient.download();
              const downloaded = (
                  await this.streamToBuffer(downloadBlockBlobResponse.readableStreamBody)
              ).toString();
              console.log("Downloaded blob content:", downloaded);
          }
      }
    }

  }


  // [Node.js only] A helper method used to read a Node.js readable stream into a Buffer
  async streamToBuffer(readableStream) {
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

}





