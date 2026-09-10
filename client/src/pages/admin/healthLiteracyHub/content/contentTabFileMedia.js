import { formatVideoDuration } from "../shared";

export const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

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

export const downloadMediaFile = ({ url, filename }) => {
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = filename;
  downloadLink.rel = "noopener noreferrer";
  downloadLink.style.display = "none";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
};
