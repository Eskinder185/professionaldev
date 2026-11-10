import type { PoseSample } from "./presentation";

/**
 * On-device face and head-pose estimation with MediaPipe Face Landmarker
 * (Apache-2.0). The WebAssembly runtime and model file are served from this
 * app, so camera frames are processed locally and never uploaded.
 *
 * Output is an approximate head direction (yaw/pitch from the facial
 * transformation matrix) and the face's position and size in the frame.
 * It is not gaze tracking and is not precise.
 */

export type FaceTracker = { sample: (video: HTMLVideoElement, t: number) => PoseSample; close: () => void };

const toDegrees = (radians: number) => (radians * 180) / Math.PI;

export async function createFaceTracker(): Promise<FaceTracker> {
  const [{ FaceLandmarker }, loader, binary] = await Promise.all([
    import("@mediapipe/tasks-vision"),
    import("@mediapipe/tasks-vision/vision_wasm_internal.js?url"),
    import("@mediapipe/tasks-vision/vision_wasm_internal.wasm?url"),
  ]);
  const landmarker = await FaceLandmarker.createFromOptions(
    { wasmLoaderPath: loader.default, wasmBinaryPath: binary.default },
    {
      baseOptions: { modelAssetPath: `${import.meta.env.BASE_URL}models/face_landmarker.task`, delegate: "CPU" },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFacialTransformationMatrixes: true,
      outputFaceBlendshapes: false,
    },
  );
  let lastTimestamp = 0;
  return {
    sample: (video, t) => {
      if (video.readyState < 2 || !video.videoWidth) return { t, face: false };
      // Timestamps must strictly increase for VIDEO mode.
      const timestamp = Math.max(performance.now(), lastTimestamp + 1);
      lastTimestamp = timestamp;
      const result = landmarker.detectForVideo(video, timestamp);
      const landmarks = result.faceLandmarks?.[0];
      const matrix = result.facialTransformationMatrixes?.[0]?.data;
      if (!landmarks?.length) return { t, face: false };
      let minX = 1, minY = 1, maxX = 0, maxY = 0;
      for (const point of landmarks) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      }
      let yaw = 0;
      let pitch = 0;
      if (matrix && matrix.length >= 16) {
        // Column-major 4×4: r20 = m[2], r21 = m[6], r22 = m[10].
        yaw = toDegrees(Math.asin(Math.max(-1, Math.min(1, -matrix[2]))));
        pitch = toDegrees(Math.atan2(matrix[6], matrix[10]));
      }
      return { t, face: true, yaw, pitch, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, size: maxX - minX };
    },
    close: () => landmarker.close(),
  };
}
