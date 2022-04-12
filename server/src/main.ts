import express from "express";
import path from "path";
import multer from "multer";
import fs from "fs";
import busboy from "busboy";

const app = express();

const filesDir = path.join(__dirname, "../files");
const uploadsDir = path.join(__dirname, "../uploads");

const uploads: Record<string, any> = {};

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadsDir);
  },
  filename(_req, file, cb) {
    console.log("_file", file);

    const filename = `${file.mimetype.replace("/", ".")}-${file.size}-${
      file.originalname
    }`;
    cb(null, filename);
  },
});
// const upload = multer({ dest: "uploads/" });
const upload = multer({ storage });

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/", (_req, res) => {
  res.status(200).send({ message: "Root route" });
});

app.get("/api/download", (_req, res) => {
  const filename = "test.txt";
  res.download(path.join(filesDir, filename));
});

app.post("/api/upload", upload.single("file"), (req, res) => {
  const { timestamp } = req.body;
  const { file } = req;
  console.log({ timestamp, file });
  res.json({ message: "uploaded successfully" });
});

function getFileSize(fileId: string) {
  const fileChunks = fileId.split("-");
  if (fileChunks.length < 3) return null;
  return +fileChunks[1];
}

app.get("/api/resumable-upload-status", (req, res) => {
  let fileId = req.headers["x-file-id"];

  if (!fileId) {
    res.status(400).end({ message: "No fileId" });
    return;
  }

  fileId = fileId as string;

  try {
    const stats = fs.statSync(`${uploadsDir}/${fileId}`);

    if (stats.isFile()) {
      console.log(`already uploaded file size ${stats.size}`);
      const fileSize = getFileSize(fileId);

      if (!fileSize) {
        res.send({ bytesReceived: 0 });
        return;
      }

      if (stats.size === fileSize) {
        res.send({ status: "file is present", bytesReceived: stats.size });
        return;
      }

      console.log(uploads[fileId]);
      uploads[fileId]["bytesReceived"] = stats.size;
      console.log(uploads[fileId], stats.size);
    }
  } catch (error) {
    console.log(`${fileId} does not exist`);
  }

  const upload = uploads[fileId];

  console.log({ upload });

  if (upload) {
    res.send({ bytesReceived: upload.bytesReceived });
  } else {
    res.send({ bytesReceived: 0 });
  }
});

app.post("/api/resumable-upload", (req, res) => {
  let fileId = req.headers["x-file-id"];
  let startByte = req.headers["x-start-byte"];

  console.log({ fileId, startByte });

  if (fileId === "" || fileId === undefined || Array.isArray(fileId)) {
    res.status(400).end({ message: "Invalid x-file-id" });
    return;
  }

  if (startByte === "" || startByte === undefined || Array.isArray(startByte)) {
    res.status(400).end({ message: "Invalid x-start-byte" });
    return;
  }

  fileId = fileId as string;

  const fileSize = getFileSize(fileId);

  if (!uploads[fileId]) {
    uploads[fileId] = {};
  }

  const upload = uploads[fileId];

  let fileStream: ReturnType<typeof fs.createWriteStream>;
  const filePath = `${uploadsDir}/${fileId}`;

  console.log({ bytesReceived: upload.bytesReceived, startByte, fileSize });

  /* normal start */
  // // if startByte is 0 or not set, create a new file, otherwise check the size and append to existing one
  // if (+startByte === 0) {
  //   upload.bytesReceived = 0;
  //   fileStream = fs.createWriteStream(filePath, {
  //     flags: "w",
  //   });
  // } else {
  //   if (+startByte === fileSize) {
  //     res.send({ message: "The file has been uploaded before" });
  //     res.end();
  //     return;
  //   }

  //   // we can check on-disk file size as well to be sure
  //   if (upload.bytesReceived !== +startByte) {
  //     res.status(400).end({
  //       message: "Wrong start byte",
  //       bytesReceived: upload.bytesReceived,
  //     });
  //     return;
  //   }

  //   // append to existing file
  //   fileStream = fs.createWriteStream(filePath, {
  //     flags: "a",
  //   });
  // }

  // req.on("data", (data) => {
  //   console.log("data", data);

  //   console.log("bytes received", upload.bytesReceived);
  //   upload.bytesReceived += data.length;
  // });

  // // send request body to file
  // req.pipe(fileStream);

  // // when the request is finished, and all its data is written
  // fileStream.on("close", () => {
  //   console.log("close", { bytesReceived: upload.bytesReceived, fileSize });

  //   if (upload.bytesReceived === fileSize) {
  //     console.log("Upload finished");
  //     delete uploads[fileId as string];

  //     // can do something else with the uploaded file here
  //     res.send({ message: "uploaded successfully" });
  //     res.end();
  //   } else {
  //     // connection lost, we leave the unfinished file around
  //     console.log("File unfinished, stopped at " + upload.bytesReceived);
  //     res.writeHead(500, "Server Error");
  //     res.end();
  //   }
  // });

  // // in case of I/O error - finish the request
  // fileStream.on("error", (error) => {
  //   console.log("fileStream error", error);
  //   res.writeHead(500, "File error");
  //   res.end();
  // });
  /* normal end */

  const bb = busboy({ headers: req.headers });

  bb.on("file", (name, file, info) => {
    const { filename, encoding, mimeType } = info;
    console.log(
      `File [${name}]: filename: %j, encoding: %j, mimeType: %j`,
      filename,
      encoding,
      mimeType
    );

    if (+startByte! === 0) {
      upload.bytesReceived = 0;
      fileStream = fs.createWriteStream(filePath, {
        flags: "w",
      });
    } else {
      if (+startByte! === fileSize) {
        res.send({ message: "The file has been uploaded before" });
        res.end();
        return;
      }

      // we can check on-disk file size as well to be sure
      if (upload.bytesReceived !== +startByte!) {
        res
          .status(400)
          .send({
            message: "Wrong start byte",
            bytesReceived: upload.bytesReceived,
          })
          .end();
        return;
      }

      // append to existing file
      fileStream = fs.createWriteStream(filePath, {
        flags: "a",
      });
    }

    file
      .on("data", (data) => {
        // console.log(`File [${name}] got ${data.length} bytes`);
        console.log("bytes received::before", upload.bytesReceived);
        upload.bytesReceived += data.length;
        console.log("bytes received::after", upload.bytesReceived);
      })
      .on("close", () => {
        console.log("file::close", {
          bytesReceived: upload.bytesReceived,
          fileSize,
        });
      });

    file.pipe(fileStream);

    // when the request is finished, and all its data is written
    fileStream.on("close", () => {
      console.log("fileStream::close", {
        bytesReceived: upload.bytesReceived,
        fileSize,
      });

      if (upload.bytesReceived === fileSize) {
        console.log("Upload finished");
        delete uploads[fileId as string];

        // can do something else with the uploaded file here
        res.send({ message: "uploaded successfully" });
        res.end();
      } else {
        // connection lost, we leave the unfinished file around
        console.log("File unfinished, stopped at " + upload.bytesReceived);
        res.writeHead(500, "Server Error");
        res.end();
      }
    });

    // in case of I/O error - finish the request
    fileStream.on("error", (error) => {
      console.log("fileStream error", error);
      res.writeHead(500, "File error");
      res.end();
    });
  });
  bb.on("field", (name, val, _info) => {
    console.log(`Field [${name}]: value: %j`, val);
  });
  bb.on("close", () => {
    console.log("Done parsing form!");
    // res.end();
  });

  req.pipe(bb);
});

app.listen(4000, () => console.log("Server running on port 4000"));
