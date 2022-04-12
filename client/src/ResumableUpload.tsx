import axios from "axios";
import { useRef } from "react";
import "./App.css";

class Uploader {
  private file: File;
  private onProgress: (nextPercent: number) => void;
  private abortController: AbortController;

  constructor({
    file,
    onProgress,
  }: {
    file: File;
    onProgress: (nextPercent: number) => void;
  }) {
    this.file = file;
    this.onProgress = onProgress;
    this.abortController = new AbortController();
  }

  // create fileId that uniquely identifies the file
  // we could also add user session identifier (if had one), to make it even more unique
  get fileId() {
    const file = this.file;
    return `${file.type.replace("/", ".")}-${file.size}-${file.name}`;
  }

  async getUploadedBytes() {
    const response = await axios({
      method: "GET",
      url: "/api/resumable-upload-status",
      headers: {
        "X-File-Id": this.fileId,
      },
    });

    if (response.status !== 200) {
      throw new Error("Can not get updated bytes:" + response.statusText);
    }

    const { bytesReceived } = response.data as { bytesReceived: number };

    return bytesReceived;
  }

  async upload() {
    const startByte = await this.getUploadedBytes();
    const data = new FormData();
    data.append("timestamp", `${Date.now()}`);
    data.append("file", this.file.slice(startByte));
    const progressCallback = this.onProgress;

    try {
      const response = await axios({
        method: "POST",
        url: "/api/resumable-upload",
        headers: {
          "X-File-Id": this.fileId,
          "X-Start-Byte": startByte,
        },
        data: data,
        onUploadProgress(event: ProgressEvent) {
          console.log({ event });

          const nextPercent = Math.floor(
            ((startByte + event.loaded) * 100) / (startByte + event.total)
          );
          console.log("onUploadProgress::nextPercent", nextPercent);
          progressCallback(nextPercent);
        },
        signal: this.abortController.signal,
      });

      // let xhr = new XMLHttpRequest();
      // xhr.open("POST", "/api/resumable-upload", true);

      // // send file id, so that the server knows which file to resume
      // xhr.setRequestHeader("X-File-Id", `${this.fileId}`);
      // // send the byte we're resuming from, so the server knows we're resuming
      // xhr.setRequestHeader("X-Start-Byte", `${startByte}`);

      // // xhr.upload.onprogress = (e) => {
      // //   this.onProgress(this.startByte + e.loaded, this.startByte + e.total);
      // // };

      // console.log("send the file, starting from", startByte);
      // xhr.send(this.file.slice(startByte));

      // console.log(response);
    } catch (error) {
      console.error(error);
    }
  }

  stop() {
    this.abortController.abort();
  }
}

function ResumableUpload() {
  const progressUploadRef = useRef<HTMLDivElement>(null!);
  const inputFileRef = useRef<HTMLInputElement>(null!);
  const uploaderRef = useRef<Uploader>(null!);
  const isStopRef = useRef<boolean>(false);

  const setProgress = (progressEl: HTMLDivElement, value: number = 0) => {
    progressEl.innerHTML = value + "%";
    progressEl.style.width = value + "%";
  };

  const handleUpload = async () => {
    const progressEl = progressUploadRef.current;

    if (!isStopRef.current) {
      setProgress(progressEl, 0);
    }

    const file = inputFileRef.current?.files?.[0];

    if (!file) return;

    const onProgress = (nextPercent: number) => {
      console.log("onProgress called");
      setProgress(progressEl, nextPercent);
    };

    uploaderRef.current = new Uploader({ file, onProgress });

    try {
      await uploaderRef.current.upload();
    } catch (error) {}
  };

  const handleStop = () => {
    isStopRef.current = true;
    uploaderRef.current.stop();
  };

  return (
    <div>
      <h3>resume upload</h3>
      <input type="file" accept="image/*" ref={inputFileRef} />
      <div></div>
      <br />
      <button onClick={handleUpload}>upload</button>
      <button onClick={handleStop}>stop upload</button>
      <div className="progress">
        <div
          className="progress-item progress-item--upload"
          ref={progressUploadRef}
          style={{ width: "0%" }}
        >
          0%
        </div>
      </div>
    </div>
  );
}

export default ResumableUpload;
