import axios from "axios";
import { useRef } from "react";
import "./App.css";
import ResumableUpload from "./ResumableUpload";

function App() {
  const progressDownloadRef = useRef<HTMLDivElement>(null!);
  const progressUploadRef = useRef<HTMLDivElement>(null!);
  const inputFileRef = useRef<HTMLInputElement>(null!);

  const setProgress = (progressEl: HTMLDivElement, value: number = 0) => {
    progressEl.innerHTML = value + "%";
    progressEl.style.width = value + "%";
  };

  const handleDownload = async () => {
    const progressEl = progressDownloadRef.current;
    setProgress(progressEl, 0);

    const response = await axios({
      method: "GET",
      url: "/api/download",
      responseType: "blob",
      onDownloadProgress(event: ProgressEvent) {
        const nextPercent = Math.floor((event.loaded * 100) / event.total);

        setProgress(progressEl, nextPercent);
      },
    });

    console.log(response);
  };

  const handleUpload = async () => {
    const progressEl = progressUploadRef.current;
    setProgress(progressEl, 0);

    if (!inputFileRef.current.files) return;

    console.log(inputFileRef.current.files[0]);

    const data = new FormData();
    data.append("timestamp", `${Date.parse(new Date().toISOString())}`);
    data.append("file", inputFileRef.current.files[0]);

    const response = await axios({
      method: "POST",
      url: "/api/upload",
      data,
      onUploadProgress(event: ProgressEvent) {
        const nextPercent = Math.floor((event.loaded * 100) / event.total);
        console.log("onUploadProgress::nextPercent", nextPercent);

        setProgress(progressEl, nextPercent);
      },
    });

    console.log(response);
  };

  return (
    <div className="App">
      <div>
        <h3>download</h3>
        <button onClick={handleDownload}>download</button>

        <div className="progress">
          <div
            className="progress-item progress-item--download"
            ref={progressDownloadRef}
            style={{ width: "0%" }}
          >
            0%
          </div>
        </div>
      </div>

      <div>
        <h3>upload</h3>
        <input type="file" accept="image/*" ref={inputFileRef} />
        <div></div>
        <br />
        <button onClick={handleUpload}>upload</button>

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

      <ResumableUpload />
    </div>
  );
}

export default App;
