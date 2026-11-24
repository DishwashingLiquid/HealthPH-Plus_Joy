import { formatVideoDuration } from "../shared";

export const getVideoFileDuration = (file) =>
  new Promise((resolve) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = formatVideoDuration(video.duration);
      cleanup();
      resolve(duration);
    };
    video.onerror = () => {
      cleanup();
      resolve("");
    };
    video.src = objectUrl;
  });
