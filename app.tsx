import { useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

type Layout = "vertical" | "landscape" | "fit";

const cardStyle = {
  background: "#151c30",
  border: "1px solid #29334b",
  borderRadius: 16,
  padding: 18,
};

export default function App() {
  const [videos, setVideos] = useState<(File | null)[]>([null, null, null]);
  const [duration, setDuration] = useState("30");
  const [layout, setLayout] = useState<Layout>("vertical");
  const [quality, setQuality] = useState("28");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState("");
  const [progress, setProgress] = useState(0);

  async function createVideo() {
    if (videos.some((video) => !video)) {
      setStatus("Please select all 3 videos first.");
      return;
    }

    setBusy(true);
    setProgress(0);
    setStatus("Starting video editor...");

    if (output) URL.revokeObjectURL(output);
    setOutput("");

    const ffmpeg = new FFmpeg();

    try {
      ffmpeg.on("progress", ({ progress: p }) => {
        setProgress(Math.min(95, Math.round(p * 100)));
      });

      setStatus("Loading video engine...");

      await ffmpeg.load({
        coreURL: await toBlobURL(
          "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",
          "text/javascript"
        ),
        wasmURL: await toBlobURL(
          "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm",
          "application/wasm"
        ),
      });

      const clipSeconds = Math.floor(Number(duration) / 3);
      const width = layout === "landscape" ? 1280 : 720;
      const height = layout === "landscape" ? 720 : 1280;

      for (let i = 0; i < 3; i++) {
        const file = videos[i]!;
        const inputName = `input${i}.mp4`;
        const outputName = `clip${i}.mp4`;

        setStatus(`Processing video ${i + 1} of 3...`);
        await ffmpeg.writeFile(inputName, await fetchFile(file));

        let filter: string;

        if (layout === "fit") {
          filter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
        } else {
          filter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`;
        }

        await ffmpeg.exec([
          "-i", inputName,
          "-t", String(clipSeconds),
          "-vf", filter,
          "-r", "30",
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-crf", quality,
          "-pix_fmt", "yuv420p",
          "-c:a", "aac",
          "-ar", "44100",
          "-ac", "2",
          "-b:a", "128k",
          "-af", "aresample=async=1",
          "-movflags", "+faststart",
          "-y", outputName,
        ]);

        setProgress(Math.round(((i + 1) / 3) * 70));
      }

      setStatus("Joining the 3 videos...");

      await ffmpeg.writeFile(
        "list.txt",
        "file 'clip0.mp4'\nfile 'clip1.mp4'\nfile 'clip2.mp4'\n"
      );

      await ffmpeg.exec([
        "-f", "concat",
        "-safe", "0",
        "-i", "list.txt",
        "-c", "copy",
        "-movflags", "+faststart",
        "-y", "highlight.mp4",
      ]);

      const result = await ffmpeg.readFile("highlight.mp4");

      if (typeof result === "string") {
        throw new Error("The output video could not be created.");
      }

      const blob = new Blob([result], { type: "video/mp4" });
      setOutput(URL.createObjectURL(blob));
      setProgress(100);
      setStatus("Your highlight video is ready!");
    } catch (error) {
      console.error(error);
      setStatus(
        "Video processing failed. Try smaller videos or refresh the page and try again."
      );
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    background: "#0b1020",
    color: "#ffffff",
    border: "1px solid #39445f",
    boxSizing: "border-box" as const,
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b1020",
        color: "#f4f6ff",
        fontFamily: "Arial, sans-serif",
        padding: "28px 16px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <header style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 38 }}>🎬</div>
          <h1 style={{ marginBottom: 8 }}>ClipForge AI</h1>
          <p style={{ color: "#aab5cf", lineHeight: 1.6 }}>
            Combine 3 videos into one highlight video
          </p>
        </header>

        <section style={{ ...cardStyle, marginBottom: 18 }}>
          <h2 style={{ fontSize: 19 }}>1. Upload your videos</h2>
          {videos.map((video, index) => (
            <div key={index} style={{ marginBottom: 16 }}>
              <label
                htmlFor={`video-${index}`}
                style={{ display: "block", marginBottom: 8 }}
              >
                Video {index + 1}
              </label>
              <input
                id={`video-${index}`}
                type="file"
                accept="video/*"
                style={inputStyle}
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setVideos((previous) =>
                    previous.map((old, i) => (i === index ? file : old))
                  );
                }}
              />
              {video && (
                <p style={{ color: "#aab5cf", fontSize: 13 }}>
                  Selected: {video.name} (
                  {(video.size / (1024 * 1024)).toFixed(1)} MB)
                </p>
              )}
            </div>
          ))}
        </section>

        <section style={{ ...cardStyle, marginBottom: 18 }}>
          <h2 style={{ fontSize: 19 }}>2. Video settings</h2>

          <label style={{ display: "block", marginBottom: 8 }}>
            Final video duration
          </label>
          <select
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            style={{ ...inputStyle, marginBottom: 18 }}
          >
            <option value="15">15 seconds</option>
            <option value="30">30 seconds</option>
            <option value="60">60 seconds</option>
            <option value="90">90 seconds</option>
          </select>

          <label style={{ display: "block", marginBottom: 8 }}>
            Video format
          </label>
          <select
            value={layout}
            onChange={(event) => setLayout(event.target.value as Layout)}
            style={{ ...inputStyle, marginBottom: 18 }}
          >
            <option value="vertical">Vertical — TikTok / Reels / Shorts</option>
            <option value="landscape">Landscape — YouTube</option>
            <option value="fit">Fit video inside frame</option>
          </select>

          <label style={{ display: "block", marginBottom: 8 }}>
            Output quality
          </label>
          <select
            value={quality}
            onChange={(event) => setQuality(event.target.value)}
            style={inputStyle}
          >
            <option value="23">High quality — larger file</option>
            <option value="28">Balanced quality</option>
            <option value="32">Smaller file</option>
          </select>

          <p style={{ color: "#aab5cf", fontSize: 13, lineHeight: 1.6 }}>
            Each video contributes approximately one-third of the final
            duration. Processing happens in your browser and may use
            significant memory.
          </p>
        </section>

        <button
          onClick={createVideo}
          disabled={busy || videos.some((video) => !video)}
          style={{
            width: "100%",
            padding: 16,
            border: 0,
            borderRadius: 12,
            background: busy ? "#45516c" : "#7657ff",
            color: "white",
            fontSize: 17,
            fontWeight: "bold",
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? "Creating video..." : "✨ Create Highlight Video"}
        </button>

        {status && (
          <section style={{ ...cardStyle, marginTop: 18 }}>
            <p aria-live="polite">{status}</p>
            {busy && (
              <progress
                value={progress}
                max={100}
                style={{ width: "100%", height: 12 }}
              />
            )}
            {output && (
              <>
                <video
                  src={output}
                  controls
                  style={{
                    width: "100%",
                    marginTop: 12,
                    borderRadius: 12,
                    background: "#000",
                  }}
                />
                <a
                  href={output}
                  download="clipforge-highlight.mp4"
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: 14,
                    marginTop: 14,
                    background: "#14a875",
                    color: "white",
                    borderRadius: 10,
                    textDecoration: "none",
                    fontWeight: "bold",
                  }}
                >
                  ⬇ Download Highlight Video
                </a>
              </>
            )}
          </section>
        )}

        <footer
          style={{
            textAlign: "center",
            color: "#8995b0",
            marginTop: 28,
            fontSize: 13,
          }}
        >
          ClipForge AI · Your videos are processed in your browser
        </footer>
      </div>
    </main>
  );
}
